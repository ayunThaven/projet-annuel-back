import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyRole } from '../../common/enums/agency-role.enum';
import { UserEntity } from '../../users/user.entity';
import { AgencyEntity } from './agency.entity';

/**
 * Association entre un utilisateur et une agence.
 *
 * C'est cette entite qui porte le role, ce qui permet a un meme utilisateur
 * d'avoir des permissions differentes selon l'agence.
 */
@Entity('agency_memberships')
@Index(['user', 'agency'], { unique: true })
export class AgencyMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.memberships, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @ManyToOne(() => AgencyEntity, (agency) => agency.memberships, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  agency: AgencyEntity;

  @Column({ type: 'enum', enum: AgencyRole, default: AgencyRole.VIEWER })
  role: AgencyRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
