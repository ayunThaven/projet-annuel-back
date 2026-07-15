import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgencyNotionConnectionDatabaseIds1784600000000 implements MigrationInterface {
  name = 'AgencyNotionConnectionDatabaseIds1784600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agency_notion_connections"
      ADD COLUMN "contentDatabaseId" character varying,
      ADD COLUMN "curationDatabaseId" character varying
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agency_notion_connections"
      DROP COLUMN "contentDatabaseId",
      DROP COLUMN "curationDatabaseId"
    `);
  }
}
