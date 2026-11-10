"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import api from "@/lib/axios";
import {
  formatThaiDateTime,
  getApiErrorMessage,
  type ConsultationScheduleOfferItem,
  type StudentConsultationRequest,
} from "@/lib/student-dashboard";
import { UI_ACTION_PRIMARY_COMPACT, UI_ACTION_SCHEDULE_COMPACT, UI_BUTTON_PRIMARY, UI_BUTTON_GHOST } from "@/lib/ui-classes";

type ConsultationScheduleActionsProps = {
  request: StudentConsultationRequest;
  onUpdated: (request: StudentConsultationRequest) => void;
  onError: (message: string) => void;
  onToast: (title: string, description: string) => void;
};

/** ปุ่มยอมรับ/ขอเปลี่ยนนัดของนิสิต — อาจารย์เป็นฝ่ายเสนอที่ก่อน นิสิตตอบหรือขอเปลี่ยนเวลา */
export function ConsultationScheduleActions({
  request,
  onUpdated,
  onError,
  onToast,
}: ConsultationScheduleActionsProps) {
  const [busy, setBusy] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [proposedAtLocal, setProposedAtLocal] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");

  const pendingOffer = request.latestPendingOffer ?? null;
  const waitingOnStudent = Boolean(pendingOffer && pendingOffer.waitingOn === "STUDENT");
  const waitingOnAdvisor = Boolean(pendingOffer && pendingOffer.waitingOn === "ADVISOR");
  const wasScheduled =
    request.status === "ACCEPTED" &&
    Boolean(pendingOffer) &&
    !request.scheduledAt;

  if (request.status === "PENDING" || request.status === "CLOSED") {
    return null;
  }

  const refreshRequest = async () => {
    const response = await api.get<{ requests: StudentConsultationRequest[] }>(
      "/api/student/consultation-requests"
    );
    const updated = response.data.requests.find((item) => item.id === request.id);
    if (updated) {
      onUpdated(updated);
    }
  };

  const handleAccept = async (offer: ConsultationScheduleOfferItem) => {
    setBusy(true);
    onError("");
    try {
      await api.post(
        `/api/student/consultation-requests/${request.id}/schedule-offers/${offer.id}/accept`
      );
      await refreshRequest();
      onToast("ยืนยันนัดแล้ว", "นัดหมายถูกบันทึกเมื่อทั้งสองฝ่ายยอมรับ");
    } catch (error) {
      onError(getApiErrorMessage(error, "ไม่สามารถยอมรับข้อเสนอได้"));
    } finally {
      setBusy(false);
    }
  };

  const handleCounterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proposedAtLocal || !location.trim()) {
      return;
    }
    const proposedAt = new Date(proposedAtLocal);
    if (Number.isNaN(proposedAt.getTime())) {
      onError("วันเวลานัดหมายไม่ถูกต้อง");
      return;
    }

    setBusy(true);
    onError("");
    try {
      await api.post(`/api/student/consultation-requests/${request.id}/schedule-offers`, {
        proposedAt: proposedAt.toISOString(),
        location: location.trim(),
        note: note.trim() || undefined,
      });
      await refreshRequest();
      setCounterOpen(false);
      setProposedAtLocal("");
      setNote("");
      onToast(
        request.status === "SCHEDULED" ? "ขอเปลี่ยนนัดแล้ว" : "ส่งข้อเสนอแล้ว",
        request.status === "SCHEDULED"
          ? "นัดเดิมถูกพักไว้ระหว่างเจรจา — รออาจารย์ตอบรับหรือเสนอเวลาใหม่"
          : "รออาจารย์ตอบรับหรือเสนอเวลาใหม่"
      );
    } catch (error) {
      onError(getApiErrorMessage(error, "ไม่สามารถส่งข้อเสนอได้"));
    } finally {
      setBusy(false);
    }
  };

  const openCounter = () => {
    setLocation(pendingOffer?.location || request.scheduleLocation || "");
    setCounterOpen(true);
  };

  return (
    <div className="mt-3 space-y-3">
      {wasScheduled && pendingOffer ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          กำลังเจรจาวันใหม่ — นัดเดิมถูกพักไว้จนกว่าทั้งสองฝ่ายจะตกลงกัน
        </p>
      ) : null}

      {pendingOffer ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-800">
            ข้อเสนอจาก {pendingOffer.proposedByRole === "ADVISOR" ? "อาจารย์" : "คุณ"}
          </p>
          <p className="mt-1">
            {formatThaiDateTime(pendingOffer.proposedAt)} · {pendingOffer.location}
          </p>
          {pendingOffer.note ? <p className="mt-1 line-clamp-3 text-slate-500">{pendingOffer.note}</p> : null}
          <p className="mt-1 font-medium text-[#C24712]">
            {waitingOnStudent
              ? "รอคุณยอมรับหรือขอเปลี่ยน"
              : waitingOnAdvisor
                ? "รออาจารย์ตอบกลับ"
                : "รออีกฝ่ายตอบกลับ"}
          </p>
        </div>
      ) : request.status === "SCHEDULED" && request.scheduledAt ? (
        <p className="text-xs font-semibold text-[#0057A8]">
          นัดยืนยัน: {formatThaiDateTime(request.scheduledAt)}
          {request.scheduleLocation ? ` · ${request.scheduleLocation}` : ""}
        </p>
      ) : request.status === "ACCEPTED" ? (
        <p className="text-xs font-medium text-slate-500">รออาจารย์เสนอนัด (วันเวลาและสถานที่/ช่องทาง)</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {waitingOnStudent && pendingOffer ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAccept(pendingOffer)}
            className={UI_ACTION_PRIMARY_COMPACT}
          >
            <ConfirmSubmitLabel busy={busy}>ยอมรับข้อเสนอ</ConfirmSubmitLabel>
          </button>
        ) : null}

        {waitingOnStudent || request.status === "SCHEDULED" ? (
          <button type="button" disabled={busy} onClick={openCounter} className={UI_ACTION_SCHEDULE_COMPACT}>
            ขอเปลี่ยนวัน/ที่
          </button>
        ) : null}

        {waitingOnAdvisor ? (
          <button type="button" disabled={busy} onClick={openCounter} className={UI_ACTION_SCHEDULE_COMPACT}>
            แก้ไขข้อเสนอ
          </button>
        ) : null}
      </div>

      {counterOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 p-4">
              <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {waitingOnAdvisor ? "แก้ไขข้อเสนอ" : "ขอเปลี่ยนวัน/สถานที่"}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {request.status === "SCHEDULED"
                        ? "นัดเดิมจะถูกพักไว้จนกว่าจะตกลงวันใหม่"
                        : "ส่งข้อเสนอให้อาจารย์พิจารณา"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCounterOpen(false)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    aria-label="ปิด"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleCounterSubmit} className="space-y-4 p-5">
                  <div className="space-y-1">
                    <label htmlFor={`counter-at-${request.id}`} className="text-xs font-bold text-slate-700">
                      วันเวลาที่สะดวก
                    </label>
                    <input
                      id={`counter-at-${request.id}`}
                      type="datetime-local"
                      required
                      value={proposedAtLocal}
                      onChange={(event) => setProposedAtLocal(event.target.value)}
                      disabled={busy}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`counter-loc-${request.id}`} className="text-xs font-bold text-slate-700">
                      สถานที่ / ช่องทางที่อาจารย์เสนอ
                    </label>
                    <input
                      id={`counter-loc-${request.id}`}
                      type="text"
                      required
                      maxLength={200}
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      disabled={busy}
                      placeholder="ใช้ตามที่อาจารย์เสนอ หรือปรับเล็กน้อย"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-400">โดยปกติอาจารย์เป็นผู้กำหนดห้อง/ลิงก์ — แก้ได้ถ้าจำเป็น</p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`counter-note-${request.id}`} className="text-xs font-bold text-slate-700">
                      หมายเหตุ (ถ้ามี)
                    </label>
                    <textarea
                      id={`counter-note-${request.id}`}
                      rows={3}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      disabled={busy}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setCounterOpen(false)} className={UI_BUTTON_GHOST}>
                      ยกเลิก
                    </button>
                    <button type="submit" disabled={busy} className={UI_BUTTON_PRIMARY}>
                      <ConfirmSubmitLabel busy={busy}>
                        {busy ? "กำลังส่ง..." : "ส่งข้อเสนอ"}
                      </ConfirmSubmitLabel>
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
