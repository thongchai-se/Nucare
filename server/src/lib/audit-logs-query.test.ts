import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAuditLogCreatedAtFilter,
  listAuditLogsQuerySchema,
} from "../validators/audit-logs";

describe("audit logs query", () => {
  it("ALQ-01 รับ limit สูงสุด 500 และค่าเริ่มต้นผ่าน", () => {
    const ok = listAuditLogsQuerySchema.safeParse({ limit: "500" });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.limit, 500);
    }

    const tooHigh = listAuditLogsQuerySchema.safeParse({ limit: 501 });
    assert.equal(tooHigh.success, false);
  });

  it("ALQ-02 กรองช่วงวันและปฏิเสธ from > to", () => {
    const ok = listAuditLogsQuerySchema.safeParse({
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-21T23:59:59.000Z",
    });
    assert.equal(ok.success, true);

    const bad = listAuditLogsQuerySchema.safeParse({
      from: "2026-11-21T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    });
    assert.equal(bad.success, false);
  });

  it("ALQ-03 buildAuditLogCreatedAtFilter", () => {
    assert.equal(buildAuditLogCreatedAtFilter({}), undefined);
    const from = new Date("2026-11-01T00:00:00.000Z");
    const to = new Date("2026-11-21T00:00:00.000Z");
    assert.deepEqual(buildAuditLogCreatedAtFilter({ from, to }), { gte: from, lte: to });
  });
});
