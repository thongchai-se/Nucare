"use client";

import { useState } from "react";
import { Phone, PhoneCall, Siren } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type StudentEmergencyHelpCardProps = {
  description?: string;
  onConfirmSos: () => Promise<void> | void;
};

export function StudentEmergencyHelpCard({
  description = "หากรู้สึกไม่ปลอดภัยหรือต้องการความช่วยเหลือทันที ให้ติดต่อทีมดูแลหรือสายด่วน",
  onConfirmSos,
}: StudentEmergencyHelpCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmSos = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await onConfirmSos();
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-red-800 bg-red-700 p-5 text-white shadow-sm">
        <div className="mb-4 flex items-start gap-3 border-b border-red-500/60 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Siren className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold leading-tight">ต้องการความช่วยเหลือด่วน</h3>
            <p className="mt-1 text-sm leading-6 text-red-100">{description}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50"
          >
            <PhoneCall className="h-4 w-4" />
            แจ้งเหตุทีมดูแลพิเศษ
          </button>
          <a
            href="tel:1323"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-500 bg-red-800 px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-red-900"
          >
            <Phone className="h-4 w-4" />
            สายด่วนสุขภาพจิต 1323
          </a>
        </div>
      </div>

      <ConfirmDialog
        cancelLabel="ยังไม่แจ้ง"
        confirmLabel="ยืนยันแจ้งเหตุ"
        description="ระบบจะส่งเคส SOS ให้ทีมดูแลพิเศษรับทราบทันที กด ยืนยันแจ้งเหตุ เฉพาะเมื่อคุณต้องการให้ทีมติดต่อกลับหรือประสานความช่วยเหลือจริง"
        loading={submitting}
        onCancel={() => {
          if (!submitting) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={handleConfirmSos}
        open={confirmOpen}
        title="ยืนยันการแจ้งเหตุทีมดูแลพิเศษ"
      />
    </>
  );
}
