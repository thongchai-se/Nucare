import type { ExecutiveYearFilter } from "@/types/executive";

export type ExecutiveReportsPanel = "summary" | "comparison";

export type ExecutiveActiveView =
  | "dashboard"
  | "referrals"
  | "reports"
  | "students"
  | "messages";

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

/**
 * อ่าน view จาก query — รวมเมนูเก่า trends/departments เข้าภาพรวม
 * และรับ referrals เป็นเมนูเคสส่งต่อ
 */
export function parseExecutiveActiveView(raw: string | null | undefined): ExecutiveActiveView {
  if (raw === "referrals") {
    return "referrals";
  }
  if (raw === "reports") {
    return "reports";
  }
  if (raw === "students") {
    return "students";
  }
  if (raw === "messages") {
    return "messages";
  }
  // trends / departments / dashboard / อื่นๆ → ภาพรวม
  return "dashboard";
}

type BuildExecutivePathOptions = {
  panel?: ExecutiveReportsPanel;
  caseId?: string | null;
  studentId?: string | null;
};

/** สร้าง path พอร์ทัลผู้บริหารจาก view + ปี (+ panel / caseId / studentId) */
export function buildExecutivePath(
  view: string,
  yearFilter: ExecutiveYearFilter,
  options: BuildExecutivePathOptions = {}
): string {
  const normalizedView = parseExecutiveActiveView(view);
  const params = new URLSearchParams();

  if (normalizedView !== "dashboard") {
    params.set("view", normalizedView);
  }
  if (yearFilter !== "ALL") {
    params.set("year", yearFilter);
  }
  if (normalizedView === "reports" && options.panel && options.panel !== "summary") {
    params.set("panel", options.panel);
  }
  if (normalizedView === "referrals" && options.caseId) {
    params.set("caseId", options.caseId);
  }
  if (normalizedView === "students" && options.studentId) {
    params.set("studentId", options.studentId);
  }

  const query = params.toString();
  return query ? `/executive?${query}` : "/executive";
}
