import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitDb1739120400000 implements MigrationInterface {
  name = "InitDb1739120400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`);
  }

  public async down(): Promise<void> {
    // no-op
  }
}
