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
import { ContentItemEntity } from '../../content/entities/content-item.entity';
import { ContentIdeaSource } from '../enums/content-idea-source.enum';
import { ContentIdeaStatus } from '../enums/content-idea-status.enum';
import { DuplicateStatus } from '../enums/duplicate-status.enum';
import { SimilarIdeaItem } from '../types';

/**
 * Idee SEO generee par l'IA et mise en attente de validation humaine.
 */
@Entity('content_ideas')
@Index('IDX_content_ideas_agency_status', ['agency', 'status'])
export class ContentIdeaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  agency: AgencyEntity;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  angle: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  contentType: string | null;

  @Column({ type: 'simple-array', nullable: true })
  keywords: string[] | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  searchIntent: string | null;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ type: 'double precision', default: 0 })
  duplicateScore: number;

  @Column({
    type: 'enum',
    enum: DuplicateStatus,
    default: DuplicateStatus.UNIQUE,
  })
  duplicateStatus: DuplicateStatus;

  @Column({ type: 'jsonb', nullable: true })
  similarItems: SimilarIdeaItem[] | null;

  @Column({
    type: 'enum',
    enum: ContentIdeaSource,
    default: ContentIdeaSource.MANUAL,
  })
  source: ContentIdeaSource;

  @Column({
    type: 'enum',
    enum: ContentIdeaStatus,
    default: ContentIdeaStatus.NEW,
  })
  status: ContentIdeaStatus;

  @ManyToOne(() => ContentItemEntity, { nullable: true, onDelete: 'SET NULL' })
  acceptedContent: ContentItemEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
