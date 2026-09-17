import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Court,
  CourtTimeBlock,
  Prisma,
  PrismaClient,
  TimeBlockKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SLOT_MINUTES } from './occupancy.constants';

export type OccupancyDb = Prisma.TransactionClient | PrismaClient;

export type InsertBlockInput = {
  courtId: string;
  start: Date;
  end: Date;
  kind: TimeBlockKind;
  refId?: string | null;
};

export type AvailabilitySlot = { start: string; end: string };

export type AvailabilityResult = {
  courtId: string;
  date: string;
  timezone: string;
  slotMinutes: number;
  slots: AvailabilitySlot[];
};

@Injectable()
export class OccupancyService {
  constructor(private readonly prisma: PrismaService) {}

  async insertBlock(
    tx: OccupancyDb,
    input: InsertBlockInput,
  ): Promise<CourtTimeBlock> {
    this.requireRange(input.start, input.end);
    await this.assertBookable(input.courtId, input.start, input.end, tx);

    try {
      return await tx.courtTimeBlock.create({
        data: {
          courtId: input.courtId,
          start: input.start,
          end: input.end,
          kind: input.kind,
          refId: input.refId ?? null,
        },
      });
    } catch (error: unknown) {
      if (isOverlapConflict(error)) {
        throw new ConflictException('Time range overlaps an existing block');
      }
      throw error;
    }
  }

  async assertBookable(
    courtId: string,
    start: Date,
    end: Date,
    tx: OccupancyDb = this.prisma,
  ): Promise<void> {
    this.requireRange(start, end);
    const court = await this.requireCourt(courtId, tx);
    if (!court.active) {
      throw new BadRequestException('Court is not active');
    }

    const timezone = await this.clubTimezone(tx);
    const startDay = localYmd(start, timezone);
    const endDay = localYmd(end, timezone);
    const endParts = zonedParts(end, timezone);
    const endsAtMidnight =
      endParts.hour === 0 && endParts.minute === 0 && endParts.second === 0;
    const sameDay =
      startDay === endDay || (endsAtMidnight && addOneDay(startDay) === endDay);
    if (!sameDay) {
      throw new BadRequestException('Range must fall on a single local day');
    }

    const weekday = weekdayOfYmd(startDay);
    const hours = await tx.courtWeeklyHour.findUnique({
      where: { courtId_weekday: { courtId, weekday } },
    });
    if (!hours) {
      throw new BadRequestException('Court is closed on this day');
    }

    const { year, month, day } = parseYmd(startDay);
    const [openH, openM] = hm(hours.startLocal);
    const [closeH, closeM] = hm(hours.endLocal);
    const openStart = zonedTimeToUtc(timezone, year, month, day, openH, openM);
    const openEnd = zonedTimeToUtc(timezone, year, month, day, closeH, closeM);
    if (start < openStart || end > openEnd) {
      throw new BadRequestException('Range is outside weekly hours');
    }

    const blackout = await tx.courtBlackout.findFirst({
      where: { courtId, start: { lt: end }, end: { gt: start } },
    });
    if (blackout) {
      throw new BadRequestException('Range overlaps a blackout');
    }
  }

  async listBlocks(
    courtId: string,
    from: Date,
    to: Date,
  ): Promise<CourtTimeBlock[]> {
    return this.prisma.courtTimeBlock.findMany({
      where: { courtId, start: { lt: to }, end: { gt: from } },
      orderBy: { start: 'asc' },
    });
  }

