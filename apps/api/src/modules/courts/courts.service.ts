import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Court, CourtBlackout, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBlackoutDto,
  CreateCourtDto,
  CourtDto,
  UpdateCourtDto,
  WeeklyHourDto,
} from './dto/court.dto';

const DEACTIVATE_WARNING =
  'Court may have future holds; weekly hours and blackouts are kept.';

@Injectable()
export class CourtsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    role: Role,
    activeQuery?: 'true' | 'false',
  ): Promise<{ courts: Court[] }> {
    // Non-admins always see active courts only (ignore ?active=).
    const where =
      role === Role.admin
        ? activeQuery !== undefined
          ? { active: activeQuery === 'true' }
          : undefined
        : { active: true };

    const courts = await this.prisma.court.findMany({
      where,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return { courts };
  }

  async create(input: CreateCourtDto): Promise<Court> {
    return this.prisma.court.create({
      data: {
        name: input.name,
        active: input.active ?? true,
      },
    });
  }

  async update(id: string, input: UpdateCourtDto): Promise<CourtDto> {
    await this.requireCourt(id);

    const court = await this.prisma.court.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });

    if (input.active === false) {
      return { ...court, warning: DEACTIVATE_WARNING };
    }

    return court;
  }

  async getWeeklyHours(courtId: string): Promise<{ hours: WeeklyHourDto[] }> {
    await this.requireCourt(courtId);
    const rows = await this.prisma.courtWeeklyHour.findMany({
      where: { courtId },
      orderBy: { weekday: 'asc' },
    });

    return {
      hours: rows.map((row) => ({
        weekday: row.weekday,
        startLocal: row.startLocal,
        endLocal: row.endLocal,
      })),
    };
  }

  async replaceWeeklyHours(
    courtId: string,
    body: unknown,
  ): Promise<{ hours: WeeklyHourDto[] }> {
    await this.requireCourt(courtId);
    const hours = parseWeeklyHoursBody(body);

    await this.prisma.$transaction(async (tx) => {
      await tx.courtWeeklyHour.deleteMany({ where: { courtId } });
      if (hours.length === 0) {
        return;
      }
      await tx.courtWeeklyHour.createMany({
        data: hours.map((hour) => ({
          courtId,
          weekday: hour.weekday,
          startLocal: hour.startLocal,
          endLocal: hour.endLocal,
        })),
      });
    });

    return this.getWeeklyHours(courtId);
  }

  async listBlackouts(
    courtId: string,
  ): Promise<{ blackouts: CourtBlackout[] }> {
    await this.requireCourt(courtId);
    const blackouts = await this.prisma.courtBlackout.findMany({
      where: { courtId },
      orderBy: { start: 'asc' },
    });

    return { blackouts };
  }

  async createBlackout(
    courtId: string,
    input: CreateBlackoutDto,
  ): Promise<CourtBlackout> {
    await this.requireCourt(courtId);

    const start = new Date(input.start);
    const end = new Date(input.end);
    if (!(end > start)) {
      throw new BadRequestException('end must be after start');
    }

    return this.prisma.courtBlackout.create({
      data: {
        courtId,
        start,
        end,
        reason: input.reason?.length ? input.reason : null,
      },
    });
  }

  async deleteBlackout(courtId: string, blackoutId: string): Promise<void> {
    await this.requireCourt(courtId);
    const blackout = await this.prisma.courtBlackout.findFirst({
      where: { id: blackoutId, courtId },
    });
    if (!blackout) {
      throw new NotFoundException('Blackout not found');
    }

    await this.prisma.courtBlackout.delete({ where: { id: blackoutId } });
  }

  private async requireCourt(id: string): Promise<Court> {
    const court = await this.prisma.court.findUnique({ where: { id } });
    if (!court) {
      throw new NotFoundException('Court not found');
    }
    return court;
  }
}

function parseWeeklyHoursBody(body: unknown): WeeklyHourDto[] {
  const raw = Array.isArray(body)
    ? body
    : body &&
        typeof body === 'object' &&
        Array.isArray((body as { hours?: unknown }).hours)
      ? (body as { hours: unknown[] }).hours
      : null;

  if (raw === null) {
    throw new BadRequestException(
      'Body must be an array of hours or { hours: [...] }',
    );
  }

  const weekdays = new Set<number>();
  const hours: WeeklyHourDto[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      throw new BadRequestException('Each hour entry must be an object');
    }
    const entry = item as Record<string, unknown>;
    const weekday = Number(entry.weekday);
    const startLocal = normalizeLocalTime(entry.startLocal);
    const endLocal = normalizeLocalTime(entry.endLocal);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new BadRequestException('weekday must be an integer 0-6');
    }
    if (weekdays.has(weekday)) {
      throw new BadRequestException(`Duplicate weekday ${weekday}`);
    }
    if (!startLocal) {
      throw new BadRequestException('startLocal must be HH:mm');
    }
    if (!endLocal) {
      throw new BadRequestException('endLocal must be HH:mm');
    }
    if (!(startLocal < endLocal)) {
      throw new BadRequestException(
        'startLocal must be before endLocal (no overnight)',
      );
    }

    weekdays.add(weekday);
    hours.push({ weekday, startLocal, endLocal });
  }

  return hours;
}

function normalizeLocalTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  const withSeconds = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(trimmed);
  if (!withSeconds) {
    return null;
  }
  return `${withSeconds[1]}:${withSeconds[2]}`;
}
