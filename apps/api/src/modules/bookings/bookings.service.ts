import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CourtBooking,
  PaymentStatus,
  PaymentSubjectType,
  Prisma,
  Role,
  TimeBlockKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublicUser } from '../auth/auth.service';
import { OccupancyService } from '../occupancy/occupancy.service';
import { CANCEL_WINDOW_MS, SLOT_MINUTES } from './bookings.constants';
import {
  AdminBookingsQueryDto,
  BookingDto,
  CreateBookingDto,
} from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly occupancy: OccupancyService,
  ) {}

  async create(actor: PublicUser, input: CreateBookingDto): Promise<BookingDto> {
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (!(end > start)) {
      throw new BadRequestException('end must be after start');
    }

    const { userId, createdByAdminId } = await this.resolveBooker(
      actor,
      input.memberId,
    );
    const timezone = await this.clubTimezone();
    assertSlotGrid(start, end, timezone);

    const bookingId = randomUUID();

    const { booking, paymentStatus } = await this.prisma.$transaction(
      async (tx) => {
        const court = await tx.court.findUnique({
          where: { id: input.courtId },
        });
        if (!court) {
          throw new NotFoundException('Court not found');
        }
        if (!court.active) {
          throw new ForbiddenException('Court is not active');
        }

        const block = await this.occupancy.insertBlock(tx, {
          courtId: input.courtId,
          start,
          end,
          kind: TimeBlockKind.booking,
          refId: bookingId,
        });

        const created = await tx.courtBooking.create({
          data: {
            id: bookingId,
            courtId: input.courtId,
            userId,
            blockId: block.id,
            start,
            end,
            createdByAdminId,
            status: BookingStatus.confirmed,
          },
        });

        const payment = await tx.payment.create({
          data: {
            subjectType: PaymentSubjectType.booking,
            subjectId: created.id,
            status: PaymentStatus.unpaid,
          },
        });

        return { booking: created, paymentStatus: payment.status };
      },
    );

    return toBookingDto(booking, paymentStatus);
  }

  async listMine(
    userId: string,
    includeCancelled?: 'true' | 'false',
  ): Promise<{ bookings: BookingDto[] }> {
    const bookings = await this.prisma.courtBooking.findMany({
      where: {
        userId,
        ...(includeCancelled === 'true'
          ? {}
          : { status: BookingStatus.confirmed }),
      },
      orderBy: [{ start: 'asc' }, { createdAt: 'asc' }],
    });

    return { bookings: await this.withPayments(bookings) };
  }

  async listAdmin(
    query: AdminBookingsQueryDto,
  ): Promise<{ bookings: BookingDto[] }> {
    const where: Prisma.CourtBookingWhereInput = {};
    if (query.courtId) {
      where.courtId = query.courtId;
    }
    if (query.date) {
      const timezone = await this.clubTimezone();
      const { start, end } = localDayRange(query.date, timezone);
      where.start = { lt: end };
      where.end = { gt: start };
    }

    const bookings = await this.prisma.courtBooking.findMany({
      where,
      orderBy: [{ start: 'asc' }, { createdAt: 'asc' }],
    });

    return { bookings: await this.withPayments(bookings) };
  }

  async cancel(actor: PublicUser, id: string): Promise<BookingDto> {
    const booking = await this.prisma.courtBooking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === BookingStatus.cancelled) {
      throw new ConflictException('Booking is already cancelled');
    }

    const isOwner = booking.userId === actor.id;
    const isAdmin = actor.role === Role.admin;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Cannot cancel another user\'s booking');
    }
    if (!isAdmin && Date.now() > booking.start.getTime() - CANCEL_WINDOW_MS) {
      throw new ForbiddenException(
        'Bookings can only be cancelled at least 2 hours before start',
      );
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.courtBooking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.cancelled, blockId: null },
      });
      if (booking.blockId) {
        await tx.courtTimeBlock.delete({ where: { id: booking.blockId } });
      }
      return updated;
    });

    const payment = await this.prisma.payment.findUnique({
      where: {
        subjectType_subjectId: {
          subjectType: PaymentSubjectType.booking,
          subjectId: cancelled.id,
        },
      },
    });

    return toBookingDto(cancelled, payment?.status ?? PaymentStatus.unpaid);
  }

  private async resolveBooker(
    actor: PublicUser,
    memberId: string | undefined,
  ): Promise<{ userId: string; createdByAdminId: string | null }> {
    if (actor.role === Role.admin && memberId && memberId !== actor.id) {
      const member = await this.prisma.user.findUnique({
        where: { id: memberId },
      });
      if (!member) {
        throw new NotFoundException('Member not found');
      }
      return { userId: member.id, createdByAdminId: actor.id };
    }
    if (memberId && memberId !== actor.id) {
      throw new ForbiddenException('Cannot book on behalf of another user');
    }
    return { userId: actor.id, createdByAdminId: null };
  }

  private async withPayments(bookings: CourtBooking[]): Promise<BookingDto[]> {
    if (bookings.length === 0) {
      return [];
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        subjectType: PaymentSubjectType.booking,
        subjectId: { in: bookings.map((b) => b.id) },
      },
    });
    const bySubject = new Map(payments.map((p) => [p.subjectId, p.status]));

    return bookings.map((booking) =>
      toBookingDto(
        booking,
        bySubject.get(booking.id) ?? PaymentStatus.unpaid,
      ),
    );
  }

  private async clubTimezone(): Promise<string> {
    const settings = await this.prisma.clubSettings.findUnique({
      where: { id: 1 },
    });
    if (!settings) {
      throw new NotFoundException('Club settings are not initialized');
    }
    return settings.timezone;
  }
}

function toBookingDto(
  booking: CourtBooking,
  paymentStatus: PaymentStatus,
): BookingDto {
  return {
    id: booking.id,
    courtId: booking.courtId,
    userId: booking.userId,
    blockId: booking.blockId,
    start: booking.start,
    end: booking.end,
    createdByAdminId: booking.createdByAdminId,
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    paymentStatus,
  };
}

function assertSlotGrid(start: Date, end: Date, timeZone: string): void {
  if (!onSlotGrid(start, timeZone) || !onSlotGrid(end, timeZone)) {
    throw new BadRequestException(
      'start and end must align to the 30-minute grid',
    );
  }
}

function onSlotGrid(date: Date, timeZone: string): boolean {
  if (date.getUTCMilliseconds() !== 0) {
    return false;
  }
  const parts = zonedParts(date, timeZone);
  return parts.second === 0 && parts.minute % SLOT_MINUTES === 0;
}

function localDayRange(
  ymd: string,
  timeZone: string,
): { start: Date; end: Date } {
  const { year, month, day } = parseYmd(ymd);
  const start = zonedTimeToUtc(timeZone, year, month, day, 0, 0);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedTimeToUtc(
    timeZone,
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
  );
  return { start, end };
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
