import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  prioritizeAndCapAlerts,
  selectAlertsForToast,
  selectFreshOpenAlerts,
  selectOpenAlertsForFirstHydrate,
  type IngestAlertDto,
} from "./dashboard-alert-ingest";

const sample = (
  id: string,
  status: IngestAlertDto["status"] = "OPEN",
  type = "ADVISOR_FOLLOW_UP"
): IngestAlertDto => ({
  id,
  title: `t-${id}`,
  message: `m-${id}`,
  status,
  type,
  createdAt: new Date().toISOString(),
});

describe("dashboard alert ingest", () => {
  it("DAI-01 hydrate ครั้งแรกโชว์ OPEN สูงสุดตาม max โดยวิกฤตก่อน", () => {
    const selected = selectOpenAlertsForFirstHydrate(
      [
        sample("1"),
        sample("sos", "OPEN", "SOS_OPENED"),
        sample("2"),
        sample("3"),
        sample("4"),
        sample("5", "CLOSED"),
      ],
      3
    );
    assert.equal(selected[0]?.id, "sos");
    assert.equal(selected.length, 3);
  });

  it("DAI-02 poll ถัดไปเลือกเฉพาะที่ยังไม่เคยเห็น", () => {
    const fresh = selectFreshOpenAlerts(
      [sample("1"), sample("2"), sample("3", "ACKNOWLEDGED")],
      new Set(["1"])
    );
    assert.deepEqual(
      fresh.map((item) => item.id),
      ["2"]
    );
  });

  it("DAI-03 เมื่อเกิน max เก็บวิกฤตไว้ ไม่เตะด้วย slice ท้ายคิว", () => {
    const capped = prioritizeAndCapAlerts(
      [
        sample("a"),
        sample("b"),
        sample("c"),
        sample("sos", "OPEN", "SOS_OPENED"),
        sample("high", "OPEN", "HIGH_RISK_SCREENING"),
      ],
      3
    );
    assert.deepEqual(
      capped.map((item) => item.id),
      ["sos", "high", "a"]
    );
  });

  it("DAI-04 hydrate เคารพ seen ids จาก session", () => {
    const selected = selectAlertsForToast(
      [sample("1"), sample("sos", "OPEN", "SOS_OPENED"), sample("2")],
      new Set(["sos", "1"]),
      3
    );
    assert.deepEqual(
      selected.map((item) => item.id),
      ["2"]
    );
  });
});
