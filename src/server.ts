import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

import { publishMessage } from "./redis";
import type { WorkflowRegistry } from "./workflow-registry";

export function createServer(workflowRegistry: WorkflowRegistry): express.Express {
  const app = express();
  app.use(express.json());

  app.post("/publish", async (req: Request, res: Response) => {
    const { event, payload } = req.body;
    const requestId = randomUUID();

    if (workflowRegistry.hasWorkflow(event)) {
      await workflowRegistry.startWorkflow(event, requestId, payload);
      res.send({ status: "Workflow started", requestId, workflow: event, payload });
      return;
    }

    publishMessage(event, JSON.stringify({ requestId, payload }));
    res.send({ status: "Message published", requestId, event, payload });
  });

  return app;
}

export function startServer(app: express.Express): void {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Mastermind server is running on port ${port}`);
  });
}
