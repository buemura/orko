import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(4000);

  console.log("\n--- Synkro NestJS Example ---");
  console.log("Server:     http://localhost:4000");
  console.log("Run demo:   curl -X POST http://localhost:4000/demo\n");
}

bootstrap().catch(console.error);
