import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import {
  AGENCY_ROLES_KEY,
  AgencyRolesMetadata,
  AgencyRolesOptions,
} from '../decorators/agency-roles.decorator';
import { AgencyMembershipEntity } from '../entities/agency-membership.entity';

type RequestRecord = Record<string, unknown>;

/**
 * Route guard for agency-level authorization.
 *
 * It must run after AuthGuard so it can read `request.user`, then it checks
 * that the authenticated user has one of the roles declared by @AgencyRoles.
 */
@Injectable()
export class AgencyRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(AgencyMembershipEntity)
    private readonly membershipsRepository: Repository<AgencyMembershipEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<AgencyRolesMetadata>(
      AGENCY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const agencyId = await this.resolveAgencyId(request, metadata.options);

    if (!agencyId) {
      throw new BadRequestException('agencyId is required');
    }

    const membership = await this.membershipsRepository.findOne({
      where: {
        user: { id: request.user.sub },
        agency: { id: agencyId },
        role: In(metadata.roles),
      },
    });

    if (!membership) {
      throw new ForbiddenException('Insufficient agency permissions');
    }

    return true;
  }

  private async resolveAgencyId(
    request: AuthenticatedRequest,
    options: AgencyRolesOptions,
  ) {
    if (options.membershipIdParam) {
      return this.resolveAgencyIdFromMembership(
        request,
        options.membershipIdParam,
      );
    }

    const key = options.agencyIdKey ?? 'agencyId';

    if (options.agencyIdSource) {
      return this.readValue(request[options.agencyIdSource], key);
    }

    return (
      this.readValue(request.body, key) ??
      this.readValue(request.params, key) ??
      this.readValue(request.query, key)
    );
  }

  private async resolveAgencyIdFromMembership(
    request: AuthenticatedRequest,
    paramName: string,
  ) {
    const membershipId = this.readValue(request.params, paramName);

    if (!membershipId) {
      throw new BadRequestException(`${paramName} is required`);
    }

    const membership = await this.membershipsRepository.findOne({
      where: { id: membershipId },
      relations: { agency: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return membership.agency.id;
  }

  private readValue(source: unknown, key: string) {
    if (!source || typeof source !== 'object') {
      return undefined;
    }

    const value = (source as RequestRecord)[key];

    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
