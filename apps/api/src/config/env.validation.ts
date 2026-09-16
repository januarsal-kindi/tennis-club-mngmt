import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  FRONTEND_ORIGIN: Joi.string().default('http://localhost:3000'),
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).max(128).required(),
  ADMIN_NAME: Joi.string().min(1).max(80).default('Admin'),
  CLUB_NAME: Joi.string().min(1).max(100).default('Tennis Club'),
  CLUB_TIMEZONE: Joi.string().min(1).default('America/New_York'),
  CLUB_WEEK_START: Joi.number().valid(0, 1).default(1),
});
