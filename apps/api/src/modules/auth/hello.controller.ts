import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SESSION_COOKIE } from './auth.constants';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { type AuthenticatedRequest } from './guards/session-auth.guard';

@ApiTags('hello')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired session' })
@Controller()
export class HelloController {
  @Get('hello')
  @ApiOperation({ summary: 'Role-gated hello (any authenticated role)' })
  @ApiOkResponse({ description: 'Greeting with the caller role' })
  hello(@Req() request: AuthenticatedRequest): { message: string; role: Role } {
    return { message: 'hello', role: request.user.role };
  }

  @Get('admin/hello')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin-only hello' })
  @ApiOkResponse({ description: 'Admin greeting' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  adminHello(): { message: string } {
    return { message: 'admin hello' };
  }
}
