import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExecutivePath,
  parseExecutiveReportsPanel,
  parseExecutiveYearFilter,
} from "./executive-year-filter";

describe("parseExecutiveYearFilter", () => {
  it("รับชั้นปี 1–4", () => {
    assert.equal(parseExecutiveYearFilter("1"), "1");
    assert.equal(parseExecutiveYearFilter("4"), "4");
  });

  it("ค่าอื่นคืน ALL", () => {
    assert.equal(parseExecutiveYearFilter(null), "ALL");
    assert.equal(parseExecutiveYearFilter("ALL"), "ALL");
    assert.equal(parseExecutiveYearFilter("9"), "ALL");
    assert.equal(parseExecutiveYearFilter(""), "ALL");
  });
});

describe("parseExecutiveReportsPanel", () => {
  it("รับ comparison และค่าอื่นเป็น summary", () => {
    assert.equal(parseExecutiveReportsPanel("comparison"), "comparison");
    assert.equal(parseExecutiveReportsPanel(null), "summary");
    assert.equal(parseExecutiveReportsPanel("students"), "summary");
  });
});

describe("buildExecutivePath", () => {
  it("dashboard + ALL ไม่มี query", () => {
    assert.equal(buildExecutivePath("dashboard", "ALL"), "/executive");
  });

  it("รวม view และ year", () => {
    assert.equal(buildExecutivePath("trends", "2"), "/executive?view=trends&year=2");
    assert.equal(buildExecutivePath("dashboard", "3"), "/executive?year=3");
    assert.equal(buildExecutivePath("reports", "ALL"), "/executive?view=reports");
  });

  it("ใส่ panel เฉพาะรายงานที่ไม่ใช่ summary", () => {
    assert.equal(
      buildExecutivePath("reports", "1", { panel: "comparison" }),
      "/executive?view=reports&year=1&panel=comparison"
    );
    assert.equal(buildExecutivePath("reports", "ALL", { panel: "summary" }), "/executive?view=reports");
    assert.equal(buildExecutivePath("students", "ALL", { panel: "comparison" }), "/executive?view=students");
  });
});
