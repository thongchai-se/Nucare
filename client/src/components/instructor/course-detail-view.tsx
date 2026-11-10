"use client";

import { Filter, Search, X } from "lucide-react";
import type { BehaviorRecordStatus, BehaviorSeverity, InstructorStudent, StudentGroup } from "./types";

type CourseDetailViewProps = {
  selectedGroup: StudentGroup | null;
  studentsInSelectedGroup: InstructorStudent[];
  detailSearch: string;
  onDetailSearchChange: (value: string) => void;
  onBack: () => void;
  onOpenReport: (studentId: string) => void;
  getStudentReportCount: (studentId: string) => number;
  getStudentHighestSeverity: (studentId: string) => BehaviorSeverity | null;
  getStudentLatestStatus: (studentId: string) => BehaviorRecordStatus | "NORMAL";
  severityBadgeMap: Record<BehaviorSeverity, string>;
  severityLabelMap: Record<BehaviorSeverity, string>;
};

export function CourseDetailView({
  selectedGroup,
  studentsInSelectedGroup,
  detailSearch,
  onDetailSearchChange,
  onBack,
  onOpenReport,
  getStudentReportCount,
  getStudentHighestSeverity,
  getStudentLatestStatus,
  severityBadgeMap,
  severityLabelMap,
}: CourseDetailViewProps) {
  return (
  
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onBack()}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:text-slate-800"
        >
          <X size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{selectedGroup?.name}</h2>
          <p className="text-xs font-medium text-slate-500">
            {selectedGroup?.code} • {studentsInSelectedGroup.length} นักศึกษา
          </p>
        </div>
      </div>
  
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={detailSearch}
              onChange={(event) => onDetailSearchChange(event.target.value)}
              placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            <Filter size={16} /> {selectedGroup?.name}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="p-4 font-bold text-slate-600">นักศึกษา</th>
                <th className="p-4 font-bold text-slate-600">ประวัติการแจ้ง</th>
                <th className="p-4 font-bold text-slate-600">ความเสี่ยงสะสม</th>
                <th className="p-4 font-bold text-slate-600">สถานะล่าสุด</th>
                <th className="p-4 text-center font-bold text-slate-600">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsInSelectedGroup.map((student) => {
                const reportCount = getStudentReportCount(student.id);
                const highestSeverity = getStudentHighestSeverity(student.id);
                const latestStatus = getStudentLatestStatus(student.id);
  
                return (
                  <tr key={student.id} className="transition-colors hover:bg-blue-50/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">
                          {(student.studentId || "--").slice(-2)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate leading-none font-bold text-slate-800">{student.name}</p>
                          <p className="mt-1 text-[10px] text-slate-500">{student.studentId || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-600">{reportCount === 0 ? "ยังไม่เคยแจ้ง" : `${reportCount} ครั้ง`}</td>
                    <td className="p-4">
                      {highestSeverity ? (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${severityBadgeMap[highestSeverity]}`}>
                          {severityLabelMap[highestSeverity]}
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">Normal</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`flex items-center gap-1.5 text-xs font-bold ${
                          latestStatus === "PENDING"
                            ? "text-blue-600"
                            : latestStatus === "ACKNOWLEDGED"
                              ? "text-emerald-600"
                              : latestStatus === "COMPLETED"
                                ? "text-indigo-600"
                                : "text-slate-400"
                        }`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            latestStatus === "PENDING"
                              ? "bg-blue-500"
                              : latestStatus === "ACKNOWLEDGED"
                                ? "bg-emerald-500"
                                : latestStatus === "COMPLETED"
                                  ? "bg-indigo-500"
                                  : "bg-slate-300"
                          }`}
                        ></div>
                        {latestStatus === "PENDING"
                          ? "แจ้งเรื่องแล้ว"
                          : latestStatus === "ACKNOWLEDGED"
                            ? "รับทราบแล้ว"
                            : latestStatus === "COMPLETED"
                              ? "ปิดเคสแล้ว"
                              : "ปกติ"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => onOpenReport(student.id)}
                        className="rounded-full border border-[#0057A8]/25 bg-[#278ACA]/10 px-3 py-1.5 text-xs font-semibold text-[#0057A8] transition-colors hover:bg-[#278ACA]/20"
                      >
                        แจ้งปัญหา
                      </button>
                    </td>
                  </tr>
                );
              })}
              {studentsInSelectedGroup.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                    ไม่พบนักศึกษาตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  
  );
}
