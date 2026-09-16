import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BE-3 courts, weekly hours, blackouts', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'changeme-admin' })
      .expect(200);
    adminCookie = cookieHeader(login);

    const memberEmail = `member-courts-${Date.now()}@example.com`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: memberEmail,
        password: 'member-pass',
        name: 'Court Member',
      })
      .expect(201);
    expect(register.body.role).toBe(Role.member);
    memberCookie = cookieHeader(register);
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin can create court, put hours, and CRUD blackouts; deactivate keeps schedule', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', adminCookie)
      .send({ name: 'Center Court' })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'Center Court',
      active: true,
    });
    expect(created.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    const courtId = created.body.id as string;

    const hoursBody = [
      { weekday: 1, startLocal: '08:00', endLocal: '21:00' },
      { weekday: 3, startLocal: '09:00', endLocal: '18:00' },
    ];
    const putHours = await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send(hoursBody)
      .expect(200);
    expect(putHours.body.hours).toEqual(hoursBody);

    const getHours = await request(app.getHttpServer())
      .get(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(getHours.body.hours).toEqual(hoursBody);

    const wrappedPut = await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send({
        hours: [{ weekday: 2, startLocal: '10:00', endLocal: '12:00' }],
      })
      .expect(200);
    expect(wrappedPut.body.hours).toEqual([
      { weekday: 2, startLocal: '10:00', endLocal: '12:00' },
    ]);

    const blackout = await request(app.getHttpServer())
      .post(`/api/v1/courts/${courtId}/blackouts`)
      .set('Cookie', adminCookie)
      .send({
        start: '2026-10-01T00:00:00.000Z',
        end: '2026-10-02T00:00:00.000Z',
        reason: 'Resurfacing',
      })
      .expect(201);
    expect(blackout.body).toMatchObject({
      courtId,
      reason: 'Resurfacing',
    });
    const blackoutId = blackout.body.id as string;

    const listBo = await request(app.getHttpServer())
      .get(`/api/v1/courts/${courtId}/blackouts`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(listBo.body.blackouts).toHaveLength(1);
    expect(listBo.body.blackouts[0].id).toBe(blackoutId);

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/courts/${courtId}`)
      .set('Cookie', adminCookie)
      .send({ active: false })
      .expect(200);
    expect(deactivated.body.active).toBe(false);
    expect(typeof deactivated.body.warning).toBe('string');
    expect(deactivated.body.warning.length).toBeGreaterThan(0);

    const hoursAfter = await prisma.courtWeeklyHour.count({ where: { courtId } });
    const blackoutsAfter = await prisma.courtBlackout.count({
      where: { courtId },
    });
    expect(hoursAfter).toBe(1);
    expect(blackoutsAfter).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/courts/${courtId}/blackouts/${blackoutId}`)
      .set('Cookie', adminCookie)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/courts/${courtId}/blackouts/${blackoutId}`)
      .set('Cookie', adminCookie)
      .expect(404);

    const emptyBo = await request(app.getHttpServer())
      .get(`/api/v1/courts/${courtId}/blackouts`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(emptyBo.body.blackouts).toEqual([]);
  });

  it('member gets 403 on writes but can GET active courts and schedule', async () => {
    const court = await prisma.court.create({
      data: { name: `Member Visible ${Date.now()}`, active: true },
    });
    await prisma.courtWeeklyHour.create({
      data: {
        courtId: court.id,
        weekday: 5,
        startLocal: '07:00',
        endLocal: '10:00',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', memberCookie)
      .send({ name: 'Nope' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/courts/${court.id}`)
      .set('Cookie', memberCookie)
      .send({ name: 'Hijack' })
      .expect(403);

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${court.id}/weekly-hours`)
      .set('Cookie', memberCookie)
      .send([{ weekday: 1, startLocal: '08:00', endLocal: '09:00' }])
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/courts/${court.id}/blackouts`)
      .set('Cookie', memberCookie)
      .send({
        start: '2026-11-01T00:00:00.000Z',
        end: '2026-11-02T00:00:00.000Z',
      })
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/v1/courts')
      .set('Cookie', memberCookie)
      .expect(200);
    expect(list.body.courts.every((c: { active: boolean }) => c.active)).toBe(
      true,
    );
    expect(list.body.courts.some((c: { id: string }) => c.id === court.id)).toBe(
      true,
    );

    const hours = await request(app.getHttpServer())
      .get(`/api/v1/courts/${court.id}/weekly-hours`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(hours.body.hours).toEqual([
      { weekday: 5, startLocal: '07:00', endLocal: '10:00' },
    ]);

    await request(app.getHttpServer())
      .get(`/api/v1/courts/${court.id}/blackouts`)
      .set('Cookie', memberCookie)
      .expect(200);
  });

  it('validation rejects bad weekday and start>=end; empty name is 400', async () => {
    const court = await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', adminCookie)
      .send({ name: `Validation Court ${Date.now()}` })
      .expect(201);
    const courtId = court.body.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', adminCookie)
      .send({ name: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send([{ weekday: 7, startLocal: '08:00', endLocal: '09:00' }])
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send([{ weekday: 1, startLocal: '10:00', endLocal: '10:00' }])
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send([{ weekday: 1, startLocal: '18:00', endLocal: '09:00' }])
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/courts/${courtId}/blackouts`)
      .set('Cookie', adminCookie)
      .send({
        start: '2026-12-02T00:00:00.000Z',
        end: '2026-12-01T00:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/v1/courts/00000000-0000-4000-8000-000000000000')
      .set('Cookie', adminCookie)
      .send({ name: 'Ghost' })
      .expect(404);
  });
});

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  if (!raw) {
    throw new Error('missing set-cookie');
  }

  const first = Array.isArray(raw) ? raw[0] : raw;
  return first.split(';')[0];
}
