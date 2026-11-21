import {
  ReferralStatus,
  ReferralTarget,
  type PrismaClient,
} from "@prisma/client";
import { normalizeStudyYearKey } from "./executive-analytics";
import { referralHistoryStatusLabel, stripSeedMarkers } from "./history-display";
import { referralTargetLabel } from "./referral-labels";
import { getAcceptedReferralOwners } from "./referral-ownership";
import { buildReferralRoadmap, type ReferralRoadmapStep } from "./referral-roadmap";
import { MAX_STUDY_YEAR, MIN_STUDY_YEAR } from "./study-year";
import { formatStudentIdForResponse, inferStudyYear } from "./user-format";

const LIST_TAKE = 300;

export type ExecutiveReferralStudyYearFilter = "ALL" | number;

export type ExecutiveReferralListFilters = {
  studyYear: ExecutiveReferralStudyYearFilter;
  status?: ReferralStatus;
  target?: ReferralTarget;
  urgentOnly?: boolean;
  search?: string;
};

export type ExecutiveReferralCareNote = {
  id: string;
  sessionDate: string;
  summary: string;
  interventionPlan: string;
  providerName: string;
};

export type ExecutiveReferralCaseListItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  studyYear: string;
  target: ReferralTarget;
  targetLabel: string;
  status: ReferralStatus;
  statusLabel: string;
  isUrgent: boolean;
  reason: string;
  advisorName: string;
  acceptedByName: string | null;
  currentOwnerName: string | null;
  careSessionCount: number;
  staffNote: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
  roadmap: ReferralRoadmapStep[];
};

export type ExecutiveReferralCaseDetail = ExecutiveReferralCaseListItem & {
  careNotes: ExecutiveReferralCareNote[];
};

export type ExecutiveReferralStats = {
  total: number;
  pending: number;
  accepted: number;
  closed: number;
  urgentOpen: number;
  byTarget: Array<{ target: ReferralTarget; label: string; count: number }>;
};

type ReferralRow = {
  id: string;
  target: ReferralTarget;
  status: ReferralStatus;
  isUrgent: boolean;
  reason: string;
  staffNote: string | null;
  closedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    name: string;
    studentId: string | null;
    studyYear: number | null;
  };
  advisor: { name: string };
  acceptedBy: { name: string } | null;
  specializedCareRecords: Array<{
    id: string;
    sessionDate: Date;
    summary: string;
    interventionPlan: string;
    mentalHealthUser: { name: string };
  }>;
  _count: { specializedCareRecords: number };
};

/** แปลงค่า year จาก query เป็นตัวกรองชั้นปีของเคสส่งต่อ */
export function parseExecutiveReferralStudyYear(
  raw: unknown
): ExecutiveReferralStudyYearFilter {
  if (raw === undefined || raw === null || raw === "" || raw === "ALL") {
    return "ALL";
  }

  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < MIN_STUDY_YEAR || parsed > MAX_STUDY_YEAR) {
    return "ALL";
  }

  return parsed;
}

/** นับสรุปสถานะ/ปลายทางจากรายการเคส — O(n) */
export function summarizeExecutiveReferralStats(
  items: Array<Pick<ExecutiveReferralCaseListItem, "status" | "target" | "isUrgent">>
): ExecutiveReferralStats {
  let pending = 0;
  let accepted = 0;
  let closed = 0;
  let urgentOpen = 0;
  const targetCounts = new Map<ReferralTarget, number>();

  for (const item of items) {
    if (item.status === ReferralStatus.PENDING) {
      pending += 1;
    } else if (item.status === ReferralStatus.ACCEPTED) {
      accepted += 1;
    } else if (item.status === ReferralStatus.CLOSED) {
      closed += 1;
    }

    if (item.isUrgent && item.status !== ReferralStatus.CLOSED) {
      urgentOpen += 1;
    }

    targetCounts.set(item.target, (targetCounts.get(item.target) ?? 0) + 1);
  }

  const byTarget = [...targetCounts.entries()]
    .map(([target, count]) => ({
      target,
      label: referralTargetLabel(target),
      count,
    }))
    .sort((left, right) => right.count - left.count);

  return {
    total: items.length,
    pending,
    accepted,
    closed,
    urgentOpen,
    byTarget,
  };
}

const cleanNote = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const cleaned = stripSeedMarkers(value) || value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

/** สร้าง roadmap พร้อมเหตุผลปิดเคสถ้ามี */
export function buildExecutiveReferralRoadmap(input: {
  createdAt: Date;
  status: ReferralStatus;
  advisorName: string;
  target: ReferralTarget;
  reason: string;
  isUrgent: boolean;
  acceptedAt: Date | null;
  acceptedByName: string | null;
  closedAt: Date | null;
  closedReason: string | null;
  careSessionCount: number;
  latestCareSessionAt: Date | null;
  latestCareProviderName: string | null;
}): ReferralRoadmapStep[] {
  const steps = buildReferralRoadmap({
    createdAt: input.createdAt,
    status: input.status,
    advisorName: input.advisorName,
    targetLabel: referralTargetLabel(input.target),
    reason: input.reason,
    isUrgent: input.isUrgent,
    acceptedAt: input.acceptedAt,
    acceptedByName: input.acceptedByName,
    closedAt: input.closedAt,
    careSessionCount: input.careSessionCount,
    latestCareSessionAt: input.latestCareSessionAt,
    latestCareProviderName: input.latestCareProviderName,
  });

  const closedReason = cleanNote(input.closedReason);
  if (closedReason) {
    const closedStep = steps.find((step) => step.kind === "closed");
    if (closedStep) {
      closedStep.detail = `เหตุผลปิด: ${closedReason}`;
    }
  }

  return steps;
}

