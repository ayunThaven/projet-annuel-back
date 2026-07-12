import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentBody1783900800000 implements MigrationInterface {
  name = 'AddContentBody1783900800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "content_items"
      ADD COLUMN IF NOT EXISTS "body" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "content_items"
      DROP COLUMN IF EXISTS "body"
    `);
  }
}