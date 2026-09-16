import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
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
import { ClubSettingsService } from './club-settings.service';
import { ClubSettingsDto, UpdateClubSettingsDto } from './dto/club-settings.dto';

@ApiTags('club-settings')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired session' })
@Controller('club-settings')
export class ClubSettingsController {
  constructor(private readonly clubSettings: ClubSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the single club_settings row' })
  @ApiOkResponse({ type: ClubSettingsDto })
  get(): Promise<ClubSettingsDto> {
    return this.clubSettings.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update club name, timezone, or week start (admin)' })
  @ApiOkResponse({ type: ClubSettingsDto })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  patch(@Body() input: UpdateClubSettingsDto): Promise<ClubSettingsDto> {
    return this.clubSettings.update(input);
  }
}
