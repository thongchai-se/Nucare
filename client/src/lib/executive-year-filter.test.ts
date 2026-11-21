import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExecutivePath,
  parseExecutiveActiveView,
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

describe("parseExecutiveActiveView", () => {
  it("รวม trends/departments เข้า dashboard และรับ referrals", () => {
    assert.equal(parseExecutiveActiveView(null), "dashboard");
    assert.equal(parseExecutiveActiveView("trends"), "dashboard");
    assert.equal(parseExecutiveActiveView("departments"), "dashboard");
    assert.equal(parseExecutiveActiveView("referrals"), "referrals");
    assert.equal(parseExecutiveActiveView("reports"), "reports");
    assert.equal(parseExecutiveActiveView("students"), "students");
    assert.equal(parseExecutiveActiveView("messages"), "messages");
  });
});

describe("buildExecutivePath", () => {
  it("dashboard + ALL ไม่มี query", () => {
    assert.equal(buildExecutivePath("dashboard", "ALL"), "/executive");
  });

  it("รวม view และ year และ map เมนูเก่า", () => {
    assert.equal(buildExecutivePath("trends", "2"), "/executive?year=2");
    assert.equal(buildExecutivePath("dashboard", "3"), "/executive?year=3");
    assert.equal(buildExecutivePath("reports", "ALL"), "/executive?view=reports");
    assert.equal(buildExecutivePath("referrals", "1"), "/executive?view=referrals&year=1");
  });

  it("ใส่ panel / caseId / studentId ตาม view", () => {
    assert.equal(
      buildExecutivePath("reports", "1", { panel: "comparison" }),
      "/executive?view=reports&year=1&panel=comparison"
    );
    assert.equal(buildExecutivePath("reports", "ALL", { panel: "summary" }), "/executive?view=reports");
    assert.equal(buildExecutivePath("students", "ALL", { panel: "comparison" }), "/executive?view=students");
    assert.equal(
      buildExecutivePath("referrals", "ALL", { caseId: "ref-1" }),
      "/executive?view=referrals&caseId=ref-1"
    );
    assert.equal(
      buildExecutivePath("students", "2", { studentId: "stu-1" }),
      "/executive?view=students&year=2&studentId=stu-1"
    );
    assert.equal(
      buildExecutivePath("students", "ALL", { studentId: null }),
      "/executive?view=students"
    );
  });
});