  async computeAvailability(
    courtId: string,
    localDate: string,
  ): Promise<AvailabilitySlot[]> {
    const ymd = parseYmd(localDate);
    const court = await this.requireCourt(courtId);
    if (!court.active) {
      return [];
    }

    const timezone = await this.clubTimezone();
    const hours = await this.prisma.courtWeeklyHour.findUnique({
      where: {
        courtId_weekday: { courtId, weekday: weekdayOfYmd(localDate) },
      },
    });
    if (!hours) {
      return [];
    }

    const [openH, openM] = hm(hours.startLocal);
    const [closeH, closeM] = hm(hours.endLocal);
    const openStart = zonedTimeToUtc(
      timezone,
      ymd.year,
      ymd.month,
      ymd.day,
      openH,
      openM,
    );
    const openEnd = zonedTimeToUtc(
      timezone,
      ymd.year,
      ymd.month,
      ymd.day,
      closeH,
      closeM,
    );

    const [blackouts, blocks] = await Promise.all([
      this.prisma.courtBlackout.findMany({
        where: { courtId, start: { lt: openEnd }, end: { gt: openStart } },
      }),
      this.prisma.courtTimeBlock.findMany({
        where: { courtId, start: { lt: openEnd }, end: { gt: openStart } },
      }),
    ]);

    const busy = [...blackouts, ...blocks].map((row) => ({
      start: row.start.getTime(),
      end: row.end.getTime(),
    }));

    const slots: AvailabilitySlot[] = [];
    const startMin = toMinutes(hours.startLocal);
    const endMin = toMinutes(hours.endLocal);
    for (let minutes = startMin; minutes + SLOT_MINUTES <= endMin; minutes += SLOT_MINUTES) {
      const slotStart = zonedTimeToUtc(
        timezone,
        ymd.year,
        ymd.month,
        ymd.day,
        Math.floor(minutes / 60),
        minutes % 60,
      );
      const slotEnd = zonedTimeToUtc(
        timezone,
        ymd.year,
        ymd.month,
        ymd.day,
        Math.floor((minutes + SLOT_MINUTES) / 60),
        (minutes + SLOT_MINUTES) % 60,
      );
      const from = slotStart.getTime();
      const to = slotEnd.getTime();
      if (busy.some((b) => from < b.end && b.start < to)) {
        continue;
      }
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
    }

    return slots;
  }

  async getAvailability(
    courtId: string,
    date: string,
  ): Promise<AvailabilityResult> {
    parseYmd(date);
    const timezone = await this.clubTimezone();
    const slots = await this.computeAvailability(courtId, date);
    return {
      courtId,
      date,
      timezone,
      slotMinutes: SLOT_MINUTES,
      slots,
    };
  }

  private requireRange(start: Date, end: Date): void {
    if (!(end > start)) {
      throw new BadRequestException('end must be after start');
    }
  }

  private async requireCourt(
    id: string,
    tx: OccupancyDb = this.prisma,
  ): Promise<Court> {
    const court = await tx.court.findUnique({ where: { id } });
    if (!court) {
      throw new NotFoundException('Court not found');
    }
    return court;
  }

  private async clubTimezone(tx: OccupancyDb = this.prisma): Promise<string> {
    const settings = await tx.clubSettings.findUnique({
      where: { id: 1 },
    });
    if (!settings) {
      throw new NotFoundException('Club settings are not initialized');
    }
    return settings.timezone;
  }
}

function isOverlapConflict(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const rec = current as {
      code?: unknown;
      message?: unknown;
      meta?: { constraint?: unknown };
      cause?: unknown;
    };
    if (rec.code === '23P01') {
      return true;
    }
    if (
      typeof rec.meta?.constraint === 'string' &&
      rec.meta.constraint.includes('court_time_blocks_no_overlap')
    ) {
      return true;
    }
    if (
      typeof rec.message === 'string' &&
      (rec.message.includes('court_time_blocks_no_overlap') ||
        rec.message.includes('23P01'))
    ) {
      return true;
    }
    current = rec.cause;
  }
  return false;
}

function parseYmd(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new BadRequestException('date must be YYYY-MM-DD');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new BadRequestException('date must be YYYY-MM-DD');
  }
  return { year, month, day };
}

function weekdayOfYmd(ymd: string): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function addOneDay(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function hm(hhmm: string): [number, number] {
  const [hour, minute] = hhmm.split(':').map(Number);
  return [hour, minute];
}

function toMinutes(hhmm: string): number {
  const [hour, minute] = hm(hhmm);
  return hour * 60 + minute;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  let hour = Number(map.hour);
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function localYmd(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    date.getTime()
  );
}

function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = tzOffsetMs(new Date(utcGuess), timeZone);
  const instant = new Date(utcGuess - offset);
  const offset2 = tzOffsetMs(instant, timeZone);
  if (offset2 !== offset) {
    return new Date(utcGuess - offset2);
  }
  return instant;
}
