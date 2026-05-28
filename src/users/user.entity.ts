import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';

/**
 * Compte applicatif. Un utilisateur peut appartenir a plusieurs agences via
 * des memberships, chacun avec son propre role.
 */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  displayName?: string;

  @OneToMany(() => AgencyMembershipEntity, (membership) => membership.user)
  memberships: AgencyMembershipEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
