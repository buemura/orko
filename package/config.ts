import { readFileSync } from "node:fs";
import * as path from "node:path";

import type { Config } from "./types.js";

export function loadConfig(configPath?: string): Config {
  const filePath = configPath
    ? path.resolve(process.cwd(), configPath)
    : path.resolve(process.cwd(), "mastermind.json");
  const file = readFileSync(filePath, "utf-8");
  return JSON.parse(file) as Config;
}
