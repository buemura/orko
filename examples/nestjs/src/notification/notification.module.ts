import { Module } from "@nestjs/common";
import { NotificationHandlers } from "./notification.handlers.js";

@Module({
  providers: [NotificationHandlers],
})
export class NotificationModule {}
