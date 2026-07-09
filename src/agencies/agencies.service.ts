import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { InvitationStatus } from '../common/enums/invitation-status.enum';
import { UserEntity } from '../users/user.entity';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AgencyEntity } from './entities/agency.entity';
import { AgencyInvitationEntity } from './entities/agency-invitation.entity';
import { AgencyMembershipEntity } from './entities/agency-membership.entity';

/**
 * Service central du mode agence.
 *
 * Il gere la creation des agences, les invitations et les verifications de
 * permissions reutilisables par les futurs modules metier.
 */
@Injectable()
export class AgenciesService {
  constructor(
    @InjectRepository(AgencyEntity)
    private readonly agenciesRepository: Repository<AgencyEntity>,
    @InjectRepository(AgencyMembershipEntity)
    private readonly membershipsRepository: Repository<AgencyMembershipEntity>,
    @InjectRepository(AgencyInvitationEntity)
    private readonly invitationsRepository: Repository<AgencyInvitationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  /**
   * Cree une agence et rattache automatiquement le createur comme OWNER.
   */
  async createAgency(userId: string, input: CreateAgencyDto) {
    if (!input.name?.trim()) {
      throw new BadRequestException('Agency name is required');
    }

    const user = await this.findUser(userId);
    const agency = await this.agenciesRepository.save(
      this.agenciesRepository.create({
        name: input.name.trim(),
        notionDatabaseId: input.notionDatabaseId?.trim() || undefined,
        notionWorkspaceName: input.notionWorkspaceName?.trim() || undefined,
      }),
    );

    const membership = await this.membershipsRepository.save(
      this.membershipsRepository.create({
        user,
        agency,
        role: AgencyRole.OWNER,
      }),
    );

    return {
      agency,
      membership: {
        membershipId: membership.id,
        role: membership.role,
      },
    };
  }

  /**
   * Liste les agences accessibles a l'utilisateur avec son role dans chacune.
   */
  async listAgencies(userId: string) {
    const memberships = await this.membershipsRepository.find({
      where: { user: { id: userId } },
      relations: { agency: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      agency: membership.agency,
    }));
  }

  /**
   * Retourne l'agence par defaut pour les premiers ecrans du MVP.
   */
  async getCurrentAgency(userId: string) {
    const [currentAgency] = await this.listAgencies(userId);

    if (!currentAgency) {
      throw new NotFoundException('No agency found for current user');
    }

    return currentAgency;
  }

  /**
   * Met a jour les informations administrables d'une agence.
   */
  async updateAgency(agencyId: string, input: UpdateAgencyDto) {
    const agency = await this.findAgency(agencyId);

    if (input.name !== undefined) {
      const name = input.name.trim();

      if (!name) {
        throw new BadRequestException('Agency name is required');
      }

      agency.name = name;
    }

    if (input.notionDatabaseId !== undefined) {
      agency.notionDatabaseId = input.notionDatabaseId.trim() || null;
    }

    if (input.notionWorkspaceName !== undefined) {
      agency.notionWorkspaceName = input.notionWorkspaceName.trim() || null;
    }

    return this.agenciesRepository.save(agency);
  }

  /**
   * Retourne les membres actifs et les invitations en attente d'une agence.
   */
  async listAgencyMembers(agencyId: string) {
    await this.findAgency(agencyId);

    const [memberships, invitations] = await Promise.all([
      this.membershipsRepository.find({
        where: { agency: { id: agencyId } },
        relations: { user: true },
        order: { createdAt: 'ASC' },
      }),
      this.invitationsRepository.find({
        where: {
          agency: { id: agencyId },
          status: InvitationStatus.PENDING,
        },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return {
      members: memberships.map((membership) =>
        this.toMemberSummary(membership),
      ),
      invitations: invitations.map((invitation) =>
        this.toInvitationSummary(invitation),
      ),
    };
  }

  /**
   * Cree une invitation pour un collaborateur.
   *
   * Le controle OWNER est porte par @AgencyRoles sur le controller.
   */
  async inviteMember(userId: string, input: InviteMemberDto) {
    if (!input.agencyId || !input.email?.trim()) {
      throw new BadRequestException('agencyId and email are required');
    }

    const role = input.role ?? AgencyRole.EDITOR;
    this.assertAssignableRole(role);

    const agency = await this.findAgency(input.agencyId);
    const invitedBy = await this.findUser(userId);
    const invitation = this.invitationsRepository.create({
      agency,
      invitedBy,
      email: input.email.trim().toLowerCase(),
      role,
      token: randomBytes(24).toString('hex'),
      expiresAt: this.daysFromNow(7),
    });

    const savedInvitation = await this.invitationsRepository.save(invitation);

    return this.toInvitationSummary(savedInvitation, { includeToken: true });
  }

  /**
   * Transforme une invitation valide en membership pour l'utilisateur connecte.
   */
  async acceptInvitation(userId: string, token: string) {
    const invitation = await this.invitationsRepository.findOne({
      where: { token },
      relations: { agency: true },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invitation expired');
    }

    const user = await this.findUser(userId);

    if (user.email !== invitation.email) {
      throw new ForbiddenException('Invitation email does not match user');
    }

    const existingMembership = await this.membershipsRepository.findOne({
      where: {
        user: { id: userId },
        agency: { id: invitation.agency.id },
      },
    });

    if (!existingMembership) {
      await this.membershipsRepository.save(
        this.membershipsRepository.create({
          user,
          agency: invitation.agency,
          role: invitation.role,
        }),
      );
    }

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();

    const savedInvitation = await this.invitationsRepository.save(invitation);

    return this.toInvitationSummary(savedInvitation);
  }

  /**
   * Modifie le role d'un membre sans permettre de supprimer le dernier OWNER.
   *
   * Le controle OWNER est porte par @AgencyRoles sur le controller.
   */
  async updateMemberRole(membershipId: string, input: UpdateMemberRoleDto) {
    if (!input.role) {
      throw new BadRequestException('role is required');
    }

    this.assertAssignableRole(input.role);

    const membership = await this.membershipsRepository.findOne({
      where: { id: membershipId },
      relations: { agency: true, user: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (
      membership.role === AgencyRole.OWNER &&
      input.role !== AgencyRole.OWNER
    ) {
      const ownerCount = await this.membershipsRepository.count({
        where: {
          agency: { id: membership.agency.id },
          role: AgencyRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('An agency must keep at least one owner');
      }
    }

    membership.role = input.role;

    const savedMembership = await this.membershipsRepository.save(membership);

    return this.toMemberSummary(savedMembership);
  }

  /**
   * Verifie qu'un utilisateur appartient a l'agence, quel que soit son role.
   */
  async ensureMember(userId: string, agencyId: string) {
    const membership = await this.membershipsRepository.findOne({
      where: {
        user: { id: userId },
        agency: { id: agencyId },
      },
      relations: { agency: true, user: true },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this agency');
    }

    return membership;
  }

  private async findAgency(agencyId: string) {
    const agency = await this.agenciesRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return agency;
  }

  private async findUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private assertAssignableRole(role: AgencyRole) {
    if (!Object.values(AgencyRole).includes(role)) {
      throw new BadRequestException('Invalid role');
    }
  }

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);

    return date;
  }

  private toMemberSummary(membership: AgencyMembershipEntity) {
    return {
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: {
        id: membership.user.id,
        email: membership.user.email,
        displayName: membership.user.displayName,
      },
    };
  }

  private toInvitationSummary(
    invitation: AgencyInvitationEntity,
    options: { includeToken?: boolean } = {},
  ) {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      ...(options.includeToken ? { token: invitation.token } : {}),
    };
  }
}
