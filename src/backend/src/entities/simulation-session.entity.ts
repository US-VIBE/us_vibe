import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type SimulationGate = "A" | "B" | "C" | "D" | "DONE";

@Entity({ name: "simulation_sessions" })
export class SimulationSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    name: "learner_role",
    type: "varchar",
    length: 128,
    default: "Backend Developer"
  })
  learnerRole!: string;

  @Column({ name: "learning_goal", type: "text" })
  learningGoal!: string;

  @Column({ type: "text" })
  topic!: string;

  @Column({ name: "scenario_id", type: "varchar", length: 128, nullable: true })
  scenarioId!: string | null;

  @Column({ name: "sprint_duration", type: "varchar", length: 64 })
  sprintDuration!: string;

  @Column({ name: "skill_level", type: "varchar", length: 32 })
  skillLevel!: string;

  @Column({ name: "active_roles", type: "jsonb" })
  activeRoles!: string[];

  @Column({ name: "current_gate", type: "varchar", length: 8, default: "A" })
  currentGate!: SimulationGate;

  @Column({ name: "gate_history", type: "jsonb", default: () => "'[]'::jsonb" })
  gateHistory!: { at: string; from: string; to: string; reason: string }[];

  @Column({ name: "implementation_notes", type: "text", nullable: true })
  implementationNotes!: string | null;

  @Column({
    name: "implementation_acknowledged_at",
    type: "timestamptz",
    nullable: true
  })
  implementationAcknowledgedAt!: Date | null;

  @Column({ name: "retro_summary", type: "jsonb", nullable: true })
  retroSummary!: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
