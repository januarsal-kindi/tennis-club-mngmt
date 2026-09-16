import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SESSION_COOKIE } from './auth.constants';
import type { PublicUser } from './auth.service';
import { PublicUserDto } from './dto/public-user.dto';
import { type AuthenticatedRequest } from './guards/session-auth.guard';

@ApiTags('me')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Return the current authenticated user, including role' })
  @ApiOkResponse({ type: PublicUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired session' })
  me(@Req() request: AuthenticatedRequest): PublicUser {
    return request.user;
  }
}
