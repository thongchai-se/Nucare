"use client";

import { useState } from "react";
import { Phone, PhoneCall, Siren } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { runStudentSosRequest } from "@/lib/student-sos";

type StudentEmergencyHelpCardProps = {
  description?: string;
  id?: string;
  onConfirmSos: () => Promise<void> | void;
};

/** การ์ดช่วยเหลือด่วน — คง dialog ไว้ถ้าส่ง SOS ไม่สำเร็จ และชี้ไปสายด่วน 1323 */
export function StudentEmergencyHelpCard({
  description = "หากรู้สึกไม่ปลอดภัยหรือต้องการความช่วยเหลือทันที ให้ติดต่อทีมดูแลหรือสายด่วน",
  id,
  onConfirmSos,
}: StudentEmergencyHelpCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleConfirmSos = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const result = await runStudentSosRequest(async () => {
      await onConfirmSos();
    });

    setSubmitting(false);

    if (result.ok) {
      setConfirmOpen(false);
      return;
    }

    setSubmitError(result.message);
  };

  return (
    <>
      <div
        id={id}
        className="scroll-mt-28 rounded-lg border border-red-800 bg-red-700 p-5 text-white shadow-sm sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3 border-b border-red-500/60 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Siren className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">ต้องการความช่วยเหลือด่วน</h3>
            <p className="mt-1 text-base leading-7 text-red-100">{description}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSubmitError("");
              setConfirmOpen(true);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-base font-bold text-red-700 transition-colors hover:bg-red-50"
          >
            <PhoneCall className="h-4 w-4" />
            แจ้งเหตุทีมดูแลพิเศษ
          </button>
          <a
            href="tel:1323"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-500 bg-red-800 px-4 py-2.5 text-center text-base font-bold text-white transition-colors hover:bg-red-900"
          >
            <Phone className="h-4 w-4" />
            สายด่วนสุขภาพจิต 1323
          </a>
        </div>
      </div>

      <ConfirmDialog
        cancelLabel="ยังไม่แจ้ง"
        confirmLabel="ยืนยันแจ้งเหตุ"
        description={
          submitError
            ? `${submitError} — หากฉุกเฉินโทร 1323 ได้ทันที`
            : "ระบบจะบันทึกคำขอช่วยเหลือไว้ กดยืนยันเฉพาะเมื่อต้องการแจ้งเหตุจริง — หากฉุกเฉินโทร 1323 ได้ทันที"
        }
        loading={submitting}
        onCancel={() => {
          if (!submitting) {
            setConfirmOpen(false);
            setSubmitError("");
          }
        }}
        onConfirm={() => {
          void handleConfirmSos();
        }}
        open={confirmOpen}
        title={submitError ? "ส่งไม่สำเร็จ — ลองใหม่หรือโทร 1323" : "ยืนยันการแจ้งเหตุทีมดูแลพิเศษ"}
      />
    </>
  );
}
