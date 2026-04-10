import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddImplementationAckToSimulationSessions1739120800000
  implements MigrationInterface
{
  name = "AddImplementationAckToSimulationSessions1739120800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "simulation_sessions"
      ADD COLUMN "implementation_acknowledged_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "simulation_sessions"
      DROP COLUMN "implementation_acknowledged_at"
    `);
  }
}
