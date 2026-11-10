import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertChatReadyForEnvironment } from "./provider";

describe("assertChatReadyForEnvironment", () => {
  it("CHAT-ENV-01 บล็อก mock ใน production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousProvider = process.env.CHAT_PROVIDER;
    const previousAllow = process.env.ALLOW_MOCK_CHAT;
    process.env.NODE_ENV = "production";
    process.env.CHAT_PROVIDER = "mock";
    delete process.env.ALLOW_MOCK_CHAT;
    assert.throws(() => assertChatReadyForEnvironment(), /CHAT_PROVIDER/);
    process.env.ALLOW_MOCK_CHAT = "true";
    assert.doesNotThrow(() => assertChatReadyForEnvironment());
    process.env.NODE_ENV = previousNodeEnv;
    process.env.CHAT_PROVIDER = previousProvider;
    process.env.ALLOW_MOCK_CHAT = previousAllow;
  });
});
