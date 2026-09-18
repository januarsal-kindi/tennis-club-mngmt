import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthService, type PublicUser } from './auth.service';
import { PublicUserDto } from './dto/public-user.dto';
import { LoginDto, RegisterDto } from './dto/register.dto';
import { Public } from './guards/public.decorator';

@ApiTags('auth')
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a member and establish a session' })
  @ApiCreatedResponse({
    description: 'User created; tc_session HttpOnly cookie set',
    type: PublicUserDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid email, name, or password' })
  @ApiConflictResponse({ description: 'Email is unavailable' })
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const result = await this.auth.register(input);
    this.cookies.setSession(response, result.token);

    return result.user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and establish a session' })
  @ApiOkResponse({
    description: 'Signed in; tc_session HttpOnly cookie set',
    type: PublicUserDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid email or password' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const result = await this.auth.login(input);
    this.cookies.setSession(response, result.token);

    return result.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session cookie' })
  @ApiNoContentResponse({
    description: 'Session revoked if present; tc_session cookie cleared',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookies.readToken(request));
    this.cookies.clearSession(response);
  }
}
