import { Body, Controller, Post } from "@nestjs/common";
import { SynkroService } from "@synkro/nestjs";

@Controller("orders")
export class OrderController {
  constructor(private readonly synkro: SynkroService) {}

  @Post()
  async create(@Body() body: { orderId: string; items: string[] }) {
    const requestId = await this.synkro.publish("OrderProcessing", body);
    return { status: "processing", requestId };
  }
}
