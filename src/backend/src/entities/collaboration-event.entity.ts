import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from "typeorm";

@Entity({ name: "collaboration_events" })
export class CollaborationEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "event_type", type: "varchar", length: 128 })
  eventType!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ name: "session_id", type: "varchar", length: 256, nullable: true })
  sessionId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
