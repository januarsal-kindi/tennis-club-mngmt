import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';
import { BookingsService } from './bookings.service';
import {
  AdminBookingsQueryDto,
  BookingDto,
  CreateBookingDto,
  MineBookingsQueryDto,
} from './dto/booking.dto';

@ApiTags('bookings')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired session' })
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('bookings')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Book a court (member/coach self, or admin with memberId on behalf)',
  })
  @ApiCreatedResponse({ type: BookingDto })
  @ApiConflictResponse({ description: 'Time range overlaps an existing block' })
  @ApiForbiddenResponse({ description: 'Inactive court or wrong role' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateBookingDto,
  ): Promise<BookingDto> {
    return this.bookings.create(req.user, input);
  }

  @Get('bookings/mine')
  @ApiOperation({ summary: 'List the caller\'s bookings' })
  @ApiOkResponse({ description: '{ bookings: BookingDto[] }' })
  listMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: MineBookingsQueryDto,
  ): Promise<{ bookings: BookingDto[] }> {
    return this.bookings.listMine(req.user.id, query.includeCancelled);
  }

  @Get('admin/bookings')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'List bookings (admin); optional courtId and date' })
  @ApiOkResponse({ description: '{ bookings: BookingDto[] }' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  listAdmin(
    @Query() query: AdminBookingsQueryDto,
  ): Promise<{ bookings: BookingDto[] }> {
    return this.bookings.listAdmin(query);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Cancel a booking (booker if ≥2h before start; otherwise admin only)',
  })
  @ApiOkResponse({ type: BookingDto })
  @ApiForbiddenResponse({ description: 'Outside cancel window or not owner' })
  @ApiConflictResponse({ description: 'Booking is already cancelled' })
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingDto> {
    return this.bookings.cancel(req.user, id);
  }
}
