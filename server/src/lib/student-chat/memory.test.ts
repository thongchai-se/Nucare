import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendMemorySummary,
  buildContinuityGreeting,
  calendarDaysBetween,
  describeChatTimeGap,
  extractLastTopic,
  formatMemoryForPrompt,
  isStudentChatMemoryStale,
  CHAT_MEMORY_TTL_DAYS,
} from "./memory";
import { STUDENT_CHAT_PERSONAS } from "./personas";

describe("student chat memory", () => {
  it("MEM-01 เก็บ bullet สั้นและจำกัดจำนวน", () => {
    const at = new Date("2026-11-07T10:00:00+07:00");
    let summary = "";
    for (let index = 1; index <= 8; index += 1) {
      summary = appendMemorySummary(summary, `วันนี้เครียดเรื่องสอบรอบที่ ${index} นอนไม่หลับเลย`, at);
    }
    const lines = summary.split("\n").filter(Boolean);
    assert.ok(lines.length <= 6);
    assert.match(summary, /รอบที่ 8/);
    assert.doesNotMatch(summary, /รอบที่ 1/);
    assert.match(summary, /\[/);
  });

  it("MEM-02 ไม่เก็บโค้ดลง memory", () => {
    const summary = appendMemorySummary("", "```js\nfunction add(a,b){return a+b}\n```");
    assert.equal(summary, "");
  });

  it("MEM-03 ทักทายเปิดแชทไม่ฟิกจาก memory", () => {
    const greeting = buildContinuityGreeting(STUDENT_CHAT_PERSONAS["peer-male"], {
      summary: "- [7 พ.ย.] เครียดเรื่องสอบ",
      lastTopic: "เครียดเรื่องสอบ",
      turnCount: 3,
      updatedAt: new Date("2026-11-07T20:00:00+07:00"),
    });
    assert.equal(greeting, STUDENT_CHAT_PERSONAS["peer-male"].greeting);
    assert.doesNotMatch(greeting, /เมื่อวาน|หายไป/);
  });

  it("MEM-04 ระยะห่างวันปฏิทินถูกต้อง", () => {
    const now = new Date("2026-11-11T09:00:00+07:00");
    const last = new Date("2026-11-07T20:00:00+07:00");
    assert.equal(calendarDaysBetween(last, now), 4);
  });

  it("MEM-05 formatMemoryForPrompt ส่งบริบทเวลาโดยไม่ฟิกประโยคทัก", () => {
    const now = new Date("2026-11-08T09:00:00+07:00");
    const block = formatMemoryForPrompt(
      {
        summary: "- [7 พ.ย.] เครียดเรื่องสอบ",
        lastTopic: "เครียดเรื่องสอบ",
        updatedAt: new Date("2026-11-07T20:00:00+07:00"),
      },
      now
    );
    assert.match(block, /เมื่อวาน/);
    assert.match(block, /บริบทเวลา/);
    assert.match(block, /อย่าท่องเป็นสคริปต์|อย่าเปิดด้วยประโยคจำเจ/);
    assert.doesNotMatch(block, /เมื่อวานเล่าเรื่องเครียดเรื่องสอบ ไว้ วันนี้เป็นไงบ้าง/);
  });

  it("MEM-06 TTL 90 วันถือว่า stale", () => {
    const now = new Date("2026-11-07T12:00:00+07:00");
    const fresh = new Date(now.getTime() - 10 * 86_400_000);
    const stale = new Date(now.getTime() - (CHAT_MEMORY_TTL_DAYS + 1) * 86_400_000);
    assert.equal(isStudentChatMemoryStale(fresh, now), false);
    assert.equal(isStudentChatMemoryStale(stale, now), true);
  });

  it("MEM-07 describeChatTimeGap ครอบคลุมเคสหลัก", () => {
    const now = new Date("2026-11-07T18:00:00+07:00");
    assert.equal(describeChatTimeGap(new Date("2026-11-07T17:00:00+07:00"), now).label, "เมื่อกี้");
    assert.equal(describeChatTimeGap(new Date("2026-11-06T10:00:00+07:00"), now).label, "เมื่อวาน");
    assert.equal(describeChatTimeGap(new Date("2026-11-04T10:00:00+07:00"), now).label, "3 วันที่แล้ว");
  });

  it("MEM-08 extractLastTopic ตัดข้อความยาว", () => {
    const topic = extractLastTopic("วันนี้รู้สึกท้อมากเพราะงานกลุ่มไม่ไปไหนเลย");
    assert.ok(topic);
    assert.ok(topic.length <= 48);
  });
});
