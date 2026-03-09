import { Module } from "@nestjs/common";
import type { NestSynkroWorkflow } from "@synkro/nestjs";
import { SynkroModule } from "@synkro/nestjs";

import { DemoController } from "./demo.controller.js";
import { DeployModule } from "./deploy/deploy.module.js";
import { NotificationModule } from "./notification/notification.module.js";
import { OrderModule } from "./order/order.module.js";

// ---------------------------------------------------------------------------
// Workflow definitions (handlers are injected via @OnWorkflowStep decorators)
// ---------------------------------------------------------------------------

const workflows: NestSynkroWorkflow[] = [
  {
    name: "OrderProcessing",
    steps: [
      { type: "ValidateOrder" },
      {
        type: "ProcessPayment",
        retry: { maxRetries: 2, backoff: "exponential" },
        onFailure: "HandlePaymentFailure",
      },
      { type: "FulfillOrder" },
    ],
  },
  {
    name: "DeployService",
    timeoutMs: 10_000,
    steps: [
      { type: "BuildImage" },
      {
        type: "RunTests",
        onSuccess: "DeployToProduction",
        onFailure: "Rollback",
      },
    ],
  },
];

@Module({
  imports: [
    SynkroModule.forRoot({
      transport: "redis",
      connectionUrl: "redis://localhost:6379",
      debug: false,
      workflows,
    }),
    OrderModule,
    NotificationModule,
    DeployModule,
  ],
  controllers: [DemoController],
})
export class AppModule {}
