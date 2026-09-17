import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.constants';
import {
  AvailabilityQueryDto,
  AvailabilityResponseDto,
} from './dto/availability.dto';
import { OccupancyService } from './occupancy.service';

@ApiTags('availability')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired session' })
@Controller('availability')
export class OccupancyController {
  constructor(private readonly occupancy: OccupancyService) {}

  @Get()
  @ApiOperation({
    summary: 'Free 30-minute slots for a court on a club-local calendar date',
  })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown courtId' })
  get(
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    return this.occupancy.getAvailability(query.courtId, query.date);
  }
}
