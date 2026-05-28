import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyMembershipEntity } from './agency-membership.entity';

/**
 * Espace de travail d'une equipe ou d'un client.
 *
 * Les champs Notion restent optionnels pour que l'integration puisse etre
 * branchee plus tard sans changer le modele agence.
 */
@Entity('agencies')
export class AgencyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  notionDatabaseId?: string;

  @Column({ nullable: true })
  notionWorkspaceName?: string;

  @OneToMany(() => AgencyMembershipEntity, (membership) => membership.agency)
  memberships: AgencyMembershipEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
