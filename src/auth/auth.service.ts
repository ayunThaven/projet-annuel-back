import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { PublicUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Orchestration de l'inscription, connexion et exposition du profil public.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Cree un utilisateur et retourne directement une session exploitable.
   */
  async register(input: RegisterDto) {
    const email = this.normalizeEmail(input.email);

    if (!email || !input.password || input.password.length < 8) {
      throw new BadRequestException(
        'Email and password with at least 8 characters are required',
      );
    }

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = this.usersRepository.create({
      email,
      displayName: input.displayName?.trim() || undefined,
      passwordHash: this.passwordService.hash(input.password),
    });
    const savedUser = await this.usersRepository.save(user);

    return this.createSession(savedUser);
  }

  /**
   * Verifie les identifiants et retourne une session avec token d'acces.
   */
  async login(input: LoginDto) {
    const email = this.normalizeEmail(input.email);

    if (!email || !input.password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.usersRepository.findOne({ where: { email } });

    if (
      !user ||
      !this.passwordService.verify(input.password, user.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user);
  }

  /**
   * Retourne le profil public avec les agences rattachees a l'utilisateur.
   */
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { memberships: { agency: true } },
    });

    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    return this.toPublicUser(user);
  }

  private createSession(user: UserEntity) {
    return {
      token: this.tokenService.sign(user),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: user.memberships?.map((membership) => ({
        id: membership.id,
        role: membership.role,
        agency: {
          id: membership.agency.id,
          name: membership.agency.name,
        },
      })),
    };
  }

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase();
  }
}
