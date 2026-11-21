import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mentalHealthRoutes from "../routes/mental-health.routes";
import studentRoutes from "../routes/student.routes";

type Layer = {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
};

/** ดึง path+method จาก Express Router เพื่อกันพลาด route ที่ UI พึ่งพา */
function collectRoutes(router: { stack?: Layer[] }): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  for (const layer of router.stack ?? []) {
    const route = layer.route;
    if (!route?.path || !route.methods) {
      continue;
    }
    for (const [method, enabled] of Object.entries(route.methods)) {
      if (enabled) {
        out.push({ method: method.toUpperCase(), path: String(route.path) });
      }
    }
  }
  return out;
}

describe("mental-health schedule offer routes", () => {
  it("MHSR-01 staff router exposes create/accept/cancel schedule-offer endpoints", () => {
    const routes = collectRoutes(mentalHealthRoutes as { stack?: Layer[] });
    const paths = new Set(routes.map((item) => `${item.method} ${item.path}`));

    assert.ok(paths.has("POST /referrals/:referralId/schedule-offers"));
    assert.ok(paths.has("POST /referrals/:referralId/schedule-offers/:offerId/accept"));
    assert.ok(paths.has("POST /referrals/:referralId/schedule-offers/:offerId/cancel"));
  });

  it("MHSR-02 student router exposes create/accept/cancel schedule-offer endpoints", () => {
    const routes = collectRoutes(studentRoutes as { stack?: Layer[] });
    const paths = new Set(routes.map((item) => `${item.method} ${item.path}`));

    assert.ok(paths.has("POST /mental-health-referrals/:referralId/schedule-offers"));
    assert.ok(
      paths.has("POST /mental-health-referrals/:referralId/schedule-offers/:offerId/accept")
    );
    assert.ok(
      paths.has("POST /mental-health-referrals/:referralId/schedule-offers/:offerId/cancel")
    );
  });
});
