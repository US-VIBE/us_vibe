import { CollaborationEvent } from "./collaboration-event.entity";
import { SimulationSession } from "./simulation-session.entity";
import { User } from "./user.entity";

/** Register TypeORM entities here; migrations and Nest use the same list. */
export const typeOrmEntities: (string | Function)[] = [
  User,
  CollaborationEvent,
  SimulationSession
];

export { CollaborationEvent } from "./collaboration-event.entity";
export { SimulationSession } from "./simulation-session.entity";
export { User } from "./user.entity";
