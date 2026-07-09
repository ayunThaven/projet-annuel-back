import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyEntity } from '../../agencies/entities/agency.entity';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { NotionSyncable } from '../../notion/notion-syncable';

/**
 * Contenu du calendrier editorial (base "Contenus" du template Notion).
 *
 * C'est cette entite qui repond a l'exemple de l'enonce : une modification de
 * date dans le calendrier Notion se repercute ici via la synchronisation.
 */
@Entity('content_items')
export class ContentItemEntity implements NotionSyncable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  agency: AgencyEntity;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.IDEA })
  status: ContentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publicationDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', nullable: true })
  contentType: string | null;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // --- Socle de synchronisation Notion ---

  @Index({ unique: true, where: '"notionPageId" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  notionPageId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  notionLastEditedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.PENDING })
  syncStatus: SyncStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
