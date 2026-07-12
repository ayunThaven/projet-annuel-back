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
import { ContentIdeaSource } from '../enums/content-idea-source.enum';
import { IdeaGenerationRunStatus } from '../enums/idea-generation-run-status.enum';

type IdeaGenerationSettingsSnapshot = {
  theme: string;
  sector?: string | null;
  count: number;
  checkDuplicates: boolean;
  cadence?: string;
  timeOfDay?: string;
  weekday?: number | null;
  timezone?: string;
};

/**
 * Historique des generations manuelles et planifiees.
 */
@Entity('idea_generation_runs')
@Index('IDX_idea_generation_runs_agency_created', ['agency', 'createdAt'])
export class IdeaGenerationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  agency: AgencyEntity;

  @Column({
    type: 'enum',
    enum: ContentIdeaSource,
    default: ContentIdeaSource.MANUAL,
  })
  source: ContentIdeaSource;

  @Column({ type: 'enum', enum: IdeaGenerationRunStatus })
  status: IdeaGenerationRunStatus;

  @Column({ type: 'jsonb', nullable: true })
  settingsSnapshot: IdeaGenerationSettingsSnapshot | null;

  @Column({ type: 'int', default: 0 })
  generatedCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
