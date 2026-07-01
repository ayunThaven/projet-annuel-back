import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AgencyRole } from '../../common/enums/agency-role.enum';
import { InvitationStatus } from '../../common/enums/invitation-status.enum';
import { UserEntity } from '../../users/user.entity';
import { AgencyEntity } from './agency.entity';

/**
 * Invitation a rejoindre une agence.
 *
 * Le token est partage au futur collaborateur, puis transforme en membership
 * uniquement si l'utilisateur connecte correspond a l'email invite.
 */
@Entity('agency_invitations')
export class AgencyInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'enum', enum: AgencyRole, default: AgencyRole.EDITOR })
  role: AgencyRole;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @ManyToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  agency: AgencyEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  invitedBy?: UserEntity;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  acceptedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
