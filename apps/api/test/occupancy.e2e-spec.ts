import { ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, TimeBlockKind } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OccupancyService } from '../src/modules/occupancy/occupancy.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DATE = '2026-09-17'; // Thursday (weekday 4)

describe('BE-4 occupancy & availability', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let occupancy: OccupancyService;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    occupancy = app.get(OccupancyService);

    await prisma.clubSettings.update({
      where: { id: 1 },
      data: { timezone: 'UTC' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'changeme-admin' })
      .expect(200);
    adminCookie = cookieHeader(login);

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `member-occ-${Date.now()}@example.com`,
        password: 'member-pass',
        name: 'Occupancy Member',
      })
      .expect(201);
    expect(register.body.role).toBe(Role.member);
    memberCookie = cookieHeader(register);
  });

  afterAll(async () => {
    await app.close();
  });

  it('overlapping insertBlock is CONFLICT; DB exclusion rejects bypass; A12 back-to-back OK', async () => {
    const courtId = await seedCourtWithHours('Overlap Court');

    const first = await prisma.$transaction((tx) =>
      occupancy.insertBlock(tx, {
        courtId,
        start: utc(10, 0),
        end: utc(11, 0),
        kind: TimeBlockKind.booking,
      }),
    );
    expect(first.start.toISOString()).toBe('2026-09-17T10:00:00.000Z');

    await expect(
      prisma.$transaction((tx) =>
        occupancy.insertBlock(tx, {
          courtId,
          start: utc(10, 30),
          end: utc(11, 30),
          kind: TimeBlockKind.booking,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      prisma.courtTimeBlock.create({
        data: {
          courtId,
          start: utc(10, 15),
          end: utc(10, 45),
          kind: TimeBlockKind.session,
        },
      }),
    ).rejects.toThrow();

    const adjacent = await prisma.$transaction((tx) =>
      occupancy.insertBlock(tx, {
        courtId,
        start: utc(11, 0),
        end: utc(12, 0),
        kind: TimeBlockKind.booking,
      }),
    );
    expect(adjacent.start.toISOString()).toBe('2026-09-17T11:00:00.000Z');

    const listed = await occupancy.listBlocks(
      courtId,
      utc(10, 0),
      utc(12, 0),
    );
    expect(listed).toHaveLength(2);
  });

  it('availability subtracts hours, blackouts, and blocks; inactive court is empty', async () => {
    const courtId = await seedCourtWithHours('Avail Court');

    await request(app.getHttpServer())
      .post(`/api/v1/courts/${courtId}/blackouts`)
      .set('Cookie', adminCookie)
      .send({
        start: '2026-09-17T10:30:00.000Z',
        end: '2026-09-17T11:00:00.000Z',
        reason: 'Lesson prep',
      })
      .expect(201);

    await prisma.$transaction((tx) =>
      occupancy.insertBlock(tx, {
        courtId,
        start: utc(11, 0),
        end: utc(11, 30),
        kind: TimeBlockKind.booking,
      }),
    );

    const open = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ courtId, date: DATE })
      .set('Cookie', memberCookie)
      .expect(200);

    expect(open.body).toMatchObject({
      courtId,
      date: DATE,
      timezone: 'UTC',
      slotMinutes: 30,
    });
    expect(open.body.slots).toEqual([
      { start: '2026-09-17T10:00:00.000Z', end: '2026-09-17T10:30:00.000Z' },
      { start: '2026-09-17T11:30:00.000Z', end: '2026-09-17T12:00:00.000Z' },
    ]);

    await request(app.getHttpServer())
      .patch(`/api/v1/courts/${courtId}`)
      .set('Cookie', adminCookie)
      .send({ active: false })
      .expect(200);

    const inactive = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ courtId, date: DATE })
      .set('Cookie', memberCookie)
      .expect(200);
    expect(inactive.body.slots).toEqual([]);
  });

  it('member can GET availability; unauthenticated is 401; bad input is 400/404', async () => {
    const courtId = await seedCourtWithHours('Auth Court');

    const ok = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ courtId, date: DATE })
      .set('Cookie', memberCookie)
      .expect(200);
    expect(ok.body.slots).toHaveLength(4);

    const unauth = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ courtId, date: DATE })
      .expect(401);
    expect(unauth.body.code).toBe('UNAUTHORIZED');

    await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ courtId, date: '17-09-2026' })
      .set('Cookie', memberCookie)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ courtId: '00000000-0000-4000-8000-000000000000', date: DATE })
      .set('Cookie', memberCookie)
      .expect(404);
  });

  async function seedCourtWithHours(name: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', adminCookie)
      .send({ name: `${name} ${Date.now()}` })
      .expect(201);
    const courtId = created.body.id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send([{ weekday: 4, startLocal: '10:00', endLocal: '12:00' }])
      .expect(200);

    return courtId;
  }
});

function utc(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 8, 17, hour, minute, 0));
}

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  if (!raw) {
    throw new Error('missing set-cookie');
  }

  const first = Array.isArray(raw) ? raw[0] : raw;
  return first.split(';')[0];
}
