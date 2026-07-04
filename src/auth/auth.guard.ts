import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { TokenService } from './token.service';

/**
 * Guard HTTP reutilisable pour les routes protegees.
 *
 * Le token peut venir d'un header `Authorization: Bearer` ou du cookie
 * `access_token`, ce qui laisse le choix au front.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request.headers);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = this.tokenService.verify(token);
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    request.user = payload;
    return true;
  }

  private extractToken(headers: Record<string, string | string[] | undefined>) {
    const authorization = headers.authorization;

    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice('Bearer '.length);
    }

    const cookie = headers.cookie;

    if (typeof cookie !== 'string') {
      return undefined;
    }

    return cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='))
      ?.slice('access_token='.length);
  }
}
