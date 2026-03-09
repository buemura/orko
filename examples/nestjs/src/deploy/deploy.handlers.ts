import { Injectable } from "@nestjs/common";
import { OnWorkflowStep } from "@synkro/nestjs";
import type { HandlerCtx } from "@synkro/core";

@Injectable()
export class DeployHandlers {
  @OnWorkflowStep("DeployService", "BuildImage")
  async buildImage(ctx: HandlerCtx) {
    const { service, version } = ctx.payload as {
      service: string;
      version: string;
    };
    console.log(
      `  [Build] (${ctx.requestId}) Building image for ${service}@${version}`,
    );
  }

  @OnWorkflowStep("DeployService", "RunTests")
  async runTests(ctx: HandlerCtx) {
    const { service, shouldFail } = ctx.payload as {
      service: string;
      shouldFail?: boolean;
    };
    if (shouldFail) {
      throw new Error(`Tests failed for ${service}`);
    }
    console.log(
      `  [Tests] (${ctx.requestId}) All tests passed for ${service}`,
    );
  }

  @OnWorkflowStep("DeployService", "DeployToProduction")
  async deployToProduction(ctx: HandlerCtx) {
    const { service, version } = ctx.payload as {
      service: string;
      version: string;
    };
    console.log(
      `  [Deploy] (${ctx.requestId}) Deployed ${service}@${version} to production`,
    );
  }

  @OnWorkflowStep("DeployService", "Rollback")
  async rollback(ctx: HandlerCtx) {
    const { service } = ctx.payload as { service: string };
    console.log(
      `  [Rollback] (${ctx.requestId}) Rolling back ${service} to previous version`,
    );
  }
}
