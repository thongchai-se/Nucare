import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockChatProvider } from "./mock-provider";

describe("mock student chat provider", () => {
  const provider = createMockChatProvider();

  it("MP-01 refuses homework in peer tone", async () => {
    const reply = await provider.reply({
      personaId: "peer-male",
      content: "ช่วยเขียนโค้ดการบ้านให้หน่อย",
      history: [],
    });
    assert.equal(reply.blockedReason, "homework");
    assert.match(reply.content, /โจทย์|โค้ด|ติวเตอร์|การบ้าน|ข้อสอบ/);
  });

  it("MP-02 replies supportively for stress talk", async () => {
    const reply = await provider.reply({
      personaId: "peer-female",
      content: "เครียดมากเลยช่วงนี้",
      history: [],
    });
    assert.equal(reply.blockedReason, null);
    assert.ok(reply.content.length > 10);
    assert.match(reply.content, /ฟัง|เครียด|หนัก|เล่า/i);
  });

  it("MP-03 appends crisis nudge when crisis language is present", async () => {
    const reply = await provider.reply({
      personaId: "peer-male",
      content: "อยากตายจัง",
      history: [],
    });
    assert.equal(reply.crisisSuggested, true);
    assert.match(reply.content, /SOS|ที่ปรึกษา/);
  });
});
