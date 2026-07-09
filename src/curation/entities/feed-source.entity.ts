import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyEntity } from '../../agencies/entities/agency.entity';

/**
 * Flux RSS auquel une agence est abonnee pour alimenter sa curation.
 *
 * defaultTopics est applique automatiquement aux ressources ingerees.
 */
@Entity('feed_sources')
export class FeedSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'simple-array', nullable: true })
  defaultTopics: string[] | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastFetchedAt: Date | null;

  @ManyToOne(() => AgencyEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  agency: AgencyEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
