import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from './authenticated-request';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

const cookieOptions = 'HttpOnly; Path=/; SameSite=Lax; Max-Age=604800';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const session = await this.authService.register(body ?? {});
    res.header('Set-Cookie', `access_token=${session.token}; ${cookieOptions}`);

    return session;
  }

  @Post('login')
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const session = await this.authService.login(body ?? {});
    res.header('Set-Cookie', `access_token=${session.token}; ${cookieOptions}`);

    return session;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.header(
      'Set-Cookie',
      'access_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
    );

    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }
}
