import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AgencyEntity } from '../../agencies/entities/agency.entity';

/**
 * Flux RSS auquel une agence est abonnee pour alimenter sa curation.
 *
 * defaultTopics est applique automatiquement aux ressources ingerees.
 */
@Entity('feed_sources')
@Unique('UQ_feed_sources_agency_url', ['agency', 'url'])
export class FeedSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  // simple-json (et non simple-array) pour ne pas decouper un topic contenant une virgule.
  @Column({ type: 'simple-json', nullable: true })
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
