import { Controller, Post } from "@nestjs/common";
import { SynkroService } from "@synkro/nestjs";

@Controller("demo")
export class DemoController {
  constructor(private readonly synkro: SynkroService) {}

  @Post()
  async runDemo() {
    console.log("\n>> Publishing standalone events\n");

    await this.synkro.publish("UserSignedUp", {
      email: "alice@example.com",
      name: "Alice",
    });

    await this.synkro.publish("PaymentReceived", {
      orderId: "ORD-001",
      amount: 59.99,
    });

    console.log("\n>> Starting OrderProcessing workflow\n");

    const orderRequestId = await this.synkro.publish("OrderProcessing", {
      orderId: "ORD-002",
      items: ["Widget A", "Gadget B"],
    });

    console.log("\n>> Starting DeployService workflow (success path)\n");
    console.log(
      "   BuildImage -> RunTests -> [onSuccess] -> DeployToProduction\n",
    );

    await this.synkro.publish("DeployService", {
      service: "api-gateway",
      version: "2.4.0",
    });

    console.log("\n>> Starting DeployService workflow (failure path)\n");
    console.log("   BuildImage -> RunTests -> [onFailure] -> Rollback\n");

    await this.synkro.publish("DeployService", {
      service: "payment-service",
      version: "1.3.0",
      shouldFail: true,
    });

    return {
      status: "demo started",
      orderRequestId,
      introspection: this.synkro.introspect(),
    };
  }
}
