import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OccupancyModule } from '../occupancy/occupancy.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, OccupancyModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
