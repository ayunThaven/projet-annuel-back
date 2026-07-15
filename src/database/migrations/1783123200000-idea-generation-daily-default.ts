import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdeaGenerationDailyDefault1783123200000 implements MigrationInterface {
  name = 'IdeaGenerationDailyDefault1783123200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "idea_generation_settings"
      ALTER COLUMN "cadence" SET DEFAULT 'DAILY'
    `);
    await queryRunner.query(`
      UPDATE "idea_generation_settings"
      SET "cadence" = 'DAILY'
      WHERE "enabled" = false
        AND "theme" IS NULL
        AND "sector" IS NULL
        AND "cadence" = 'WEEKLY'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "idea_generation_settings"
      ALTER COLUMN "cadence" SET DEFAULT 'WEEKLY'
    `);
  }
}
