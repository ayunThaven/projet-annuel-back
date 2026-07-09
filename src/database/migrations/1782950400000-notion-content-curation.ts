import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cree les bases synchronisables avec Notion : contenus (calendrier editorial)
 * et curation, chacune portant le socle de synchronisation Notion.
 */
export class NotionContentCuration1782950400000 implements MigrationInterface {
  name = 'NotionContentCuration1782950400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "content_items_status_enum"
      AS ENUM ('IDEA', 'DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED')
    `);
    await queryRunner.query(`
      CREATE TYPE "curation_items_status_enum"
      AS ENUM ('TO_REVIEW', 'REVIEWED', 'SHARED')
    `);
    await queryRunner.query(`
      CREATE TYPE "notion_sync_status_enum"
      AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')
    `);

    await queryRunner.query(`
      CREATE TABLE "content_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "status" "content_items_status_enum" NOT NULL DEFAULT 'IDEA',
        "publicationDate" TIMESTAMP WITH TIME ZONE,
        "channel" character varying,
        "contentType" character varying,
        "url" character varying,
        "tags" text,
        "notes" text,
        "notionPageId" character varying,
        "notionLastEditedAt" TIMESTAMP WITH TIME ZONE,
        "lastSyncedAt" TIMESTAMP WITH TIME ZONE,
        "syncStatus" "notion_sync_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_content_items_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "curation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "sourceUrl" character varying,
        "source" character varying,
        "topics" text,
        "status" "curation_items_status_enum" NOT NULL DEFAULT 'TO_REVIEW',
        "curatedBy" character varying,
        "notes" text,
        "notionPageId" character varying,
        "notionLastEditedAt" TIMESTAMP WITH TIME ZONE,
        "lastSyncedAt" TIMESTAMP WITH TIME ZONE,
        "syncStatus" "notion_sync_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_curation_items_id" PRIMARY KEY ("id")
      )
    `);

    // Unicite du pointeur Notion uniquement quand il est renseigne.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_content_items_notion_page"
      ON "content_items" ("notionPageId")
      WHERE "notionPageId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_curation_items_notion_page"
      ON "curation_items" ("notionPageId")
      WHERE "notionPageId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "content_items"
      ADD CONSTRAINT "FK_content_items_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "curation_items"
      ADD CONSTRAINT "FK_curation_items_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "curation_items" DROP CONSTRAINT "FK_curation_items_agency"
    `);
    await queryRunner.query(`
      ALTER TABLE "content_items" DROP CONSTRAINT "FK_content_items_agency"
    `);

    await queryRunner.query('DROP INDEX "UQ_curation_items_notion_page"');
    await queryRunner.query('DROP INDEX "UQ_content_items_notion_page"');

    await queryRunner.query('DROP TABLE "curation_items"');
    await queryRunner.query('DROP TABLE "content_items"');

    await queryRunner.query('DROP TYPE "notion_sync_status_enum"');
    await queryRunner.query('DROP TYPE "curation_items_status_enum"');
    await queryRunner.query('DROP TYPE "content_items_status_enum"');
  }
}
