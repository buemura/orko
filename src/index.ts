import { loadConfig } from "./config";
import { HandlerRegistry } from "./handler-registry";
import { createServer, startServer } from "./server";
import { WorkflowRegistry } from "./workflow-registry";

async function main(): Promise<void> {
  const config = loadConfig();

  const handlerRegistry = new HandlerRegistry();
  await handlerRegistry.registerFromConfig(config);

  const workflowRegistry = new WorkflowRegistry();
  await workflowRegistry.registerFromConfig(config);

  const app = createServer(workflowRegistry);
  startServer(app);
}

main();
