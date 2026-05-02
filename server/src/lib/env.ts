import fs from "fs";
import dotenv from "dotenv";

const FILE_ENV_SUFFIX = "_FILE";

let initialized = false;

const loadFileBackedEnvironmentVariables = (): void => {
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.endsWith(FILE_ENV_SUFFIX)) {
      continue;
    }

    const targetName = key.slice(0, -FILE_ENV_SUFFIX.length);
    if (process.env[targetName]?.trim()) {
      continue;
    }

    const filePath = value?.trim();
    if (!filePath) {
      continue;
    }

    const fileContents = fs.readFileSync(filePath, "utf8").trim();
    if (!fileContents) {
      throw new Error(`${key} points to an empty file`);
    }

    process.env[targetName] = fileContents;
  }
};

export const initializeEnvironment = (): void => {
  if (initialized) {
    return;
  }

  // Local Node processes should prefer `.env`.
  // `.env.local` is loaded after that only to fill in values that are still missing.
  // Values already present in process.env (for example from Docker Compose `env_file`)
  // keep the highest priority because dotenv does not override by default.
  dotenv.config();
  dotenv.config({ path: ".env.local" });
  loadFileBackedEnvironmentVariables();
  initialized = true;
};

initializeEnvironment();

export const readEnv = (name: string): string | undefined => {
  initializeEnvironment();
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export const requireEnv = (name: string): string => {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
};
