import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCollaborationEvents1739120600000
  implements MigrationInterface
{
  name = "CreateCollaborationEvents1739120600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "collaboration_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_type" character varying(128) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "session_id" character varying(256),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collaboration_events" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "collaboration_events"`);
  }
}
