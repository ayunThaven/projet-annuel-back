import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuthAgencies1782864000000 implements MigrationInterface {
  name = 'InitAuthAgencies1782864000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TYPE "agency_memberships_role_enum"
      AS ENUM ('OWNER', 'EDITOR', 'VIEWER')
    `);
    await queryRunner.query(`
      CREATE TYPE "agency_invitations_role_enum"
      AS ENUM ('OWNER', 'EDITOR', 'VIEWER')
    `);
    await queryRunner.query(`
      CREATE TYPE "agency_invitations_status_enum"
      AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "displayName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "agencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "notionDatabaseId" character varying,
        "notionWorkspaceName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agencies_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "agency_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role" "agency_memberships_role_enum" NOT NULL DEFAULT 'VIEWER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_agency_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agency_memberships_user_agency"
          UNIQUE ("userId", "agencyId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "agency_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "token" character varying NOT NULL,
        "role" "agency_invitations_role_enum" NOT NULL DEFAULT 'EDITOR',
        "status" "agency_invitations_status_enum" NOT NULL DEFAULT 'PENDING',
        "expiresAt" TIMESTAMP NOT NULL,
        "acceptedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        "invitedById" uuid,
        CONSTRAINT "PK_agency_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agency_invitations_token" UNIQUE ("token")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "agency_memberships"
      ADD CONSTRAINT "FK_agency_memberships_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "agency_memberships"
      ADD CONSTRAINT "FK_agency_memberships_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "agency_invitations"
      ADD CONSTRAINT "FK_agency_invitations_agency"
      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "agency_invitations"
      ADD CONSTRAINT "FK_agency_invitations_invited_by"
      FOREIGN KEY ("invitedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agency_invitations"
      DROP CONSTRAINT "FK_agency_invitations_invited_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "agency_invitations"
      DROP CONSTRAINT "FK_agency_invitations_agency"
    `);
    await queryRunner.query(`
      ALTER TABLE "agency_memberships"
      DROP CONSTRAINT "FK_agency_memberships_agency"
    `);
    await queryRunner.query(`
      ALTER TABLE "agency_memberships"
      DROP CONSTRAINT "FK_agency_memberships_user"
    `);

    await queryRunner.query('DROP TABLE "agency_invitations"');
    await queryRunner.query('DROP TABLE "agency_memberships"');
    await queryRunner.query('DROP TABLE "agencies"');
    await queryRunner.query('DROP TABLE "users"');

    await queryRunner.query('DROP TYPE "agency_invitations_status_enum"');
    await queryRunner.query('DROP TYPE "agency_invitations_role_enum"');
    await queryRunner.query('DROP TYPE "agency_memberships_role_enum"');
  }
}
