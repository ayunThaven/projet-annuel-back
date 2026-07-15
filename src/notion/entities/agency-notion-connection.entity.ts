import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyEntity } from '../../agencies/entities/agency.entity';

/**
 * Connexion Notion OAuth d'une agence.
 *
 * Le token d'acces est chiffre et jamais expose au front (`select: false`).
 * Les autres champs sont des metadonnees non sensibles retournees par Notion
 * lors de l'echange OAuth (workspace, bot).
 */
@Entity('agency_notion_connections')
@Index('UQ_agency_notion_connections_agency', ['agency'], { unique: true })
export class AgencyNotionConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  agency: AgencyEntity;

  @Column({ type: 'text', nullable: true, select: false })
  accessTokenEncrypted: string | null;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  workspaceName: string | null;

  @Column({ type: 'varchar', nullable: true })
  workspaceIcon: string | null;

  @Column({ type: 'varchar', nullable: true })
  botId: string | null;

  /**
   * Data source ids auto-detectes dans l'espace connecte (recherche par titre
   * "Articles"/"Centre de ressources"), mis en cache ici au premier push
   * reussi. Evite d'exiger une configuration manuelle par agence : chaque
   * connexion OAuth pointe vers ses propres bases, meme si l'utilisateur a
   * duplique le template dans son propre workspace.
   */
  @Column({ type: 'varchar', nullable: true })
  contentDatabaseId: string | null;

  @Column({ type: 'varchar', nullable: true })
  curationDatabaseId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
