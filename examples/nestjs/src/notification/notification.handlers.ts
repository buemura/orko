import { Injectable } from "@nestjs/common";
import { OnEvent } from "@synkro/nestjs";
import type { HandlerCtx } from "@synkro/core";

@Injectable()
export class NotificationHandlers {
  @OnEvent("UserSignedUp")
  async sendWelcomeEmail(ctx: HandlerCtx) {
    const { email, name } = ctx.payload as { email: string; name: string };
    console.log(
      `  [Email] (${ctx.requestId}) Sending welcome email to ${name} <${email}>`,
    );
  }

  @OnEvent("PaymentReceived", { maxRetries: 3, backoff: "exponential" })
  async issueReceipt(ctx: HandlerCtx) {
    const { orderId, amount } = ctx.payload as {
      orderId: string;
      amount: number;
    };
    console.log(
      `  [Receipt] (${ctx.requestId}) Issuing receipt for order ${orderId} — $${amount}`,
    );
  }
}
