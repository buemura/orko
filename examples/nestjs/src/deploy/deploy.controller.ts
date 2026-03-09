import { Body, Controller, Post } from "@nestjs/common";
import { SynkroService } from "@synkro/nestjs";

@Controller("deploy")
export class DeployController {
  constructor(private readonly synkro: SynkroService) {}

  @Post()
  async deploy(@Body() body: { service: string; version: string }) {
    const requestId = await this.synkro.publish("DeployService", body);
    return { status: "deploying", requestId };
  }
}
