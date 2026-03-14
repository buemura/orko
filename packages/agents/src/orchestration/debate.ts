import type { HandlerCtx, HandlerFunction } from "@synkro/core";
import type { Agent } from "../agent.js";
import type { TokenUsage } from "../llm/types.js";
import type { AgentRunOptions } from "../types.js";

export type DebateConfig = {
  name: string;
  participants: Agent[];
  maxRounds?: number;
  moderator?: Agent;
  onTokenUsage?: ((usage: TokenUsage) => void) | undefined;
};

export type DebateContribution = {
  agentName: string;
  output: string;
};

export type DebateRound = {
  roundNumber: number;
  contributions: DebateContribution[];
};

export type DebateResult = {
  topic: string;
  rounds: DebateRound[];
  synthesis: string | undefined;
  output: string;
  tokenUsage: TokenUsage;
  status: "completed" | "failed";
};

const DEFAULT_MAX_ROUNDS = 3;

function accumulateUsage(total: TokenUsage, added: TokenUsage): void {
  total.promptTokens += added.promptTokens;
  total.completionTokens += added.completionTokens;
  total.totalTokens += added.totalTokens;
}

function buildParticipantInput(
  topic: string,
  transcript: string[],
  round: number,
  maxRounds: number,
): string {
  const parts = [`Debate topic: ${topic}`];

  if (transcript.length > 0) {
    parts.push(`\nPrevious discussion:\n${transcript.join("\n")}`);
  }

  parts.push(
    `\nIt is your turn to contribute to this debate. Round ${round}/${maxRounds}.`,
  );

  return parts.join("\n");
}

export function createDebate(config: DebateConfig): {
  run(topic: string, options?: AgentRunOptions): Promise<DebateResult>;
  asHandler(): HandlerFunction;
} {
  if (config.participants.length === 0) {
    throw new Error("Debate requires at least one participant");
  }

  const maxRounds = config.maxRounds ?? DEFAULT_MAX_ROUNDS;

  async function run(
    topic: string,
    options?: AgentRunOptions,
  ): Promise<DebateResult> {
    const totalUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    const transcript: string[] = [];
    const rounds: DebateRound[] = [];

    // Moderator framing
    if (config.moderator) {
      const framingResult = await config.moderator.run(
        `Frame the following debate topic for the participants: ${topic}`,
        options,
      );

      if (framingResult.status !== "completed") {
        return {
          topic,
          rounds,
          synthesis: undefined,
          output: framingResult.output,
          tokenUsage: totalUsage,
          status: "failed",
        };
      }

      accumulateUsage(totalUsage, framingResult.tokenUsage);
      config.onTokenUsage?.(framingResult.tokenUsage);
      transcript.push(`[${config.moderator.name}]: ${framingResult.output}`);
    }

    // Debate rounds
    for (let round = 1; round <= maxRounds; round++) {
      const contributions: DebateContribution[] = [];

      for (const participant of config.participants) {
        const input = buildParticipantInput(
          topic,
          transcript,
          round,
          maxRounds,
        );

        const result = await participant.run(input, options);

        accumulateUsage(totalUsage, result.tokenUsage);
        config.onTokenUsage?.(result.tokenUsage);

        if (result.status !== "completed") {
          return {
            topic,
            rounds,
            synthesis: undefined,
            output: result.output,
            tokenUsage: totalUsage,
            status: "failed",
          };
        }

        transcript.push(`[${participant.name}]: ${result.output}`);
        contributions.push({
          agentName: participant.name,
          output: result.output,
        });
      }

      rounds.push({ roundNumber: round, contributions });
    }

    // Moderator synthesis
    let synthesis: string | undefined;

    if (config.moderator) {
      const synthesisResult = await config.moderator.run(
        `The debate on "${topic}" has concluded after ${maxRounds} rounds.\n\nFull transcript:\n${transcript.join("\n")}\n\nPlease synthesize the key arguments and provide a final conclusion.`,
        options,
      );

      accumulateUsage(totalUsage, synthesisResult.tokenUsage);
      config.onTokenUsage?.(synthesisResult.tokenUsage);

      if (synthesisResult.status === "completed") {
        synthesis = synthesisResult.output;
      }
    }

    const lastRound = rounds[rounds.length - 1];
    const lastRoundOutput = lastRound
      ? lastRound.contributions.map((c) => c.output).join("\n\n")
      : "";

    return {
      topic,
      rounds,
      synthesis,
      output: synthesis ?? lastRoundOutput,
      tokenUsage: totalUsage,
      status: "completed",
    };
  }

  function asHandler(): HandlerFunction {
    return async (ctx: HandlerCtx) => {
      const payload = ctx.payload as Record<string, unknown> | undefined;
      const input =
        typeof payload?.input === "string"
          ? payload.input
          : JSON.stringify(payload);

      const result = await run(input, {
        requestId: ctx.requestId,
        payload: ctx.payload,
        synkroCtx: ctx,
      });

      ctx.setPayload({
        debateOutput: result.output,
        debateSynthesis: result.synthesis,
        debateRounds: result.rounds.length,
        debateStatus: result.status,
        debateTokenUsage: result.tokenUsage,
      });
    };
  }

  return { run, asHandler };
}
