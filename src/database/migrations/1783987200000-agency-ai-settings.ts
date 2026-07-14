import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgencyAiSettings1783987200000 implements MigrationInterface {
  name = 'AgencyAiSettings1783987200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agency_ai_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying NOT NULL DEFAULT 'gemini',
        "model" character varying,
        "geminiApiKeyEncrypted" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_agency_ai_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agency_ai_settings_agency" UNIQUE ("agencyId"),
        CONSTRAINT "FK_agency_ai_settings_agency"
          FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "agency_ai_settings"');
  }
}
