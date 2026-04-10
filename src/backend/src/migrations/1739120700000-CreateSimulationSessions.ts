import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSimulationSessions1739120700000
  implements MigrationInterface
{
  name = "CreateSimulationSessions1739120700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "simulation_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "learner_role" character varying(128) NOT NULL DEFAULT 'Backend Developer',
        "learning_goal" text NOT NULL,
        "topic" text NOT NULL,
        "sprint_duration" character varying(64) NOT NULL,
        "skill_level" character varying(32) NOT NULL,
        "active_roles" jsonb NOT NULL,
        "current_gate" character varying(8) NOT NULL DEFAULT 'A',
        "gate_history" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "implementation_notes" text,
        "retro_summary" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_simulation_sessions" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "simulation_sessions"`);
  }
}
