import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table des flux RSS abonnes par agence, source d'alimentation de la curation.
 *
 * Complete la base "curation" (migration NotionContentCuration) sans la modifier.
 */
export class FeedSources1782960000000 implements MigrationInterface {
  name = 'FeedSources1782960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feed_sources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "url" character varying NOT NULL,
        "name" character varying,
        "defaultTopics" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "lastFetchedAt" TIMESTAMP WITH TIME ZONE,
        "agencyId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feed_sources_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feed_sources_agency_url" UNIQUE ("agencyId", "url"),
        CONSTRAINT "FK_feed_sources_agency" FOREIGN KEY ("agencyId")
          REFERENCES "agencies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_feed_sources_agency" ON "feed_sources" ("agencyId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "feed_sources"');
  }
}
