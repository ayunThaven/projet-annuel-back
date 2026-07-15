import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdeasGeneration1783036800000 implements MigrationInterface {
  name = 'IdeasGeneration1783036800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "content_ideas_source_enum"
      AS ENUM ('MANUAL', 'SCHEDULED')
    `);
    await queryRunner.query(`
      CREATE TYPE "content_ideas_status_enum"
      AS ENUM ('NEW', 'ACCEPTED', 'DISMISSED')
    `);
    await queryRunner.query(`
      CREATE TYPE "content_ideas_duplicateStatus_enum"
      AS ENUM ('UNIQUE', 'POSSIBLE_DUPLICATE', 'DUPLICATE')
    `);
    await queryRunner.query(`
      CREATE TYPE "idea_generation_settings_cadence_enum"
      AS ENUM ('DAILY', 'WEEKLY')
    `);
    await queryRunner.query(`
      CREATE TYPE "idea_generation_runs_source_enum"
      AS ENUM ('MANUAL', 'SCHEDULED')
    `);
    await queryRunner.query(`
      CREATE TYPE "idea_generation_runs_status_enum"
      AS ENUM ('SUCCESS', 'ERROR')
    `);

    await queryRunner.query(`
      CREATE TABLE "content_ideas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "angle" character varying(120),
        "contentType" character varying(120),
        "keywords" text,
        "searchIntent" character varying(160),
        "rationale" text,
        "duplicateScore" double precision NOT NULL DEFAULT 0,
        "duplicateStatus" "content_ideas_duplicateStatus_enum" NOT NULL DEFAULT 'UNIQUE',
        "similarItems" jsonb,
        "source" "content_ideas_source_enum" NOT NULL DEFAULT 'MANUAL',
        "status" "content_ideas_status_enum" NOT NULL DEFAULT 'NEW',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        "acceptedContentId" uuid,
        CONSTRAINT "PK_content_ideas_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "idea_generation_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL DEFAULT false,
        "cadence" "idea_generation_settings_cadence_enum" NOT NULL DEFAULT 'DAILY',
        "timeOfDay" character varying(5) NOT NULL DEFAULT '09:00',
        "weekday" integer,
        "timezone" character varying(80) NOT NULL DEFAULT 'Europe/Paris',
        "theme" character varying(160),
        "sector" character varying(120),
        "count" integer NOT NULL DEFAULT 3,
        "checkDuplicates" boolean NOT NULL DEFAULT true,
        "nextRunAt" TIMESTAMP WITH TIME ZONE,
        "lastRunAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_idea_generation_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idea_generation_settings_agency" UNIQUE ("agencyId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "idea_generation_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source" "idea_generation_runs_source_enum" NOT NULL DEFAULT 'MANUAL',
        "status" "idea_generation_runs_status_enum" NOT NULL,
        "settingsSnapshot" jsonb,
        "generatedCount" integer NOT NULL DEFAULT 0,
        "errorMessage" text,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_idea_generation_runs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_content_ideas_agency_status"
      ON "content_ideas" ("agencyId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_idea_generation_runs_agency_created"
      ON "idea_generation_runs" ("agencyId", "createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "content_ideas"
      ADD CONSTRAINT "FK_content_ideas_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "content_ideas"
      ADD CONSTRAINT "FK_content_ideas_accepted_content"
      FOREIGN KEY ("acceptedContentId") REFERENCES "content_items"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "idea_generation_settings"
      ADD CONSTRAINT "FK_idea_generation_settings_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "idea_generation_runs"
      ADD CONSTRAINT "FK_idea_generation_runs_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "idea_generation_runs"
      DROP CONSTRAINT "FK_idea_generation_runs_agency"
    `);
    await queryRunner.query(`
      ALTER TABLE "idea_generation_settings"
      DROP CONSTRAINT "FK_idea_generation_settings_agency"
    `);
    await queryRunner.query(`
      ALTER TABLE "content_ideas"
      DROP CONSTRAINT "FK_content_ideas_accepted_content"
    `);
    await queryRunner.query(`
      ALTER TABLE "content_ideas"
      DROP CONSTRAINT "FK_content_ideas_agency"
    `);

    await queryRunner.query(
      'DROP INDEX "IDX_idea_generation_runs_agency_created"',
    );
    await queryRunner.query('DROP INDEX "IDX_content_ideas_agency_status"');
    await queryRunner.query('DROP TABLE "idea_generation_runs"');
    await queryRunner.query('DROP TABLE "idea_generation_settings"');
    await queryRunner.query('DROP TABLE "content_ideas"');
    await queryRunner.query('DROP TYPE "idea_generation_runs_status_enum"');
    await queryRunner.query('DROP TYPE "idea_generation_runs_source_enum"');
    await queryRunner.query(
      'DROP TYPE "idea_generation_settings_cadence_enum"',
    );
    await queryRunner.query('DROP TYPE "content_ideas_duplicateStatus_enum"');
    await queryRunner.query('DROP TYPE "content_ideas_status_enum"');
    await queryRunner.query('DROP TYPE "content_ideas_source_enum"');
  }
}
