"use client";

import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterCountBadge,
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterSearchInput,
  RosterTable,
  RosterTableCard,
  RosterTd,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import { getNameInitials } from "@/lib/name-prefix";
import { formatStudentIdDisplay } from "@/lib/student-id";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_ACTION_SECONDARY_COMPACT,
  UI_STATUS_PENDING,
} from "@/lib/ui-classes";
import { hasActiveReferral } from "./referral-active";
import type {
  AdvisorReferralItem,
  AdvisorStudent,
  ReferralStatus,
  RiskMeta,
  StudentRiskLevel,
} from "./types";

type AdviseesViewProps = {
  filteredStudents: AdvisorStudent[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  riskMeta: Record<StudentRiskLevel, RiskMeta>;
  referralStatusMap: Record<ReferralStatus, { label: string; className: string }>;
  latestReferralByStudent: Map<string, AdvisorReferralItem>;
  formatAssessmentSummary: (student: AdvisorStudent) => string;
  onOpenStudent: (studentId: string) => void;
  onOpenSoap: (student: AdvisorStudent) => void;
  onOpenReferral: (student: AdvisorStudent) => void;
};

function StatusPills({
  student,
  meta,
  referralBadge,
  latestReferral,
}: {
  student: AdvisorStudent;
  meta: RiskMeta;
  referralBadge: { label: string; className: string } | null;
  latestReferral?: AdvisorReferralItem;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.badgeClassName}`}>
        {meta.label}
      </span>
      {referralBadge ? (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
            latestReferral?.status === "PENDING" ? UI_STATUS_PENDING : referralBadge.className
          }`}
        >
          {referralBadge.label}
        </span>
      ) : null}
      {student.hasCrisisWellnessSignal ? (
        <span className="inline-flex rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
          สัญญาณวิกฤต
        </span>
      ) : null}
    </div>
  );
}

function RowActions({
  student,
  referralBlocked,
  latestReferral,
  onOpenStudent,
  onOpenSoap,
  onOpenReferral,
}: {
  student: AdvisorStudent;
  referralBlocked: boolean;
  latestReferral?: AdvisorReferralItem;
  onOpenStudent: (studentId: string) => void;
  onOpenSoap: (student: AdvisorStudent) => void;
  onOpenReferral: (student: AdvisorStudent) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        onClick={() => onOpenStudent(student.id)}
        className={UI_ACTION_SECONDARY_COMPACT}
      >
        ดูรายละเอียด
      </button>
      <button type="button" onClick={() => onOpenSoap(student)} className={UI_ACTION_SECONDARY_COMPACT}>
        บันทึกดูแล
      </button>
      <button
        type="button"
        onClick={() => onOpenReferral(student)}
        disabled={referralBlocked}
        title={
          referralBlocked
            ? latestReferral?.status === "ACCEPTED"
              ? "มีเคสที่กำลังดูแลอยู่แล้ว"
              : "มีเคสส่งต่อที่รอรับอยู่แล้ว"
            : "ส่งต่อเคส"
        }
        className={UI_ACTION_PRIMARY_COMPACT}
      >
        ส่งต่อ
      </button>
    </div>
  );
}

