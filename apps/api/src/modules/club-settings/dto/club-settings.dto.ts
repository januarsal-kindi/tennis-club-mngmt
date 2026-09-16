import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'ianaTimeZone', async: false })
class IanaTimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isIanaTimeZone(value);
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA time zone';
  }
}

export function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export class ClubSettingsDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Tennis Club' })
  name!: string;

  @ApiProperty({ example: 'America/New_York' })
  timezone!: string;

  @ApiProperty({ example: 1, description: '0=Sunday, 1=Monday' })
  weekStart!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UpdateClubSettingsDto {
  @ApiPropertyOptional({ example: 'Tennis Club' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  @Validate(IanaTimeZoneConstraint)
  timezone?: string;

  @ApiPropertyOptional({ example: 1, description: '0=Sunday, 1=Monday' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  weekStart?: number;
}
