import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentStatus, Role } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const THURSDAY = '2026-09-24'; // weekday 4, in the future from BE-5 impl date

describe('BE-5 court bookings', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let memberCookie: string;
  let memberId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

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
        email: `member-book-${Date.now()}@example.com`,
        password: 'member-pass',
        name: 'Booking Member',
      })
      .expect(201);
    expect(register.body.role).toBe(Role.member);
    memberCookie = cookieHeader(register);
    memberId = register.body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('member books a free slot; overlap is CONFLICT; A12 back-to-back OK', async () => {
    const courtId = await seedCourtWithHours('Overlap Book Court', 4);

    const first = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T10:00:00.000Z`,
        end: `${THURSDAY}T11:00:00.000Z`,
      })
      .expect(201);
    expect(first.body).toMatchObject({
      courtId,
      userId: memberId,
      createdByAdminId: null,
      status: 'confirmed',
      paymentStatus: 'unpaid',
    });
    expect(first.body.blockId).toEqual(expect.any(String));

    const overlap = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T10:30:00.000Z`,
        end: `${THURSDAY}T11:30:00.000Z`,
      })
      .expect(409);
    expect(overlap.body.code).toBe('CONFLICT');

    const adjacent = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T11:00:00.000Z`,
        end: `${THURSDAY}T12:00:00.000Z`,
      })
      .expect(201);
    expect(adjacent.body.start).toBe(`${THURSDAY}T11:00:00.000Z`);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/bookings/mine')
      .set('Cookie', memberCookie)
      .expect(200);
    expect(mine.body.bookings).toHaveLength(2);

    const adminList = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .query({ courtId, date: THURSDAY })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(adminList.body.bookings).toHaveLength(2);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('Cookie', memberCookie)
      .expect(403);
  });

  it('cancel releases the time block so the slot can be rebooked', async () => {
    const courtId = await seedCourtWithHours('Cancel Free Court', 4);

    const booked = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T10:00:00.000Z`,
        end: `${THURSDAY}T11:00:00.000Z`,
      })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${booked.body.id}/cancel`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.blockId).toBeNull();
    expect(cancelled.body.paymentStatus).toBe('unpaid');

    expect(
      await prisma.courtTimeBlock.count({ where: { courtId } }),
    ).toBe(0);

    const rebook = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T10:00:00.000Z`,
        end: `${THURSDAY}T11:00:00.000Z`,
      })
      .expect(201);
    expect(rebook.body.status).toBe('confirmed');

    const mine = await request(app.getHttpServer())
      .get('/api/v1/bookings/mine')
      .set('Cookie', memberCookie)
      .expect(200);
    expect(
      mine.body.bookings.filter((b: { courtId: string }) => b.courtId === courtId),
    ).toHaveLength(1);

    const withCancelled = await request(app.getHttpServer())
      .get('/api/v1/bookings/mine')
      .query({ includeCancelled: 'true' })
      .set('Cookie', memberCookie)
      .expect(200);
    expect(
      withCancelled.body.bookings.filter(
        (b: { courtId: string }) => b.courtId === courtId,
      ),
    ).toHaveLength(2);
  });

  it('inside 2h window member cancel is FORBIDDEN; admin cancel OK and payment unchanged', async () => {
    const courtId = await seedAllWeekdays('Window Court');
    const start = soonSlotStart();
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const booked = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: start.toISOString(),
        end: end.toISOString(),
      })
      .expect(201);

    await prisma.payment.update({
      where: {
        subjectType_subjectId: {
          subjectType: 'booking',
          subjectId: booked.body.id,
        },
      },
      data: { status: PaymentStatus.paid },
    });

    const memberCancel = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${booked.body.id}/cancel`)
      .set('Cookie', memberCookie)
      .expect(403);
    expect(memberCancel.body.code).toBe('FORBIDDEN');
    expect(
      await prisma.courtTimeBlock.count({ where: { courtId } }),
    ).toBe(1);

    const adminCancel = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${booked.body.id}/cancel`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(adminCancel.body.status).toBe('cancelled');
    expect(adminCancel.body.paymentStatus).toBe('paid');
    expect(
      await prisma.courtTimeBlock.count({ where: { courtId } }),
    ).toBe(0);
  });

  it('inactive court is 403; off-grid start is 400; admin can book on behalf', async () => {
    const courtId = await seedCourtWithHours('Rules Court', 4);

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T10:10:00.000Z`,
        end: `${THURSDAY}T10:40:00.000Z`,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/courts/${courtId}`)
      .set('Cookie', adminCookie)
      .send({ active: false })
      .expect(200);

    const inactive = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId,
        start: `${THURSDAY}T10:00:00.000Z`,
        end: `${THURSDAY}T11:00:00.000Z`,
      })
      .expect(403);
    expect(inactive.body.code).toBe('FORBIDDEN');

    const other = await seedCourtWithHours('Behalf Court', 4);
    const onBehalf = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', adminCookie)
      .send({
        courtId: other,
        start: `${THURSDAY}T10:00:00.000Z`,
        end: `${THURSDAY}T11:00:00.000Z`,
        memberId,
      })
      .expect(201);
    expect(onBehalf.body.userId).toBe(memberId);
    expect(onBehalf.body.createdByAdminId).toEqual(expect.any(String));

    const hijack = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', memberCookie)
      .send({
        courtId: other,
        start: `${THURSDAY}T11:00:00.000Z`,
        end: `${THURSDAY}T12:00:00.000Z`,
        memberId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(403);
    expect(hijack.body.code).toBe('FORBIDDEN');
  });

  async function seedCourtWithHours(
    name: string,
    weekday: number,
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', adminCookie)
      .send({ name: `${name} ${Date.now()}` })
      .expect(201);
    const courtId = created.body.id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send([{ weekday, startLocal: '10:00', endLocal: '12:00' }])
      .expect(200);

    return courtId;
  }

  async function seedAllWeekdays(name: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/courts')
      .set('Cookie', adminCookie)
      .send({ name: `${name} ${Date.now()}` })
      .expect(201);
    const courtId = created.body.id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/courts/${courtId}/weekly-hours`)
      .set('Cookie', adminCookie)
      .send(
        [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          startLocal: '00:00',
          endLocal: '23:30',
        })),
      )
      .expect(200);

    return courtId;
  }
});

function soonSlotStart(): Date {
  const start = nextGrid(Date.now() + 45 * 60 * 1000);
  // 23:30 + 30m crosses the local day; occupancy requires a single day.
  if (start.getUTCHours() === 23 && start.getUTCMinutes() === 30) {
    return new Date(start.getTime() - 30 * 60 * 1000);
  }
  return start;
}

function nextGrid(fromMs: number): Date {
  const grid = 30 * 60 * 1000;
  return new Date(Math.ceil(fromMs / grid) * grid);
}

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  if (!raw) {
    throw new Error('missing set-cookie');
  }

  const first = Array.isArray(raw) ? raw[0] : raw;
  return first.split(';')[0];
}
