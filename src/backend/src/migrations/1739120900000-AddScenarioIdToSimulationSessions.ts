import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddScenarioIdToSimulationSessions1739120900000
  implements MigrationInterface
{
  name = "AddScenarioIdToSimulationSessions1739120900000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "simulation_sessions"
      ADD "scenario_id" character varying(128)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "simulation_sessions" DROP COLUMN "scenario_id"
    `);
  }
}
