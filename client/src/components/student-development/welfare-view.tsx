"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { UI_ACTION_PRIMARY_COMPACT, UI_ACTION_SECONDARY_COMPACT } from "@/lib/ui-classes";
import type { WelfareReferralStatus, WelfareTask } from "./types";

type WelfareViewProps = {
  welfareTasks: WelfareTask[];
  currentUserId?: string | null;
  onUpdateStatus?: (
    referralId: string,
    status: WelfareReferralStatus,
    extras?: { staffNote?: string; closedReason?: string }
  ) => void | Promise<void>;
};

type PendingAction =
  | { mode: "accept"; taskId: string }
  | { mode: "close"; taskId: string };

/** ติดตาม CaseReferral ที่ส่งมายังงานพัฒนานิสิต */
export function WelfareView({ welfareTasks, currentUserId, onUpdateStatus }: WelfareViewProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [closedReason, setClosedReason] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pendingAction || pendingAction.mode !== "close") {
      return;
    }
    setClosedReason("");
    setStaffNote("");
    setFormError(null);
  }, [pendingAction]);

  useBodyScrollLock(pendingAction?.mode === "close");

  const closePending = () => {
    setPendingAction(null);
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-950">ประสานงานสวัสดิการ</h1>
        <p className="mt-1 text-sm text-slate-500">
          รับ–ปิดเคสที่ส่งต่อมายังงานพัฒนานิสิต ตามลำดับสถานะ PENDING → ACCEPTED → CLOSED
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">งานที่เปิดอยู่</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {welfareTasks.filter((task) => task.referralStatus !== "CLOSED").length}
          </p>
          <p className="mt-1 text-sm text-slate-500">รายการที่ยังอยู่ในสายการติดตาม</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">กำลังประสานงาน</p>
          <p className="mt-3 text-3xl font-bold text-blue-600">
            {welfareTasks.filter((task) => task.status === "กำลังประสานงาน").length}
          </p>
          <p className="mt-1 text-sm text-slate-500">เคสที่รับงานแล้ว</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">รอรับงาน</p>
          <p className="mt-3 text-3xl font-bold text-amber-600">
            {welfareTasks.filter((task) => task.status === "รอรับงาน").length}
          </p>
          <p className="mt-1 text-sm text-slate-500">รายการที่ยังรอรับ referral</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">รายการส่งต่อมายังพัฒนานิสิต</h2>
        </div>
        <div className="space-y-4 p-4">
          {welfareTasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              ยังไม่มีเคสส่งต่อมายังงานพัฒนานิสิต
            </p>
          ) : (
            welfareTasks.map((task) => {
              const ownedByOther =
                task.referralStatus === "ACCEPTED" &&
                Boolean(task.acceptedByUserId) &&
                Boolean(currentUserId) &&
                task.acceptedByUserId !== currentUserId;

              return (
                <div key={task.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {task.isUrgent ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                            ด่วน
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            task.status === "ปิดงานแล้ว"
                              ? "bg-slate-100 text-slate-600"
                              : task.status === "กำลังประสานงาน"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {task.status}
                        </span>
                        {task.acceptedByName ? (
                          <span className="text-[11px] font-medium text-slate-500">
                            ผู้รับ: {task.acceptedByName}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-900">{task.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{task.note}</p>
                      {task.staffNote ? (
                        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          บันทึกงาน: {task.staffNote}
                        </p>
                      ) : null}
                      {task.closedReason ? (
                        <p className="mt-2 text-xs text-slate-500">เหตุผลปิด: {task.closedReason}</p>
                      ) : null}
                      {onUpdateStatus && task.referralStatus !== "CLOSED" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {task.referralStatus === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ mode: "accept", taskId: task.id })}
                              className={UI_ACTION_PRIMARY_COMPACT}
                            >
                              <ConfirmSubmitLabel>รับงาน</ConfirmSubmitLabel>
                            </button>
                          ) : null}
                          {!ownedByOther ? (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ mode: "close", taskId: task.id })}
                              className={UI_ACTION_SECONDARY_COMPACT}
                            >
                              ปิดงาน
                            </button>
                          ) : (
                            <p className="text-xs text-slate-500">ปิดงานได้เฉพาะผู้รับเคส</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p className="text-xs font-semibold text-slate-500">อาจารย์ที่ส่งต่อ</p>
                      <p className="mt-1 font-bold text-slate-800">{task.owner}</p>
                      <p className="mt-1">{task.updatedAt}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">เอกสารที่ควรเตรียมไว้ล่วงหน้า</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            "แบบฟอร์มยืนยันการช่วยเหลือเบื้องต้น",
            "รายการเอกสารประกอบการขอรับทุน",
            "สรุปสถานะเคสประจำสัปดาห์สำหรับประชุมติดตาม",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FileText className="h-4 w-4 text-slate-500" />
                {item}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PromptDialog
        open={pendingAction?.mode === "accept"}
        optional
        title="รับงานเคส"
        description="บันทึกสั้น ๆ ตอนรับงานได้ถ้าต้องการ แล้วกดยืนยันเพื่อรับเคสเข้าดูแล"
        placeholder="เช่น ติดต่อนิสิตภายในวันนี้..."
        confirmLabel="รับงาน"
        cancelLabel="ยกเลิก"
        onCancel={closePending}
        onConfirm={(value) => {
          if (!pendingAction || pendingAction.mode !== "accept" || !onUpdateStatus) {
            return;
          }
          const taskId = pendingAction.taskId;
          closePending();
          void onUpdateStatus(taskId, "ACCEPTED", {
            staffNote: value || undefined,
          });
        }}
      />

      {mounted && pendingAction?.mode === "close"
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[10000] bg-slate-950/45" onClick={closePending} />
              <div className="fixed inset-0 z-[10001] flex items-center justify-center overflow-hidden p-3 sm:p-4">
                <div
                  role="dialog"
                  aria-modal="true"
                  className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)]"
                >
                  <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">ปิดงานเคส</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          ระบุเหตุผลที่ปิดงาน (จำเป็น) และบันทึกสรุปเพิ่มเติมได้ถ้าต้องการ
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closePending}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="ปิด"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">เหตุผลที่ปิดงาน</label>
                        <textarea
                          rows={3}
                          value={closedReason}
                          onChange={(event) => {
                            setClosedReason(event.target.value);
                            if (formError) {
                              setFormError(null);
                            }
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="เช่น ช่วยเหลือเรียบร้อย / ส่งต่อหน่วยงานอื่นแล้ว"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">บันทึกสรุปเพิ่มเติม (ไม่บังคับ)</label>
                        <textarea
                          rows={2}
                          value={staffNote}
                          onChange={(event) => setStaffNote(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="รายละเอียดสั้น ๆ"
                        />
                      </div>
                      {formError ? <InlineAlert className="py-2 text-xs">{formError}</InlineAlert> : null}
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:justify-end sm:px-6">
                    <button
                      type="button"
                      onClick={closePending}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = closedReason.trim();
                        if (!reason) {
                          setFormError("กรุณาระบุเหตุผลที่ปิดงาน");
                          return;
                        }
                        if (!pendingAction || !onUpdateStatus) {
                          return;
                        }
                        const taskId = pendingAction.taskId;
                        closePending();
                        void onUpdateStatus(taskId, "CLOSED", {
                          closedReason: reason,
                          staffNote: staffNote.trim() || undefined,
                        });
                      }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700"
                    >
                      ปิดงาน
                    </button>
                  </div>
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
