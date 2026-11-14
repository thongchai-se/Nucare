import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNextPersona } from "./persona-switch";
import type { StudentChatPersona } from "./types";

const personas: StudentChatPersona[] = [
  {
    id: "peer-male",
    gender: "male",
    displayName: "พี่ต้น",
    shortBio: "",
    greeting: "หวัดดีครับ",
  },
  {
    id: "peer-female",
    gender: "female",
    displayName: "พี่เมย์",
    shortBio: "",
    greeting: "หวัดดีค่ะ",
  },
];

describe("getNextPersona", () => {
  it("สลับจากพี่ต้นไปพี่เมย์", () => {
    const next = getNextPersona(personas, "peer-male");
    assert.equal(next?.id, "peer-female");
  });

  it("สลับจากพี่เมย์กลับไปพี่ต้น", () => {
    const next = getNextPersona(personas, "peer-female");
    assert.equal(next?.id, "peer-male");
  });

  it("รายการเดียวหรือยังไม่เลือก — ไม่สลับ", () => {
    assert.equal(getNextPersona(personas.slice(0, 1), "peer-male"), null);
    assert.equal(getNextPersona(personas, null), null);
  });
});
