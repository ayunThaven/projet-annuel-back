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

@Entity('agency_ai_settings')
@Index('UQ_agency_ai_settings_agency', ['agency'], { unique: true })
export class AgencyAiSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => AgencyEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  agency: AgencyEntity;

  @Column({ type: 'varchar', default: 'gemini' })
  provider: string;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  geminiApiKeyEncrypted: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
