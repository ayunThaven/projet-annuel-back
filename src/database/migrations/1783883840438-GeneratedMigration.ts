import { MigrationInterface, QueryRunner } from "typeorm";

export class GeneratedMigration1783883840438 implements MigrationInterface {
    name = 'GeneratedMigration1783883840438'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "displayName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."agency_memberships_role_enum" AS ENUM('OWNER', 'EDITOR', 'VIEWER')`);
        await queryRunner.query(`CREATE TABLE "agency_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."agency_memberships_role_enum" NOT NULL DEFAULT 'VIEWER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "agencyId" uuid NOT NULL, CONSTRAINT "PK_63b4de07f624403ad692df5531c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_58ac4b726bc10d8d6c6defeae7" ON "agency_memberships"  ("userId", "agencyId") `);
        await queryRunner.query(`CREATE TABLE "agencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "notionDatabaseId" character varying, "notionWorkspaceName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8ab1f1f53f56c8255b0d7e68b28" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."agency_invitations_role_enum" AS ENUM('OWNER', 'EDITOR', 'VIEWER')`);
        await queryRunner.query(`CREATE TYPE "public"."agency_invitations_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED')`);
        await queryRunner.query(`CREATE TABLE "agency_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "token" character varying NOT NULL, "role" "public"."agency_invitations_role_enum" NOT NULL DEFAULT 'EDITOR', "status" "public"."agency_invitations_status_enum" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP NOT NULL, "acceptedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "agencyId" uuid NOT NULL, "invitedById" uuid, CONSTRAINT "UQ_55451019aabbff336ce399f6308" UNIQUE ("token"), CONSTRAINT "PK_7f31018b02fe1281c43a14612b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."content_items_status_enum" AS ENUM('IDEA', 'DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED')`);
        await queryRunner.query(`CREATE TYPE "public"."content_items_syncstatus_enum" AS ENUM('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')`);
        await queryRunner.query(`CREATE TABLE "content_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "status" "public"."content_items_status_enum" NOT NULL DEFAULT 'IDEA', "publicationDate" TIMESTAMP WITH TIME ZONE, "channel" character varying, "contentType" character varying, "url" character varying, "tags" text, "notes" text, "notionPageId" character varying, "notionLastEditedAt" TIMESTAMP WITH TIME ZONE, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "syncStatus" "public"."content_items_syncstatus_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agencyId" uuid NOT NULL, CONSTRAINT "PK_9c6bf4f28851752cee186915e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3e56bf3c2e3f4ebe366f0fbe13" ON "content_items"  ("notionPageId") WHERE "notionPageId" IS NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."curation_items_status_enum" AS ENUM('TO_REVIEW', 'REVIEWED', 'SHARED')`);
        await queryRunner.query(`CREATE TYPE "public"."curation_items_syncstatus_enum" AS ENUM('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')`);
        await queryRunner.query(`CREATE TABLE "curation_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "sourceUrl" character varying, "source" character varying, "topics" text, "status" "public"."curation_items_status_enum" NOT NULL DEFAULT 'TO_REVIEW', "curatedBy" character varying, "notes" text, "notionPageId" character varying, "notionLastEditedAt" TIMESTAMP WITH TIME ZONE, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "syncStatus" "public"."curation_items_syncstatus_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agencyId" uuid NOT NULL, CONSTRAINT "PK_7ad27973e6cb6c48ac53a7b3c08" PRIMARY KEY ("id"))`);
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
        await queryRunner.query(`DROP TABLE "curation_items"`);
        await queryRunner.query(`DROP TYPE "public"."curation_items_syncstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."curation_items_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e56bf3c2e3f4ebe366f0fbe13"`);
        await queryRunner.query(`DROP TABLE "content_items"`);
        await queryRunner.query(`DROP TYPE "public"."content_items_syncstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."content_items_status_enum"`);
        await queryRunner.query(`DROP TABLE "agency_invitations"`);
        await queryRunner.query(`DROP TYPE "public"."agency_invitations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."agency_invitations_role_enum"`);
        await queryRunner.query(`DROP TABLE "agencies"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58ac4b726bc10d8d6c6defeae7"`);
        await queryRunner.query(`DROP TABLE "agency_memberships"`);
        await queryRunner.query(`DROP TYPE "public"."agency_memberships_role_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
