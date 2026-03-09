import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller.js";
import { OrderHandlers } from "./order.handlers.js";

@Module({
  controllers: [OrderController],
  providers: [OrderHandlers],
})
export class OrderModule {}
