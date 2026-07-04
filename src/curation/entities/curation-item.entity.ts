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
import { CurationStatus } from '../../common/enums/curation-status.enum';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { NotionSyncable } from '../../notion/notion-syncable';

/**
 * Ressource curee (base "Curation" du template Notion).
 */
@Entity('curation_items')
export class CurationItemEntity implements NotionSyncable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  agency: AgencyEntity;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'simple-array', nullable: true })
  topics: string[] | null;

  @Column({
    type: 'enum',
    enum: CurationStatus,
    default: CurationStatus.TO_REVIEW,
  })
  status: CurationStatus;

  @Column({ type: 'varchar', nullable: true })
  curatedBy: string | null;

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
