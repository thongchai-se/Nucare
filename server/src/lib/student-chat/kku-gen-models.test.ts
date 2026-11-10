import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_KKU_CHAT_MODEL,
  isKkuSafeChatModel,
  resolveKkuChatModel,
} from "./kku-gen-models";

describe("kku-gen-models allowlist", () => {
  it("allows gemini gpt and claude ids only", () => {
    assert.equal(isKkuSafeChatModel("gemini-3.8-flash"), true);
    assert.equal(isKkuSafeChatModel("gpt-5.6-luna"), true);
    assert.equal(isKkuSafeChatModel("claude-sonnet-5.5"), true);
    assert.equal(isKkuSafeChatModel("qwen3.8-27b"), false);
    assert.equal(isKkuSafeChatModel("deepseek-v4-flash"), false);
    assert.equal(isKkuSafeChatModel("kimi-k3"), false);
  });

  it("falls back to default when env model is unsafe or empty", () => {
    assert.equal(resolveKkuChatModel(""), DEFAULT_KKU_CHAT_MODEL);
    assert.equal(resolveKkuChatModel("qwen3.7-plus"), DEFAULT_KKU_CHAT_MODEL);
    assert.equal(resolveKkuChatModel("claude-sonnet-5"), "claude-sonnet-5");
  });
});
