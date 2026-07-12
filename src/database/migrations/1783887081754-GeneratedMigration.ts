import { MigrationInterface, QueryRunner } from "typeorm";

export class GeneratedMigration1783887081754 implements MigrationInterface {
    name = 'GeneratedMigration1783887081754'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agency_memberships" DROP CONSTRAINT "FK_agency_memberships_user"`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" DROP CONSTRAINT "FK_agency_memberships_agency"`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" DROP CONSTRAINT "FK_agency_invitations_agency"`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" DROP CONSTRAINT "FK_agency_invitations_invited_by"`);
        await queryRunner.query(`ALTER TABLE "content_items" DROP CONSTRAINT "FK_content_items_agency"`);
        await queryRunner.query(`ALTER TABLE "curation_items" DROP CONSTRAINT "FK_curation_items_agency"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_content_items_notion_page"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_curation_items_notion_page"`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" DROP CONSTRAINT "UQ_agency_memberships_user_agency"`);
        await queryRunner.query(`ALTER TABLE "content_items" ADD "body" text`);
        await queryRunner.query(`ALTER TYPE "public"."notion_sync_status_enum" RENAME TO "notion_sync_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."content_items_syncstatus_enum" AS ENUM('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "syncStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "syncStatus" TYPE "public"."content_items_syncstatus_enum" USING "syncStatus"::"text"::"public"."content_items_syncstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "syncStatus" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."notion_sync_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."notion_sync_status_enum" RENAME TO "notion_sync_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."curation_items_syncstatus_enum" AS ENUM('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')`);
        await queryRunner.query(`ALTER TABLE "curation_items" ALTER COLUMN "syncStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "curation_items" ALTER COLUMN "syncStatus" TYPE "public"."curation_items_syncstatus_enum" USING "syncStatus"::"text"::"public"."curation_items_syncstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "curation_items" ALTER COLUMN "syncStatus" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."notion_sync_status_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_58ac4b726bc10d8d6c6defeae7" ON "agency_memberships"  ("userId", "agencyId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3e56bf3c2e3f4ebe366f0fbe13" ON "content_items"  ("notionPageId") WHERE "notionPageId" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8ef8e0a2f2c50a9d5ba82b9a55" ON "curation_items"  ("notionPageId") WHERE "notionPageId" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" ADD CONSTRAINT "FK_39f52a6c7fb00c2c5e0622015c2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" ADD CONSTRAINT "FK_6bd343fa7a10e2800a9128cc550" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" ADD CONSTRAINT "FK_ea2e019ac7aaa88356234356478" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" ADD CONSTRAINT "FK_5ad5dad8532b62f3bd32ef4e745" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_items" ADD CONSTRAINT "FK_e690df75ff682ad49021d909f8e" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "curation_items" ADD CONSTRAINT "FK_12c99bbcfdbea3f5f813492e822" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "curation_items" DROP CONSTRAINT "FK_12c99bbcfdbea3f5f813492e822"`);
        await queryRunner.query(`ALTER TABLE "content_items" DROP CONSTRAINT "FK_e690df75ff682ad49021d909f8e"`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" DROP CONSTRAINT "FK_5ad5dad8532b62f3bd32ef4e745"`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" DROP CONSTRAINT "FK_ea2e019ac7aaa88356234356478"`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" DROP CONSTRAINT "FK_6bd343fa7a10e2800a9128cc550"`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" DROP CONSTRAINT "FK_39f52a6c7fb00c2c5e0622015c2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ef8e0a2f2c50a9d5ba82b9a55"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e56bf3c2e3f4ebe366f0fbe13"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58ac4b726bc10d8d6c6defeae7"`);
        await queryRunner.query(`CREATE TYPE "public"."notion_sync_status_enum_old" AS ENUM('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')`);
        await queryRunner.query(`ALTER TABLE "curation_items" ALTER COLUMN "syncStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "curation_items" ALTER COLUMN "syncStatus" TYPE "public"."notion_sync_status_enum_old" USING "syncStatus"::"text"::"public"."notion_sync_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "curation_items" ALTER COLUMN "syncStatus" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."curation_items_syncstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notion_sync_status_enum_old" RENAME TO "notion_sync_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."notion_sync_status_enum_old" AS ENUM('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "syncStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "syncStatus" TYPE "public"."notion_sync_status_enum_old" USING "syncStatus"::"text"::"public"."notion_sync_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "syncStatus" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."content_items_syncstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notion_sync_status_enum_old" RENAME TO "notion_sync_status_enum"`);
        await queryRunner.query(`ALTER TABLE "content_items" DROP COLUMN "body"`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" ADD CONSTRAINT "UQ_agency_memberships_user_agency" UNIQUE ("userId", "agencyId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_curation_items_notion_page" ON "curation_items" USING btree ("notionPageId") WHERE ("notionPageId" IS NOT NULL)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_content_items_notion_page" ON "content_items" USING btree ("notionPageId") WHERE ("notionPageId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "curation_items" ADD CONSTRAINT "FK_curation_items_agency" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_items" ADD CONSTRAINT "FK_content_items_agency" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" ADD CONSTRAINT "FK_agency_invitations_invited_by" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_invitations" ADD CONSTRAINT "FK_agency_invitations_agency" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" ADD CONSTRAINT "FK_agency_memberships_agency" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agency_memberships" ADD CONSTRAINT "FK_agency_memberships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
