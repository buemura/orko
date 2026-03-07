import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { Injectable } from "@nestjs/common";
import type { HandlerCtx } from "@synkro/core";

import { SynkroModule } from "./synkro.module.js";
import { SynkroService } from "./synkro.service.js";
import { OnEvent } from "./decorators/on-event.decorator.js";
import { OnWorkflowStep } from "./decorators/on-workflow-step.decorator.js";

@Injectable()
class TestEventHandler {
  handleFn = vi.fn();

  @OnEvent("TestEvent", { maxRetries: 1 })
  async handle(ctx: HandlerCtx) {
    this.handleFn(ctx);
  }
}

@Injectable()
class TestWorkflowHandler {
  stockFn = vi.fn();
  paymentFn = vi.fn();

  @OnWorkflowStep("TestWorkflow", "StockCheck")
  async handleStockCheck(ctx: HandlerCtx) {
    this.stockFn(ctx);
  }

  @OnWorkflowStep("TestWorkflow", "Payment")
  async handlePayment(ctx: HandlerCtx) {
    this.paymentFn(ctx);
  }
}

describe("SynkroModule", () => {
  describe("forRoot", () => {
    it("should provide SynkroService", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SynkroService);

      await module.close();
    });

    it("should expose publish method", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      expect(typeof service.publish).toBe("function");

      await module.close();
    });

    it("should expose on method", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      expect(typeof service.on).toBe("function");

      await module.close();
    });
  });

  describe("forRootAsync", () => {
    it("should provide SynkroService with async config", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRootAsync({
            useFactory: () => ({
              transport: "in-memory" as const,
            }),
          }),
        ],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SynkroService);

      await module.close();
    });
  });

  describe("event handler discovery", () => {
    it("should discover and register @OnEvent handlers", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
        providers: [TestEventHandler],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);

      // Publishing should invoke the discovered handler
      await service.publish("TestEvent", { data: "hello" });

      // Allow microtask queue to flush (in-memory transport uses queueMicrotask)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const handler = module.get(TestEventHandler);
      expect(handler.handleFn).toHaveBeenCalledTimes(1);
      expect(handler.handleFn).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { data: "hello" },
        }),
      );

      await module.close();
    });
  });

  describe("workflow step handler discovery", () => {
    it("should discover and patch @OnWorkflowStep handlers into workflows", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
            workflows: [
              {
                name: "TestWorkflow",
                steps: [
                  { type: "StockCheck" },
                  { type: "Payment" },
                ],
              },
            ],
          }),
        ],
        providers: [TestWorkflowHandler],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);

      await service.publish("TestWorkflow", { orderId: "123" });

      // Allow workflow steps to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      const handler = module.get(TestWorkflowHandler);
      expect(handler.stockFn).toHaveBeenCalledTimes(1);
      expect(handler.paymentFn).toHaveBeenCalledTimes(1);

      await module.close();
    });
  });

  describe("retention config passthrough", () => {
    it("should pass retention options to core", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
            retention: {
              lockTtl: 60,
              dedupTtl: 3600,
              stateTtl: 7200,
              metricsTtl: 86400,
            },
          }),
        ],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      expect(service).toBeDefined();

      await module.close();
    });
  });

  describe("introspect and getEventMetrics", () => {
    it("should expose introspect method", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
        providers: [TestEventHandler],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      const result = service.introspect();

      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("workflows");
      expect(result.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "TestEvent" }),
        ]),
      );

      await module.close();
    });

    it("should expose getEventMetrics method", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
        providers: [TestEventHandler],
      }).compile();

      await module.init();
      const service = module.get(SynkroService);
      const metrics = await service.getEventMetrics("TestEvent");

      expect(metrics).toEqual({
        type: "TestEvent",
        received: 0,
        completed: 0,
        failed: 0,
      });

      await module.close();
    });
  });

  describe("missing workflow step handler (TD-03)", () => {
    it("should throw when a workflow step has no handler and no decorator", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
            workflows: [
              {
                name: "BrokenWorkflow",
                steps: [{ type: "MissingStep" }],
              },
            ],
          }),
        ],
      }).compile();

      await expect(module.init()).rejects.toThrow(
        'Workflow "BrokenWorkflow" step "MissingStep" has no handler',
      );
    });
  });

  describe("lifecycle", () => {
    it("should stop synkro on module destroy", async () => {
      const module = await Test.createTestingModule({
        imports: [
          SynkroModule.forRoot({
            transport: "in-memory",
          }),
        ],
      }).compile();

      await module.init();
      // Should not throw
      await module.close();
    });

    it("should not throw on destroy if init was never called (TD-06)", async () => {
      const service = new SynkroService(
        { transport: "in-memory" },
        {} as any,
      );
      // Should not throw
      await service.onModuleDestroy();
    });

    it("should throw when publish is called before init (TD-07)", async () => {
      const service = new SynkroService(
        { transport: "in-memory" },
        {} as any,
      );

      await expect(service.publish("test")).rejects.toThrow(
        "Service is not initialized",
      );
    });

    it("should throw when introspect is called before init (TD-07)", () => {
      const service = new SynkroService(
        { transport: "in-memory" },
        {} as any,
      );

      expect(() => service.introspect()).toThrow(
        "Service is not initialized",
      );
    });
  });
});
