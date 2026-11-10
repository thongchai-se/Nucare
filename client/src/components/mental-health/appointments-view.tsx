"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, Clock3, History, MapPin, Users } from "lucide-react";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { useListPagination } from "@/hooks/use-list-pagination";
import { UI_ACTION_SECONDARY_COMPACT, UI_BUTTON_PRIMARY } from "@/lib/ui-classes";
import type {
  MentalHealthAppointment,
  MentalHealthAppointmentStatus,
  MentalHealthCase,
  RiskClasses,
} from "./types";

type AppointmentsViewProps = {
  filteredAppointments: MentalHealthAppointment[];
  casesWithoutAppointments: MentalHealthCase[];
  formatThaiDate: (value: string) => string;
  formatTime: (value: string) => string;
  getRiskClasses: (riskLevel: MentalHealthCase["riskLevel"]) => RiskClasses;
  openAppointmentModal: (item?: MentalHealthCase) => void;
  onUpdateAppointmentStatus: (
    appointmentId: string,
    status: Exclude<MentalHealthAppointmentStatus, "SCHEDULED">
  ) => void | Promise<void>;
};

const statusLabel: Record<MentalHealthAppointmentStatus, string> = {
  SCHEDULED: "นัดหมายแล้ว",
  COMPLETED: "พบแล้ว",
  CANCELLED: "ยกเลิก",
  NO_SHOW: "ไม่มาตามนัด",
};

const statusBadgeClass: Record<MentalHealthAppointmentStatus, string> = {
  SCHEDULED: "bg-[#0057A8] text-white",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  NO_SHOW: "bg-amber-100 text-amber-800",
};

