import { Global, Module } from "@nestjs/common";
import { WorkspacePersistenceService } from "./workspace-persistence.service";

@Global()
@Module({
  providers: [WorkspacePersistenceService],
  exports: [WorkspacePersistenceService]
})
export class PersistenceModule {}
