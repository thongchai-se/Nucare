"use client";

import { Flag, Send, Users } from "lucide-react";
import {
  RosterActionLink,
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterTable,
  RosterTd,
} from "@/components/ui/roster-table";
import { stripSeedMarkers } from "@/lib/history-display";
import { STATUS_BADGE_COMPACT } from "@/lib/status-badge";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_ACTION_SECONDARY_COMPACT,
  UI_STATUS_ACTIVE,
  UI_STATUS_PENDING,
} from "@/lib/ui-classes";
import type { AdvisorAlertItem } from "./types";

export type AcademicAdviseeSignal = {
  id: string;
  name: string;
  studentId: string | null;
  year: string;
  behaviorRecordCount: number;
  riskLevel: "high" | "medium" | "normal";
};

type AcademicSignalsViewProps = {
  students: AcademicAdviseeSignal[];
  behaviorAlerts: AdvisorAlertItem[];
  updatingAlertId: string | null;
  studentsWithActiveReferral: ReadonlySet<string>;
  formatThaiDateTime: (value: string | null) => string;
  onOpenAdvisee: (studentId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onCloseAlert: (alertId: string, options?: { dismissOnly?: boolean }) => void;
  onReferStudent: (studentId: string, alertId: string) => void;
};

/** สรุปนิสิตที่มีบันทึกข้อสังเกตจากผู้สอน และคิวรับเรื่อง / ปิดเรื่อง / ส่งต่อ */
export function AcademicSignalsView({
  students,
  behaviorAlerts,
  updatingAlertId,
  studentsWithActiveReferral,
  formatThaiDateTime,
  onOpenAdvisee,
  onAcknowledgeAlert,
  onCloseAlert,
  onReferStudent,
}: AcademicSignalsViewProps) {
  const flaggedStudents = [...students]
    .filter((student) => student.behaviorRecordCount > 0)
    .sort((left, right) => right.behaviorRecordCount - left.behaviorRecordCount);

  const openOrAckAlerts = behaviorAlerts.filter((alert) => alert.status !== "CLOSED");
  const studentNameById = new Map(students.map((student) => [student.id, student.name]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">สัญญาณเข้า</h2>
        <p className="mt-1 text-sm text-slate-600">
          ข้อสังเกตจากอาจารย์ท่านอื่นเกี่ยวกับนิสิตในดูแลของคุณ
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="text-lg font-bold text-slate-800">คิวรับเรื่องจากอาจารย์</h3>
          <p className="mt-1 text-sm text-slate-500">
            รับเรื่อง → พูดคุยแล้วกดบันทึกและปิดเคส หรือส่งต่อผู้เชี่ยวชาญได้ตามดุลพินิจ (ไม่จำเป็นต้องเป็นเคสวิกฤต)
          </p>
        </div>
        {openOrAckAlerts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">ยังไม่มีรายการรอรับหรือกำลังติดตาม</div>
        ) : (
          <ul className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto">
            {openOrAckAlerts.map((alert) => {
              const busy = updatingAlertId === alert.id;
              const linkedStudentId = alert.studentId;
              const studentName = linkedStudentId ? studentNameById.get(linkedStudentId) : null;
              const hasOpenReferral = Boolean(
                linkedStudentId && studentsWithActiveReferral.has(linkedStudentId)
              );
              const canRefer = Boolean(linkedStudentId) && !hasOpenReferral;
              const rawTitle = stripSeedMarkers(alert.title) || alert.title;
              // กันชื่อซ้ำ: title เก่าแบบ «ข้อสังเกต: ชื่อ» + บรรทัดชื่อด้านล่าง
              const titleHasStudentName = Boolean(
                studentName && rawTitle.replace(/\s+/g, " ").includes(studentName.replace(/\s+/g, " "))
              );
              const heading = studentName
                ? studentName
                : titleHasStudentName
                  ? rawTitle
                  : rawTitle || "ข้อสังเกตจากอาจารย์";
              const subLabel =
                studentName && !titleHasStudentName && rawTitle && rawTitle !== studentName
                  ? rawTitle
                  : studentName
                    ? "ข้อสังเกตจากอาจารย์"
                    : null;

              return (
                <li key={alert.id} className="px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`${STATUS_BADGE_COMPACT} ${
                            alert.status === "OPEN" ? UI_STATUS_PENDING : UI_STATUS_ACTIVE
                          }`}
                        >
                          {alert.status === "OPEN" ? "รอรับเรื่อง" : "รับเรื่องแล้ว"}
                        </span>
                        {subLabel ? (
                          <p className="text-[11px] font-semibold text-slate-500">{subLabel}</p>
                        ) : null}
                      </div>
                      <p className="text-sm font-bold text-[#0057A8]">{heading}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {stripSeedMarkers(alert.message) || alert.message}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">{formatThaiDateTime(alert.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {alert.status === "OPEN" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className={UI_ACTION_PRIMARY_COMPACT}
                        >
                          รับเรื่อง
                        </button>
                      ) : null}
                      {alert.status === "ACKNOWLEDGED" ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onCloseAlert(alert.id)}
                            className={UI_ACTION_SECONDARY_COMPACT}
                          >
                            บันทึกและปิดเคส
                          </button>
                          {linkedStudentId ? (
                            <button
                              type="button"
                              disabled={busy || !canRefer}
                              title={
                                hasOpenReferral
                                  ? "มีเคสส่งต่อที่ยังไม่ปิดอยู่แล้ว"
                                  : "ส่งต่อได้ตามดุลพินิจ — ต้องเขียนข้อมูลให้ผู้เชี่ยวชาญอ่าน"
                              }
                              onClick={() => onReferStudent(linkedStudentId, alert.id)}
                              className={UI_ACTION_PRIMARY_COMPACT}
                            >
                              <Send className="h-3.5 w-3.5" />
                              ส่งต่อ
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">นิสิตที่มีบันทึกจากผู้สอน</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{flaggedStudents.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">เสี่ยงสูงในกลุ่มนี้</p>
          <p className="mt-3 text-3xl font-bold text-red-700">
            {flaggedStudents.filter((student) => student.riskLevel === "high").length}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-slate-900">รายชื่อที่มีบันทึกจากผู้สอน</h3>
        </div>
        <RosterTable
          columns={[
            { key: "student", label: "ชื่อ-นามสกุล", width: "36%" },
            { key: "year", label: "ชั้นปี", width: "12%", align: "center" },
            { key: "records", label: "บันทึก", width: "16%", align: "center" },
            { key: "risk", label: "สถานะ", width: "18%", align: "center" },
            { key: "actions", label: "จัดการ", width: "18%", align: "right" },
          ]}
          emptyMessage={
            <span className="inline-flex flex-col items-center gap-2">
              <Flag className="h-5 w-5 text-slate-300" />
              ยังไม่มีสัญญาณจากผู้สอน
            </span>
          }
        >
          {flaggedStudents.map((student) => (
            <RosterRow key={student.id}>
              <RosterTd>
                <RosterPersonCell name={student.name} meta={student.studentId || "-"} />
              </RosterTd>
              <RosterTd align="center">{student.year || "-"}</RosterTd>
              <RosterTd align="center">{student.behaviorRecordCount}</RosterTd>
              <RosterTd align="center">
                <span
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                    student.riskLevel === "high"
                      ? "bg-red-100 text-red-800"
                      : student.riskLevel === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {student.riskLevel === "high"
                    ? "เสี่ยงสูง"
                    : student.riskLevel === "medium"
                      ? "ปานกลาง"
                      : "ปกติ"}
                </span>
              </RosterTd>
              <RosterTd align="right">
                <RosterActionLink onClick={() => onOpenAdvisee(student.id)}>
                  <Users className="h-3.5 w-3.5" />
                  เปิดประวัติ
                </RosterActionLink>
              </RosterTd>
            </RosterRow>
          ))}
        </RosterTable>
        <RosterMobileList
          emptyMessage={
            <span className="inline-flex flex-col items-center gap-2">
              <Flag className="h-5 w-5 text-slate-300" />
              ยังไม่มีสัญญาณจากผู้สอน
            </span>
          }
        >
          {flaggedStudents.map((student) => (
            <RosterMobileCard key={student.id}>
              <RosterPersonCell
                name={student.name}
                meta={`${student.studentId || "-"} · ปี ${student.year}`}
              />
              <p className="text-sm text-slate-600">บันทึก {student.behaviorRecordCount} รายการ</p>
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    student.riskLevel === "high"
                      ? "bg-red-100 text-red-800"
                      : student.riskLevel === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {student.riskLevel === "high"
                    ? "เสี่ยงสูง"
                    : student.riskLevel === "medium"
                      ? "ปานกลาง"
                      : "ปกติ"}
                </span>
                <RosterActionLink onClick={() => onOpenAdvisee(student.id)}>
                  <Users className="h-3.5 w-3.5" />
                  เปิดประวัติ
                </RosterActionLink>
              </div>
            </RosterMobileCard>
          ))}
        </RosterMobileList>
      </section>
    </div>
  );
}