export function AppointmentsView({
  filteredAppointments,
  casesWithoutAppointments,
  formatThaiDate,
  formatTime,
  getRiskClasses,
  openAppointmentModal,
  onUpdateAppointmentStatus,
}: AppointmentsViewProps) {
  const [showHistory, setShowHistory] = useState(false);

  const upcomingAppointments = useMemo(
    () => filteredAppointments.filter((item) => item.status === "SCHEDULED"),
    [filteredAppointments]
  );
  const historyAppointments = useMemo(
    () =>
      filteredAppointments
        .filter((item) => item.status !== "SCHEDULED")
        .sort((left, right) => {
          const leftValue = `${left.date}T${left.time || "00:00"}`;
          const rightValue = `${right.date}T${right.time || "00:00"}`;
          return new Date(rightValue).getTime() - new Date(leftValue).getTime();
        }),
    [filteredAppointments]
  );

  const appointmentPagination = useListPagination(upcomingAppointments, upcomingAppointments.length, {
    fixedRowsPerPage: 8,
  });
  const historyPagination = useListPagination(historyAppointments, historyAppointments.length, {
    fixedRowsPerPage: 6,
  });
  const waitingPagination = useListPagination(casesWithoutAppointments, casesWithoutAppointments.length, {
    fixedRowsPerPage: 8,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">นัดหมาย</h2>
          <p className="mt-1 text-sm text-slate-600">
            สร้างนัดจากเคสที่รับแล้ว → หลังพบกด “พบแล้ว” เพื่อบันทึกผลต่อ
          </p>
        </div>
        <button type="button" onClick={() => openAppointmentModal()} className={`${UI_BUTTON_PRIMARY} w-full sm:w-auto`}>
          เพิ่มนัดหมายใหม่
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800">นัดที่รอพบ</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {upcomingAppointments.length}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {appointmentPagination.pageItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{item.studentName}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatThaiDate(item.date)} • {formatTime(item.time)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location || "ยังไม่ระบุสถานที่"}
                    </p>
                    {item.providerName ? (
                      <p className="mt-1 text-xs text-slate-500">ผู้ให้คำปรึกษา: {item.providerName}</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${statusBadgeClass.SCHEDULED}`}>
                    {statusLabel.SCHEDULED}
                  </span>
                </div>
                {item.note ? <p className="mt-3 text-sm text-slate-600">{item.note}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onUpdateAppointmentStatus(item.id, "COMPLETED")}
                    className={UI_ACTION_SECONDARY_COMPACT}
                  >
                    พบแล้ว
                  </button>
                  <button
                    type="button"
                    onClick={() => void onUpdateAppointmentStatus(item.id, "NO_SHOW")}
                    className={UI_ACTION_SECONDARY_COMPACT}
                  >
                    ไม่มาตามนัด
                  </button>
                  <button
                    type="button"
                    onClick={() => void onUpdateAppointmentStatus(item.id, "CANCELLED")}
                    className={UI_ACTION_SECONDARY_COMPACT}
                  >
                    ยกเลิกนัด
                  </button>
                </div>
              </div>
            ))}
            {upcomingAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                ยังไม่มีนัดที่รอพบ
              </div>
            ) : null}
          </div>
          {appointmentPagination.total > appointmentPagination.rowsPerPage ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <ListPaginationFooter
                total={appointmentPagination.total}
                rangeStart={appointmentPagination.rangeStart}
                rangeEnd={appointmentPagination.rangeEnd}
                currentPage={appointmentPagination.currentPage}
                canGoPrev={appointmentPagination.canGoPrev}
                canGoNext={appointmentPagination.canGoNext}
                onPrev={() => appointmentPagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNext={() => appointmentPagination.setCurrentPage((prev) => prev + 1)}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">เคสที่ยังไม่มีนัดหมาย</h3>
          </div>
          <div className="space-y-3">
            {waitingPagination.pageItems.map((item) => {
              const risk = getRiskClasses(item.riskLevel);
              return (
                <div key={item.referralId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.maskedStudentId} • {item.year}
                      </p>
                    </div>
                    <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${risk.badge}`}>{risk.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAppointmentModal(item)}
                    className="mt-4 flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    สร้างนัดหมาย
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {casesWithoutAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                ทุกเคสที่รับแล้วมีนัดหมายที่ยังเปิดอยู่ครบแล้ว
              </div>
            ) : null}
          </div>
          {waitingPagination.total > waitingPagination.rowsPerPage ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <ListPaginationFooter
                total={waitingPagination.total}
                rangeStart={waitingPagination.rangeStart}
                rangeEnd={waitingPagination.rangeEnd}
                currentPage={waitingPagination.currentPage}
                canGoPrev={waitingPagination.canGoPrev}
                canGoNext={waitingPagination.canGoNext}
                onPrev={() => waitingPagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNext={() => waitingPagination.setCurrentPage((prev) => prev + 1)}
              />
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" />
            <h3 className="font-bold text-slate-800">ประวัตินัด</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {historyAppointments.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showHistory ? "ซ่อน" : "ดูประวัติ"}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">พบแล้ว · ไม่มาตามนัด · ยกเลิก — แยกไว้ไม่ให้ปนกับนัดที่รอพบ</p>

        {showHistory ? (
          <div className="mt-4 space-y-3">
            {historyPagination.pageItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{item.studentName}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatThaiDate(item.date)} • {formatTime(item.time)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location || "ยังไม่ระบุสถานที่"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold ${statusBadgeClass[item.status]}`}>
                    {item.status === "COMPLETED" ? <CheckCircle2 className="h-3 w-3" /> : null}
                    {statusLabel[item.status]}
                  </span>
                </div>
                {item.note ? <p className="mt-3 text-sm text-slate-600">{item.note}</p> : null}
              </div>
            ))}
            {historyAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                ยังไม่มีประวัตินัด
              </div>
            ) : null}
            {historyPagination.total > historyPagination.rowsPerPage ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <ListPaginationFooter
                  total={historyPagination.total}
                  rangeStart={historyPagination.rangeStart}
                  rangeEnd={historyPagination.rangeEnd}
                  currentPage={historyPagination.currentPage}
                  canGoPrev={historyPagination.canGoPrev}
                  canGoNext={historyPagination.canGoNext}
                  onPrev={() => historyPagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
                  onNext={() => historyPagination.setCurrentPage((prev) => prev + 1)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
