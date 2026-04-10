import "reflect-metadata";
import { DataSource, type DataSourceOptions } from "typeorm";
import { typeOrmEntities } from "./entities";
import { InitDb1739120400000 } from "./migrations/1739120400000-InitDb";
import { CreateUsers1739120500000 } from "./migrations/1739120500000-CreateUsers";
import { CreateCollaborationEvents1739120600000 } from "./migrations/1739120600000-CreateCollaborationEvents";
import { CreateSimulationSessions1739120700000 } from "./migrations/1739120700000-CreateSimulationSessions";
import { AddImplementationAckToSimulationSessions1739120800000 } from "./migrations/1739120800000-AddImplementationAckToSimulationSessions";

const defaultUrl =
  "postgres://postgres:postgres@127.0.0.1:5432/usvibe";

export function createDataSourceOptions(): DataSourceOptions {
  return {
    type: "postgres",
    url: process.env.DATABASE_URL ?? defaultUrl,
    entities: typeOrmEntities,
    migrations: [
      InitDb1739120400000,
      CreateUsers1739120500000,
      CreateCollaborationEvents1739120600000,
      CreateSimulationSessions1739120700000,
      AddImplementationAckToSimulationSessions1739120800000
    ],
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === "1"
  };
}

export const AppDataSource = new DataSource(createDataSourceOptions());
