import fs from "fs";
import dotenv from "dotenv";

const FILE_ENV_SUFFIX = "_FILE";

let initialized = false;

/**
 * อ่านค่าจากตัวแปร *_FILE เข้า process.env ของชื่อเดิม
 * ค่าที่มีอยู่แล้วใน env โดยตรงมีความสำคัญสูงกว่า และไม่ log ค่า secret
 */
export const applyFileBackedEnvironmentVariables = (
  env: NodeJS.ProcessEnv = process.env
): void => {
  for (const [key, rawValue] of Object.entries(env)) {
    if (!key.endsWith(FILE_ENV_SUFFIX)) {
      continue;
    }

    const targetName = key.slice(0, -FILE_ENV_SUFFIX.length);
    if (env[targetName]?.trim()) {
      continue;
    }

    const filePath = rawValue?.trim();
    if (!filePath) {
      throw new Error(`${key} is set but empty; provide a readable secret file path`);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`${key} points to a missing file: ${filePath}`);
    }

    let fileContents: string;
    try {
      fileContents = fs.readFileSync(filePath, "utf8").trim();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unreadable file";
      throw new Error(`${key} could not be read (${reason})`);
    }

    if (!fileContents) {
      throw new Error(`${key} points to an empty file: ${filePath}`);
    }

    env[targetName] = fileContents;
  }
};

const loadFileBackedEnvironmentVariables = (): void => {
  applyFileBackedEnvironmentVariables(process.env);
};

/** โหลด dotenv แล้วอ่าน *_FILE ก่อนที่แอปจะเริ่มใช้ env */
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
