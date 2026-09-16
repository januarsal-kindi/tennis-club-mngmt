import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_TTL_MS } from './auth.constants';
import { LoginDto, RegisterDto } from './dto/register.dto';

const scryptAsync = promisify(scrypt);
const SCRYPT_KEYLEN = 64;

export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'createdAt'>;

export interface AuthenticatedSession {
  user: PublicUser;
  sessionId: string;
}

const INVALID_CREDENTIALS = 'Invalid credentials';
const AUTH_REQUIRED = 'Authentication is required';

// ponytail: one dummy scrypt hash so unknown-email logins take a similar path
let dummyPasswordHash: string | undefined;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.getOrThrow<string>('ADMIN_EMAIL').trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return;
    }

    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
    const name = this.config.getOrThrow<string>('ADMIN_NAME');
    await this.prisma.user.create({
      data: {
        email,
        name,
        role: Role.admin,
        passwordHash: await hashPassword(password),
      },
    });
    this.logger.log(`Seeded admin user ${email}`);
  }

  async register(input: RegisterDto): Promise<{ user: PublicUser; token: string }> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: Role.member,
          passwordHash: await hashPassword(input.password),
        },
        select: publicUserSelect,
      });

      return this.issueSession(user);
    } catch (error: unknown) {
      if (isEmailConflict(error)) {
        throw new ConflictException('Email is unavailable');
      }
      throw error;
    }
  }

  async login(input: LoginDto): Promise<{ user: PublicUser; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...publicUserSelect,
        passwordHash: true,
      },
    });

    const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
    const passwordMatches = await verifyPassword(input.password, passwordHash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.issueSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  async authenticate(token: string | undefined): Promise<AuthenticatedSession> {
    if (!token) {
      throw new UnauthorizedException(AUTH_REQUIRED);
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: { select: publicUserSelect },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      throw new UnauthorizedException(AUTH_REQUIRED);
    }

    return { user: session.user, sessionId: session.id };
  }

  private async issueSession(
    user: PublicUser,
  ): Promise<{ user: PublicUser; token: string }> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    return { user, token };
  }
}

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

async function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= await hashPassword('timing-dummy');
  return dummyPasswordHash;
}

function isEmailConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
