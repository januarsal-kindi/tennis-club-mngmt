import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ClubSettingsModule } from './modules/club-settings/club-settings.module';
import { CourtsModule } from './modules/courts/courts.module';
import { HealthModule } from './modules/health/health.module';
import { OccupancyModule } from './modules/occupancy/occupancy.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ClubSettingsModule,
    CourtsModule,
    OccupancyModule,
    BookingsModule,
  ],
})
export class AppModule {}
