import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgencyNotionConnections1784592000000 implements MigrationInterface {
  name = 'AgencyNotionConnections1784592000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agency_notion_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accessTokenEncrypted" text,
        "workspaceId" character varying,
        "workspaceName" character varying,
        "workspaceIcon" character varying,
        "botId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "agencyId" uuid NOT NULL,
        CONSTRAINT "PK_agency_notion_connections_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agency_notion_connections_agency" UNIQUE ("agencyId"),
        CONSTRAINT "FK_agency_notion_connections_agency"
          FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "agency_notion_connections"');
  }
}
