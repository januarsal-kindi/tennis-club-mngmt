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
