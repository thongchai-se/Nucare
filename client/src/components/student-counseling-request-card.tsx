"use client";

import { FormEvent, useState } from "react";
import { HeartHandshake, Loader2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/inline-alert";
import api from "@/lib/axios";

type StudentCounselingRequestCardProps = {
  id?: string;
  disabled?: boolean;
  disabledReason?: string | null;
  onSubmitted?: () => void;
};

/** การ์ดให้นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิตโดยตรง (สร้างคิว counseling) */
export function StudentCounselingRequestCard({
  id = "expert-counseling",
  disabled = false,
  disabledReason = null,
  onSubmitted,
}: StudentCounselingRequestCardProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || submitting) {
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await api.post<{ message?: string }>("/api/student/counseling-requests", {
        note: note.trim() || undefined,
      });
      setSuccess(response.data.message || "ส่งคำขอพบผู้เชี่ยวชาญแล้ว");
      setNote("");
      onSubmitted?.();
    } catch (requestError) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
          ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
          : "ไม่สามารถส่งคำขอได้";
      setError(message || "ไม่สามารถส่งคำขอได้");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id={id} className="rounded-lg border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-slate-900">ขอพบผู้เชี่ยวชาญสุขภาพจิต</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            ส่งคำตรงถึงทีมศูนย์ให้คำปรึกษา — ไม่ผ่านการนัดกับที่ปรึกษา
          </p>
        </div>
      </div>

      {disabled ? (
        <InlineAlert tone="warning" className="mt-4 rounded-lg px-3 py-2">
          {disabledReason || "ตอนนี้ยังไม่สามารถส่งคำขอใหม่ได้"}
        </InlineAlert>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            รายละเอียดสั้นๆ (ไม่บังคับ)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="เช่น อยากคุยเรื่องความเครียด / นอนไม่หลับ"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-violet-200 placeholder:text-slate-400 focus:ring-2"
            />
          </label>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "กำลังส่ง..." : "ส่งคำขอพบผู้เชี่ยวชาญ"}
          </button>
        </form>
      )}
    </section>
  );
}
