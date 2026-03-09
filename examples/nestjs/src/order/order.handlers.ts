import { Injectable } from "@nestjs/common";
import { OnWorkflowStep } from "@synkro/nestjs";
import type { HandlerCtx } from "@synkro/core";

@Injectable()
export class OrderHandlers {
  @OnWorkflowStep("OrderProcessing", "ValidateOrder")
  async validateOrder(ctx: HandlerCtx) {
    const { orderId, items } = ctx.payload as {
      orderId: string;
      items: string[];
    };
    console.log(
      `  [Validate] (${ctx.requestId}) Order ${orderId} with ${items.length} item(s) is valid`,
    );
  }

  @OnWorkflowStep("OrderProcessing", "ProcessPayment")
  async processPayment(ctx: HandlerCtx) {
    const { orderId } = ctx.payload as { orderId: string };
    console.log(
      `  [Payment] (${ctx.requestId}) Processing payment for order ${orderId}`,
    );
    ctx.setPayload({ paymentId: "pay_" + Date.now() });
  }

  @OnWorkflowStep("OrderProcessing", "FulfillOrder")
  async fulfillOrder(ctx: HandlerCtx) {
    const { orderId } = ctx.payload as { orderId: string };
    console.log(
      `  [Fulfill] (${ctx.requestId}) Shipping order ${orderId}`,
    );
  }

  @OnWorkflowStep("OrderProcessing", "HandlePaymentFailure")
  async handlePaymentFailure(ctx: HandlerCtx) {
    const { orderId } = ctx.payload as { orderId: string };
    console.log(
      `  [Failure] (${ctx.requestId}) Payment failed for order ${orderId}, notifying customer`,
    );
  }
}
