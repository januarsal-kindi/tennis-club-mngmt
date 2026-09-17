import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  courtId!: string;

  @ApiProperty({
    example: '2026-09-24T10:00:00.000Z',
    description: 'ISO8601 instant on the 30-minute grid',
  })
  @IsDateString()
  start!: string;

  @ApiProperty({
    example: '2026-09-24T11:00:00.000Z',
    description: 'ISO8601 instant on the 30-minute grid (exclusive end)',
  })
  @IsDateString()
  end!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Admin book-on-behalf of this member',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}

export class BookingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  courtId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  blockId!: string | null;

  @ApiProperty()
  start!: Date;

  @ApiProperty()
  end!: Date;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdByAdminId!: string | null;

  @ApiProperty({ enum: BookingStatus })
  status!: BookingStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;
}

export class MineBookingsQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @Matches(/^(true|false)$/)
  includeCancelled?: 'true' | 'false';
}

export class AdminBookingsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiPropertyOptional({
    example: '2026-09-24',
    description: 'Local calendar date in club timezone (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