/** รายชื่อนิสิตในที่ปรึกษา — ตารางโทนเดียวกับติดตามคัดกรอง */
export function AdviseesView(props: AdviseesViewProps) {
  const {
    filteredStudents,
    searchTerm,
    onSearchTermChange,
    riskMeta,
    referralStatusMap,
    latestReferralByStudent,
    formatAssessmentSummary,
    onOpenStudent,
    onOpenSoap,
    onOpenReferral,
  } = props;

  const pagination = useListPagination(filteredStudents, searchTerm);
  const pageItems = pagination.pageItems;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">นักศึกษาในที่ปรึกษา</h2>
        <p className="mt-1 text-sm text-slate-500">
          กด «ดูรายละเอียด» หรือชื่อนิสิตเพื่อเปิดประวัติประเมิน สัญญาณจาก AI และบันทึกดูแล
        </p>
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput
              value={searchTerm}
              onChange={onSearchTermChange}
              placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
              aria-label="ค้นหานักศึกษา"
            />
            <RosterToolbarEnd>
              <RosterCountBadge count={filteredStudents.length} />
            </RosterToolbarEnd>
          </>
        }
      >
        <RosterTable
          columns={[
            { key: "student", label: "นักศึกษา", width: "24%" },
            { key: "year", label: "ชั้นปี", width: "8%" },
            { key: "status", label: "สถานะ", width: "18%" },
            { key: "summary", label: "สรุปประเมิน", width: "18%" },
            { key: "actions", label: "จัดการ", align: "center", width: "32%" },
          ]}
          emptyMessage={
            searchTerm.trim() ? "ไม่พบนักศึกษาที่ตรงกับคำค้น" : "ยังไม่มีนักศึกษาในที่ปรึกษา"
          }
        >
          {pageItems.map((student) => {
            const meta = riskMeta[student.riskLevel];
            const latestReferral = latestReferralByStudent.get(student.id);
            const referralBlocked = hasActiveReferral(latestReferral?.status);
            const referralBadge =
              latestReferral && referralBlocked ? referralStatusMap[latestReferral.status] : null;
            const code = formatStudentIdDisplay(student.studentId);

            return (
              <RosterRow key={student.id}>
                <RosterTd>
                  <RosterPersonCell
                    name={student.name}
                    meta={code}
                    avatarText={student.image || getNameInitials(student.name, "นศ")}
                    onClick={() => onOpenStudent(student.id)}
                  />
                </RosterTd>
                <RosterTd className="font-medium text-slate-600">{student.year || "-"}</RosterTd>
                <RosterTd>
                  <StatusPills
                    student={student}
                    meta={meta}
                    referralBadge={referralBadge}
                    latestReferral={latestReferral}
                  />
                </RosterTd>
                <RosterTd>
                  <p className="truncate text-slate-500">{formatAssessmentSummary(student)}</p>
                </RosterTd>
                <RosterTd align="center">
                  <RowActions
                    student={student}
                    referralBlocked={referralBlocked}
                    latestReferral={latestReferral}
                    onOpenStudent={onOpenStudent}
                    onOpenSoap={onOpenSoap}
                    onOpenReferral={onOpenReferral}
                  />
                </RosterTd>
              </RosterRow>
            );
          })}
        </RosterTable>

        <RosterMobileList
          emptyMessage={
            searchTerm.trim() ? (
              "ไม่พบนักศึกษาที่ตรงกับคำค้น"
            ) : (
              <EmptyState
                icon={Users}
                title="ยังไม่มีนักศึกษาในที่ปรึกษา"
                description="เมื่อมีการมอบหมายนักศึกษา รายชื่อจะแสดงที่นี่"
              />
            )
          }
        >
          {pageItems.map((student) => {
            const meta = riskMeta[student.riskLevel];
            const latestReferral = latestReferralByStudent.get(student.id);
            const referralBlocked = hasActiveReferral(latestReferral?.status);
            const referralBadge =
              latestReferral && referralBlocked ? referralStatusMap[latestReferral.status] : null;
            const code = formatStudentIdDisplay(student.studentId);

            return (
              <RosterMobileCard key={student.id}>
                <button type="button" onClick={() => onOpenStudent(student.id)} className="w-full text-left">
                  <RosterPersonCell
                    name={student.name}
                    meta={`${code} • ปี ${student.year || "-"}`}
                    avatarText={student.image || getNameInitials(student.name, "นศ")}
                  />
                </button>
                <div className="mt-3">
                  <StatusPills
                    student={student}
                    meta={meta}
                    referralBadge={referralBadge}
                    latestReferral={latestReferral}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-500">{formatAssessmentSummary(student)}</p>
                <div className="mt-4">
                  <RowActions
                    student={student}
                    referralBlocked={referralBlocked}
                    latestReferral={latestReferral}
                    onOpenStudent={onOpenStudent}
                    onOpenSoap={onOpenSoap}
                    onOpenReferral={onOpenReferral}
                  />
                </div>
              </RosterMobileCard>
            );
          })}
        </RosterMobileList>

        {pagination.total > pagination.rowsPerPage ? (
          <ListPaginationFooter
            total={pagination.total}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            currentPage={pagination.currentPage}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPrev={() => pagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => pagination.setCurrentPage((prev) => prev + 1)}
          />
        ) : null}
      </RosterTableCard>
    </div>
  );
}
