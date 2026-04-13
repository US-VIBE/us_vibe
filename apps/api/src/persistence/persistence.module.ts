import { Global, Module } from "@nestjs/common";
import { DiscussionPingService } from "./discussion-ping.service";
import { WorkspacePersistenceService } from "./workspace-persistence.service";

@Global()
@Module({
  providers: [WorkspacePersistenceService, DiscussionPingService],
  exports: [WorkspacePersistenceService, DiscussionPingService]
})
export class PersistenceModule {}
