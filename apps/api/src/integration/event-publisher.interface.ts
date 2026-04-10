import type { IntegrationEvent } from "../../../../specs/data-model/types";

export const EVENT_PUBLISHER = "EVENT_PUBLISHER";

export interface IEventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
}
