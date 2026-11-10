import type { ExecutiveYearFilter } from "@/types/executive";

export type ExecutiveReportsPanel = "summary" | "comparison";

/** อ่านค่า year จาก query ให้เป็นตัวกรองชั้นปีที่รองรับ */
export function parseExecutiveYearFilter(raw: string | null | undefined): ExecutiveYearFilter {
  if (raw === "1" || raw === "2" || raw === "3" || raw === "4") {
    return raw;
  }

  return "ALL";
}

/** อ่านแท็บย่อยของรายงานเชิงลึกจาก query */
export function parseExecutiveReportsPanel(raw: string | null | undefined): ExecutiveReportsPanel {
  return raw === "comparison" ? "comparison" : "summary";
}

type BuildExecutivePathOptions = {
  panel?: ExecutiveReportsPanel;
};

/** สร้าง path พอร์ทัลผู้บริหารจาก view + ปี (+ panel ของรายงาน) */
export function buildExecutivePath(
  view: string,
  yearFilter: ExecutiveYearFilter,
  options: BuildExecutivePathOptions = {}
): string {
  const params = new URLSearchParams();
  if (view && view !== "dashboard") {
    params.set("view", view);
  }
  if (yearFilter !== "ALL") {
    params.set("year", yearFilter);
  }
  if (view === "reports" && options.panel && options.panel !== "summary") {
    params.set("panel", options.panel);
  }
  const query = params.toString();
  return query ? `/executive?${query}` : "/executive";
}
