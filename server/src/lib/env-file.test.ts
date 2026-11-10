import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { applyFileBackedEnvironmentVariables } from "./env";

const tempDirs: string[] = [];

const createSecretFile = (contents: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nucare-env-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "secret.txt");
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("applyFileBackedEnvironmentVariables", () => {
  it("loads JWT/AI/DATABASE values from *_FILE when direct env is absent", () => {
    const jwtAccessPath = createSecretFile("access-secret-value-at-least-32-chars");
    const jwtRefreshPath = createSecretFile("refresh-secret-value-at-least-32-chars");
    const aiKeyPath = createSecretFile("kku-api-key-value");
    const databaseUrlPath = createSecretFile(
      "postgresql://nucare:example@db:5432/nucare?schema=public"
    );

    const env: NodeJS.ProcessEnv = {
      JWT_ACCESS_SECRET_FILE: jwtAccessPath,
      JWT_REFRESH_SECRET_FILE: jwtRefreshPath,
      AI_API_KEY_FILE: aiKeyPath,
      DATABASE_URL_FILE: databaseUrlPath,
    };

    applyFileBackedEnvironmentVariables(env);

    assert.equal(env.JWT_ACCESS_SECRET, "access-secret-value-at-least-32-chars");
    assert.equal(env.JWT_REFRESH_SECRET, "refresh-secret-value-at-least-32-chars");
    assert.equal(env.AI_API_KEY, "kku-api-key-value");
    assert.equal(
      env.DATABASE_URL,
      "postgresql://nucare:example@db:5432/nucare?schema=public"
    );
  });

  it("keeps direct environment values over *_FILE", () => {
    const filePath = createSecretFile("from-file");
    const env: NodeJS.ProcessEnv = {
      JWT_ACCESS_SECRET: "from-direct-env",
      JWT_ACCESS_SECRET_FILE: filePath,
    };

    applyFileBackedEnvironmentVariables(env);

    assert.equal(env.JWT_ACCESS_SECRET, "from-direct-env");
  });

  it("throws a clear error when the secret file is missing", () => {
    const env: NodeJS.ProcessEnv = {
      AI_API_KEY_FILE: path.join(os.tmpdir(), "nucare-missing-secret.txt"),
    };

    assert.throws(
      () => applyFileBackedEnvironmentVariables(env),
      /AI_API_KEY_FILE points to a missing file/
    );
  });

  it("throws a clear error when the secret file is empty", () => {
    const filePath = createSecretFile("   \n");
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL_FILE: filePath,
    };

    assert.throws(
      () => applyFileBackedEnvironmentVariables(env),
      /DATABASE_URL_FILE points to an empty file/
    );
  });

  it("throws when *_FILE is present but blank", () => {
    const env: NodeJS.ProcessEnv = {
      JWT_REFRESH_SECRET_FILE: "   ",
    };

    assert.throws(
      () => applyFileBackedEnvironmentVariables(env),
      /JWT_REFRESH_SECRET_FILE is set but empty/
    );
  });
});
