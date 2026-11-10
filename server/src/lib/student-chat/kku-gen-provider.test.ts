import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKkuGenChatProvider, resolveKkuGenApiKey, resolveKkuGenBaseUrl } from "./kku-gen-provider";

describe("resolveKkuGenApiKey", () => {
  it("reads AI_API_KEY or aiapikey alias", () => {
    assert.equal(resolveKkuGenApiKey({ AI_API_KEY: " key-a " }), "key-a");
    assert.equal(resolveKkuGenApiKey({ aiapikey: "key-b" }), "key-b");
    assert.equal(resolveKkuGenApiKey({}), null);
  });
});

describe("resolveKkuGenBaseUrl", () => {
  it("defaults to KKU Gen endpoint", () => {
    assert.equal(resolveKkuGenBaseUrl({}), "https://gen.ai.kku.ac.th/api/v1");
    assert.equal(
      resolveKkuGenBaseUrl({ KKU_GEN_BASE_URL: "https://gen.ai.kku.ac.th/api/v1/" }),
      "https://gen.ai.kku.ac.th/api/v1"
    );
  });
});

describe("createKkuGenChatProvider", () => {
  it("blocks homework without calling the API", async () => {
    let called = false;
    const provider = createKkuGenChatProvider({
      apiKey: "test-key",
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as typeof fetch,
    });

    const reply = await provider.reply({
      personaId: "peer-male",
      content: "ช่วยทำการบ้านวิชาคณิตให้หน่อย",
      history: [],
    });

    assert.equal(reply.blockedReason, "homework");
    assert.equal(called, false);
  });

  it("posts OpenAI-compatible chat completions and returns Thai reply", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = createKkuGenChatProvider({
      apiKey: "test-key",
      model: "gemini-3.8-flash",
      fetchImpl: (async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "เข้าใจเลยว่าหนักนะ เล่าต่อได้" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch,
    });

    const reply = await provider.reply({
      personaId: "peer-female",
      content: "วันนี้เครียดมาก",
      history: [{ role: "assistant", content: "สวัสดีค่ะ" }],
    });

    assert.equal(reply.blockedReason, null);
    assert.match(reply.content, /เข้าใจ/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://gen.ai.kku.ac.th/api/v1/chat/completions");

    const body = JSON.parse(String(calls[0]?.init?.body || "{}")) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    assert.equal(body.model, "gemini-3.8-flash");
    assert.equal(body.messages[0]?.role, "system");
    assert.match(body.messages[0]?.content || "", /ภาษาไทยเท่านั้น/);
    assert.equal(body.messages.at(-1)?.content, "วันนี้เครียดมาก");

    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-key");
  });

  it("appends crisis nudge when crisis language is present", async () => {
    const provider = createKkuGenChatProvider({
      apiKey: "test-key",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "อยู่ตรงนี้ฟังอยู่นะ" } }],
          }),
          { status: 200 }
        )) as typeof fetch,
    });

    const reply = await provider.reply({
      personaId: "peer-male",
      content: "อยากตายจริง ๆ",
      history: [],
    });

    assert.equal(reply.crisisSuggested, true);
    assert.match(reply.content, /SOS|ที่ปรึกษา/);
  });
});
