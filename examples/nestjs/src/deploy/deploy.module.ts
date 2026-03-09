import { Module } from "@nestjs/common";
import { DeployController } from "./deploy.controller.js";
import { DeployHandlers } from "./deploy.handlers.js";

@Module({
  controllers: [DeployController],
  providers: [DeployHandlers],
})
export class DeployModule {}
