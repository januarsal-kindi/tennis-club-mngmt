import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';
import { SLOT_MINUTES } from '../occupancy.constants';

export class AvailabilityQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  courtId!: string;

  @ApiProperty({
    example: '2026-09-17',
    description: 'Local calendar date in club timezone (YYYY-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}

export class AvailabilitySlotDto {
  @ApiProperty({ example: '2026-09-17T14:00:00.000Z' })
  start!: string;

  @ApiProperty({ example: '2026-09-17T14:30:00.000Z' })
  end!: string;
}

export class AvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  courtId!: string;

  @ApiProperty({ example: '2026-09-17' })
  date!: string;

  @ApiProperty({ example: 'America/New_York' })
  timezone!: string;

  @ApiProperty({
    example: SLOT_MINUTES,
    description: 'Atomic slot length in minutes (default 30)',
  })
  slotMinutes!: number;

  @ApiProperty({ type: [AvailabilitySlotDto] })
  slots!: AvailabilitySlotDto[];
}
