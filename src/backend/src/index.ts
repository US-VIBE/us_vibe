export const BACKEND_PACKAGE_VERSION = "0.1.0";

export function getBackendPackageLabel(): string {
  return "us-vibe-backend";
}

export { AppDataSource, createDataSourceOptions } from "./data-source";
export {
  CollaborationEvent,
  SimulationSession,
  typeOrmEntities,
  User
} from "./entities";
export type { SimulationGate } from "./entities/simulation-session.entity";
export { CollaborationEventsDataService } from "./collaboration/collaboration-events-data.service";
export { contractFilesPresent } from "./sessions/contract-files";
export { SessionsDataService } from "./sessions/sessions-data.service";
export { RevokedTokenStore } from "./redis/revoked-token.store";
export { UsersDataService } from "./users/users-data.service";
