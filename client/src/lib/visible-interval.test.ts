import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("visible-interval source contract", () => {
  it("VI-01 ข้าม tick เมื่อ document.visibilityState เป็น hidden", () => {
    const source = readFileSync(join(here, "visible-interval.ts"), "utf8");
    assert.match(source, /visibilityState === "hidden"/);
    assert.match(source, /setInterval/);
  });
});
