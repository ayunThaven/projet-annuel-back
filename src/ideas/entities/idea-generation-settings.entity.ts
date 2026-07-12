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
import { IdeaGenerationCadence } from '../enums/idea-generation-cadence.enum';

/**
 * Parametrage de la generation automatique d'idees pour une agence.
 */
@Entity('idea_generation_settings')
@Index('UQ_idea_generation_settings_agency', ['agency'], { unique: true })
export class IdeaGenerationSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  agency: AgencyEntity;

  @Column({ default: false })
  enabled: boolean;

  @Column({
    type: 'enum',
    enum: IdeaGenerationCadence,
    default: IdeaGenerationCadence.DAILY,
  })
  cadence: IdeaGenerationCadence;

  @Column({ type: 'varchar', length: 5, default: '09:00' })
  timeOfDay: string;

  @Column({ type: 'int', nullable: true })
  weekday: number | null;

  @Column({ type: 'varchar', length: 80, default: 'Europe/Paris' })
  timezone: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  theme: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sector: string | null;

  @Column({ type: 'int', default: 3 })
  count: number;

  @Column({ default: true })
  checkDuplicates: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