/** แปลงแถว Prisma เป็นรายการเคสสำหรับผู้บริหาร */
export function mapExecutiveReferralListItem(
  row: ReferralRow,
  acceptedAt: Date | null,
  acceptedByName: string | null
): ExecutiveReferralCaseListItem {
  const latestCare = row.specializedCareRecords[0] ?? null;
  const currentOwnerName =
    latestCare?.mentalHealthUser.name ?? acceptedByName ?? row.acceptedBy?.name ?? null;
  const reason = cleanNote(row.reason) ?? row.reason;

  return {
    id: row.id,
    studentId: row.student.id,
    studentName: row.student.name,
    studentCode: formatStudentIdForResponse(row.student.studentId),
    studyYear: inferStudyYear(row.student.studentId, row.student.studyYear),
    target: row.target,
    targetLabel: referralTargetLabel(row.target),
    status: row.status,
    statusLabel: referralHistoryStatusLabel(row.status),
    isUrgent: row.isUrgent,
    reason,
    advisorName: row.advisor.name,
    acceptedByName: acceptedByName ?? row.acceptedBy?.name ?? null,
    currentOwnerName,
    careSessionCount: row._count.specializedCareRecords,
    staffNote: cleanNote(row.staffNote),
    closedReason: cleanNote(row.closedReason),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    roadmap: buildExecutiveReferralRoadmap({
      createdAt: row.createdAt,
      status: row.status,
      advisorName: row.advisor.name,
      target: row.target,
      reason,
      isUrgent: row.isUrgent,
      acceptedAt,
      acceptedByName: currentOwnerName,
      closedAt: row.status === ReferralStatus.CLOSED ? row.updatedAt : null,
      closedReason: row.closedReason,
      careSessionCount: row._count.specializedCareRecords,
      latestCareSessionAt: latestCare?.sessionDate ?? null,
      latestCareProviderName: latestCare?.mentalHealthUser.name ?? null,
    }),
  };
}

const matchesSearch = (item: ExecutiveReferralCaseListItem, search: string | undefined): boolean => {
  if (!search) {
    return true;
  }

  const needle = search.trim().toLowerCase();
  if (needle.length < 2) {
    return true;
  }

  const haystack = [
    item.studentName,
    item.studentCode ?? "",
    item.advisorName,
    item.currentOwnerName ?? "",
    item.targetLabel,
    item.reason,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
};

const referralInclude = {
  student: {
    select: {
      id: true,
      name: true,
      studentId: true,
      studyYear: true,
    },
  },
  advisor: { select: { name: true } },
  acceptedBy: { select: { name: true } },
  specializedCareRecords: {
    select: {
      id: true,
      sessionDate: true,
      summary: true,
      interventionPlan: true,
      mentalHealthUser: { select: { name: true } },
    },
    orderBy: { sessionDate: "desc" as const },
    take: 12,
  },
  _count: { select: { specializedCareRecords: true } },
} as const;

/** โหลดรายการเคสส่งต่อทั้งคณะสำหรับผู้บริหาร (อ่านอย่างเดียว) */
export async function listExecutiveReferralCases(
  db: PrismaClient,
  filters: ExecutiveReferralListFilters
): Promise<{ items: ExecutiveReferralCaseListItem[]; stats: ExecutiveReferralStats }> {
  const rows = (await db.caseReferral.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.target ? { target: filters.target } : {}),
      ...(filters.urgentOnly ? { isUrgent: true } : {}),
    },
    include: referralInclude,
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
    take: LIST_TAKE,
  })) as ReferralRow[];

  const owners = await getAcceptedReferralOwners(rows.map((row) => row.id));

  const items: ExecutiveReferralCaseListItem[] = [];
  for (const row of rows) {
    const yearKey = normalizeStudyYearKey(row.student.studyYear);
    if (filters.studyYear !== "ALL" && yearKey !== filters.studyYear) {
      continue;
    }

    const owner = owners.get(row.id) ?? null;
    const mapped = mapExecutiveReferralListItem(
      row,
      owner?.createdAt ?? (row.status === ReferralStatus.PENDING ? null : row.updatedAt),
      owner?.actorName ?? row.acceptedBy?.name ?? null
    );

    if (!matchesSearch(mapped, filters.search)) {
      continue;
    }

    items.push(mapped);
  }

  return {
    items,
    stats: summarizeExecutiveReferralStats(items),
  };
}

/** โหลดรายละเอียดเคสส่งต่อ + บันทึกดูแล (ไม่รวมหมายเหตุคลินิกลับ) */
export async function getExecutiveReferralCaseDetail(
  db: PrismaClient,
  referralId: string
): Promise<"not_found" | ExecutiveReferralCaseDetail> {
  const row = (await db.caseReferral.findUnique({
    where: { id: referralId },
    include: referralInclude,
  })) as ReferralRow | null;

  if (!row) {
    return "not_found";
  }

  const owners = await getAcceptedReferralOwners([row.id]);
  const owner = owners.get(row.id) ?? null;
  const base = mapExecutiveReferralListItem(
    row,
    owner?.createdAt ?? (row.status === ReferralStatus.PENDING ? null : row.updatedAt),
    owner?.actorName ?? row.acceptedBy?.name ?? null
  );

  return {
    ...base,
    careNotes: row.specializedCareRecords.map((care) => ({
      id: care.id,
      sessionDate: care.sessionDate.toISOString(),
      summary: cleanNote(care.summary) ?? care.summary,
      interventionPlan: cleanNote(care.interventionPlan) ?? care.interventionPlan,
      providerName: care.mentalHealthUser.name,
    })),
  };
}
