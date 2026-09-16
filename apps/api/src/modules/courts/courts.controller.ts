import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { CourtsService } from './courts.service';
import {
  BlackoutDto,
  CreateBlackoutDto,
  CreateCourtDto,
  CourtDto,
  ListCourtsQueryDto,
  UpdateCourtDto,
  WeeklyHourDto,
} from './dto/court.dto';

@ApiTags('courts')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired session' })
@Controller('courts')
export class CourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Get()
  @ApiOperation({ summary: 'List courts (members/coaches: active only by default)' })
  @ApiOkResponse({ description: '{ courts: Court[] }' })
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListCourtsQueryDto,
  ): Promise<{ courts: CourtDto[] }> {
    return this.courts.list(req.user.role, query.active);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a court (admin)' })
  @ApiCreatedResponse({ type: CourtDto })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  create(@Body() input: CreateCourtDto): Promise<CourtDto> {
    return this.courts.create(input);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update court name/active (admin)' })
  @ApiOkResponse({ type: CourtDto })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCourtDto,
  ): Promise<CourtDto> {
    return this.courts.update(id, input);
  }

  @Get(':id/weekly-hours')
  @ApiOperation({ summary: 'Get weekly hours for a court' })
  @ApiOkResponse({ description: '{ hours: WeeklyHour[] }' })
  getWeeklyHours(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ hours: WeeklyHourDto[] }> {
    return this.courts.getWeeklyHours(id);
  }

  @Put(':id/weekly-hours')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({
    summary: 'Replace weekly hours (admin). Accepts raw array or { hours }',
  })
  @ApiOkResponse({ description: '{ hours: WeeklyHour[] }' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  putWeeklyHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<{ hours: WeeklyHourDto[] }> {
    return this.courts.replaceWeeklyHours(id, body);
  }

  @Get(':id/blackouts')
  @ApiOperation({ summary: 'List blackouts for a court' })
  @ApiOkResponse({ description: '{ blackouts: Blackout[] }' })
  listBlackouts(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ blackouts: BlackoutDto[] }> {
    return this.courts.listBlackouts(id);
  }

  @Post(':id/blackouts')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a blackout (admin)' })
  @ApiCreatedResponse({ type: BlackoutDto })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  createBlackout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateBlackoutDto,
  ): Promise<BlackoutDto> {
    return this.courts.createBlackout(id, input);
  }

  @Delete(':id/blackouts/:blackoutId')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a blackout (admin)' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  async deleteBlackout(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('blackoutId', ParseUUIDPipe) blackoutId: string,
  ): Promise<void> {
    await this.courts.deleteBlackout(id, blackoutId);
  }
}
