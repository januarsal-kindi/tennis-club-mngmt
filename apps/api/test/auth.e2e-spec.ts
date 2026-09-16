import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BE-2 auth, roles, club settings', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('GET /me without a session is 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('seeded admin can login, GET /me returns admin, timezone persists, role gates work', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'changeme-admin' })
      .expect(200);

    expect(login.body.role).toBe(Role.admin);
    const adminCookie = cookieHeader(login);

    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(me.body).toMatchObject({
      email: 'admin@example.com',
      role: Role.admin,
    });

    await request(app.getHttpServer())
      .get('/api/v1/hello')
      .set('Cookie', adminCookie)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ message: 'hello', role: Role.admin });
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/hello')
      .set('Cookie', adminCookie)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ message: 'admin hello' });
      });

    await request(app.getHttpServer())
      .patch('/api/v1/club-settings')
      .set('Cookie', adminCookie)
      .send({ timezone: 'America/Los_Angeles', weekStart: 0, name: 'Westside Club' })
      .expect(200);

    const settings = await request(app.getHttpServer())
      .get('/api/v1/club-settings')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(settings.body).toMatchObject({
      timezone: 'America/Los_Angeles',
      weekStart: 0,
      name: 'Westside Club',
    });

    const persisted = await prisma.clubSettings.findUnique({ where: { id: 1 } });
    expect(persisted?.timezone).toBe('America/Los_Angeles');

    const memberEmail = `member-${Date.now()}@example.com`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: memberEmail,
        password: 'member-pass',
        name: 'Ada Member',
      })
      .expect(201);
    expect(register.body.role).toBe(Role.member);
    const memberCookie = cookieHeader(register);

    const memberHello = await request(app.getHttpServer())
      .get('/api/v1/admin/hello')
      .set('Cookie', memberCookie)
      .expect(403);
    expect(memberHello.body.code).toBe('FORBIDDEN');

    await request(app.getHttpServer())
      .patch('/api/v1/club-settings')
      .set('Cookie', memberCookie)
      .send({ timezone: 'Europe/Paris' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/v1/club-settings')
      .set('Cookie', adminCookie)
      .send({ timezone: 'Not/AZone' })
      .expect(400);
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
