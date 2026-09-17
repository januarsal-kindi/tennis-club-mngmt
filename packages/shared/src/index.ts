import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'coach', 'member']);
export type Role = z.infer<typeof roleSchema>;

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().min(1).max(80),
});

export const clubSettingsSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ClubSettings = z.infer<typeof clubSettingsSchema>;

export const updateClubSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
  weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
});

const hhMm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm');

export const weekdaySchema = z.number().int().min(0).max(6);
export type Weekday = z.infer<typeof weekdaySchema>;

export const courtSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  warning: z.string().optional(),
});
export type Court = z.infer<typeof courtSchema>;

export const createCourtSchema = z.object({
  name: z.string().min(1).max(100),
  active: z.boolean().optional(),
});

export const updateCourtSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

export const weeklyHourSchema = z
  .object({
    weekday: weekdaySchema,
    startLocal: hhMm,
    endLocal: hhMm,
  })
  .refine((h) => h.startLocal < h.endLocal, {
    message: 'startLocal must be before endLocal',
    path: ['endLocal'],
  });
export type WeeklyHour = z.infer<typeof weeklyHourSchema>;

export const blackoutSchema = z.object({
  id: z.string().uuid(),
  courtId: z.string().uuid(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  reason: z.string().nullable().optional(),
});
export type Blackout = z.infer<typeof blackoutSchema>;

export const createBlackoutSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    reason: z.string().max(500).optional(),
  })
  .refine((b) => new Date(b.end) > new Date(b.start), {
    message: 'end must be after start',
    path: ['end'],
  });

export const timeBlockKindSchema = z.enum(['booking', 'session']);
export type TimeBlockKind = z.infer<typeof timeBlockKindSchema>;

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const availabilityQuerySchema = z.object({
  courtId: z.string().uuid(),
  date: ymd,
});

export const availabilitySlotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilityResponseSchema = z.object({
  courtId: z.string().uuid(),
  date: ymd,
  timezone: z.string().min(1),
  slotMinutes: z.literal(30),
  slots: z.array(availabilitySlotSchema),
});
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

export const bookingStatusSchema = z.enum(['confirmed', 'cancelled']);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const paymentStatusSchema = z.enum([
  'unpaid',
  'pending_verification',
  'paid',
  'waived',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentSubjectTypeSchema = z.enum(['booking', 'enrollment']);
export type PaymentSubjectType = z.infer<typeof paymentSubjectTypeSchema>;

export const createBookingSchema = z
  .object({
    courtId: z.string().uuid(),
    start: z.string().datetime(),
    end: z.string().datetime(),
    memberId: z.string().uuid().optional(),
  })
  .refine((b) => new Date(b.end) > new Date(b.start), {
    message: 'end must be after start',
    path: ['end'],
  });
export type CreateBooking = z.infer<typeof createBookingSchema>;

export const courtBookingSchema = z.object({
  id: z.string().uuid(),
  courtId: z.string().uuid(),
  userId: z.string().uuid(),
  blockId: z.string().uuid().nullable(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  createdByAdminId: z.string().uuid().nullable(),
  status: bookingStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  paymentStatus: paymentStatusSchema,
});
export type CourtBooking = z.infer<typeof courtBookingSchema>;

export const mineBookingsQuerySchema = z.object({
  includeCancelled: z.enum(['true', 'false']).optional(),
});

export const adminBookingsQuerySchema = z.object({
  courtId: z.string().uuid().optional(),
  date: ymd.optional(),
});
