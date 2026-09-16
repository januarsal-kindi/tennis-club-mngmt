import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CourtDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Center Court' })
  name!: string;

  @ApiProperty({ example: true })
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Present when deactivating (A11 stub until bookings exist)',
  })
  warning?: string;
}

export class CreateCourtDto {
  @ApiProperty({ example: 'Center Court' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCourtDto {
  @ApiPropertyOptional({ example: 'Center Court' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListCourtsQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  @Matches(/^(true|false)$/)
  active?: 'true' | 'false';
}

export class WeeklyHourDto {
  @ApiProperty({ example: 1, description: '0=Sunday … 6=Saturday' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '08:00' })
  @Transform(({ value }) => normalizeHour(value))
  @IsString()
  @Matches(HH_MM, { message: 'startLocal must be HH:mm' })
  startLocal!: string;

  @ApiProperty({ example: '21:00' })
  @Transform(({ value }) => normalizeHour(value))
  @IsString()
  @Matches(HH_MM, { message: 'endLocal must be HH:mm' })
  endLocal!: string;
}

export class CreateBlackoutDto {
  @ApiProperty({ example: '2026-09-20T00:00:00.000Z' })
  @IsDateString()
  start!: string;

  @ApiProperty({ example: '2026-09-21T00:00:00.000Z' })
  @IsDateString()
  end!: string;

  @ApiPropertyOptional({ example: 'Resurfacing' })
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(0, 500)
  reason?: string;
}

export class BlackoutDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  courtId!: string;

  @ApiProperty()
  start!: Date;

  @ApiProperty()
  end!: Date;

  @ApiPropertyOptional()
  reason?: string | null;
}

export { HH_MM };

function normalizeHour(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : value.trim();
}
