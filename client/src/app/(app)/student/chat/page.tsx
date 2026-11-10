"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Phone, PhoneCall } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChatComposer } from "@/components/student-chat/chat-composer";
import { ChatThread } from "@/components/student-chat/chat-thread";
import { PersonaPicker } from "@/components/student-chat/persona-picker";
import {
  STUDENT_CHAT_PERSONA_STORAGE_KEY,
  type StudentChatMessage,
  type StudentChatPersona,
  type StudentChatPersonaId,
} from "@/components/student-chat/types";
import { StudentPageShell } from "@/components/student-page-shell";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/student-dashboard";
import { runStudentSosRequest } from "@/lib/student-sos";

const FALLBACK_PERSONAS: StudentChatPersona[] = [
  {
    id: "peer-male",
    gender: "male",
    displayName: "พี่ต้น",
    shortBio: "",
    greeting: "หวัดดีครับ วันนี้เป็นไงบ้าง",
  },
  {
    id: "peer-female",
    gender: "female",
    displayName: "พี่เมย์",
    shortBio: "",
    greeting: "หวัดดีค่ะ พร้อมฟังอยู่นะ",
  },
];

const PERSONA_AVATAR_SRC: Record<StudentChatPersonaId, string> = {
  "peer-male": "/student-chat/persona-peer-male.png",
  "peer-female": "/student-chat/persona-peer-female.png",
};

function isPersonaId(value: string | null): value is StudentChatPersonaId {
  return value === "peer-male" || value === "peer-female";
}

function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function StudentChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suppressAutoStartRef = useRef(false);
  const previousPersonaQueryRef = useRef<string | null>(null);
  const [personas, setPersonas] = useState<StudentChatPersona[]>(FALLBACK_PERSONAS);
  const [selectedPersonaId, setSelectedPersonaId] = useState<StudentChatPersonaId | null>(null);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<StudentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmChangePeer, setConfirmChangePeer] = useState(false);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosError, setSosError] = useState("");
  const [sosSent, setSosSent] = useState(false);

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const response = await api.get<{ personas: StudentChatPersona[] }>("/api/student/chat/personas");
        if (response.data.personas?.length) {
          setPersonas(response.data.personas);
        }
      } catch {
        setPersonas(FALLBACK_PERSONAS);
      }
    };

    void loadPersonas();
  }, []);

  const activePersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId]
  );

  const beginChat = useCallback(
    (personaId: StudentChatPersonaId) => {
      const persona = personas.find((item) => item.id === personaId) ?? null;
      if (!persona) {
        return;
      }

      suppressAutoStartRef.current = false;
      setSelectedPersonaId(personaId);

      try {
        window.localStorage.setItem(STUDENT_CHAT_PERSONA_STORAGE_KEY, persona.id);
      } catch {
        // ignore
      }

      setStarted(true);
      setMessages([
        {
          id: createMessageId(),
          role: "assistant",
          content: persona.greeting,
        },
      ]);
      setError("");
      router.replace(`/student/chat?persona=${personaId}`, { scroll: false });
    },
    [personas, router]
  );

  // Deep-link / หน้าแรกส่ง ?persona=... — ห้ามรันซ้ำตอนกดเปลี่ยนเพื่อน
  // เพราะ router.replace เคลียร์ query แบบ async แล้ว effect อาจเห็นค่าเก่าแล้ว start กลับ
  useEffect(() => {
    const requested = searchParams.get("persona");
    const previous = previousPersonaQueryRef.current;
    previousPersonaQueryRef.current = requested;

    if (!isPersonaId(requested)) {
      suppressAutoStartRef.current = false;
      // กดเมนูกลับ /student/chat หลังมี ?persona= แล้ว — กลับหน้าเลือกเพื่อน
      // (ไม่รีเซ็ตตอน beginChat ตั้ง started ก่อนที่ URL จะอัปเดต)
      if (started && isPersonaId(previous)) {
        setStarted(false);
        setSelectedPersonaId(null);
        setMessages([]);
        setDraft("");
        setError("");
        setConfirmChangePeer(false);
      }
      return;
    }

    if (suppressAutoStartRef.current || started) {
      return;
    }

    if (!personas.some((persona) => persona.id === requested)) {
      return;
    }

    beginChat(requested);
  }, [beginChat, personas, searchParams, started]);

  const resetPersona = () => {
    suppressAutoStartRef.current = true;
    setConfirmChangePeer(false);
    setStarted(false);
    setSelectedPersonaId(null);
    setMessages([]);
    setDraft("");
    setError("");
    router.replace("/student/chat", { scroll: false });
  };

  const requestChangePeer = () => {
    setConfirmChangePeer(true);
  };

  const sendMessage = async () => {
    if (!activePersona || sending) {
      return;
    }

    const content = draft.trim();
    if (!content) {
      return;
    }

    const userMessage: StudentChatMessage = {
      id: createMessageId(),
      role: "user",
      content,
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setDraft("");
    setSending(true);
    setError("");

    try {
      const response = await api.post<{
        reply: {
          role: "assistant";
          content: string;
          blockedReason: "homework" | null;
          crisisSuggested: boolean;
        };
      }>("/api/student/chat", {
        personaId: activePersona.id,
        content,
        history: nextHistory.slice(-12).map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: response.data.reply.content,
          blockedReason: response.data.reply.blockedReason,
          crisisSuggested: response.data.reply.crisisSuggested,
        },
      ]);
    } catch (sendError) {
      setError(getApiErrorMessage(sendError, "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่"));
      setMessages((current) => current.filter((item) => item.id !== userMessage.id));
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const showCrisisHint = messages.some((message) => message.crisisSuggested);
  const isMale = activePersona?.gender === "male";

  /** แจ้ง SOS จากห้องแชท — คง dialog ไว้ถ้าส่งไม่สำเร็จ */
  const handleChatSosConfirm = async () => {
    if (sosSubmitting) {
      return;
    }
    setSosSubmitting(true);
    setSosError("");
    const result = await runStudentSosRequest(async () => {
      await api.post("/api/student/sos", {
        summary: "นักศึกษาร้องขอความช่วยเหลือด่วนจากห้องแชทเพื่อน AI",
      });
    });
    setSosSubmitting(false);
    if (result.ok) {
      setSosConfirmOpen(false);
      setSosSent(true);
      return;
    }
    setSosError(result.message);
  };

  if (!started || !activePersona) {
    return (
      <div className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          เพื่อนในระบบเป็น AI ช่วยคุยเบื้องต้น — ไม่ใช่ที่ปรึกษาคนจริง และข้อความอาจไม่ถูกเก็บถาวรในเครื่องนี้
        </p>
        <PersonaPicker personas={personas} selectedId={selectedPersonaId} onStart={beginChat} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        คุณกำลังคุยกับ AI ในบทบาท {activePersona.displayName} — ไม่แทนที่การปรึกษาคนจริง · ข้อความในห้องนี้อาจหายเมื่อปิดหน้าหรือรีเฟรช
      </p>

      <section
        className={`flex min-h-[min(70dvh,40rem)] flex-col overflow-hidden rounded-[1.75rem] border shadow-sm ${
          isMale ? "border-sky-100 bg-white" : "border-rose-100 bg-white"
        }`}
      >
        <header
          className={`flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 ${
            isMale
              ? "border-sky-100 bg-[linear-gradient(90deg,#e0f2fe_0%,#ffffff_70%)]"
              : "border-rose-100 bg-[linear-gradient(90deg,#ffe4e6_0%,#ffffff_70%)]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white shadow-sm sm:h-16 sm:w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PERSONA_AVATAR_SRC[activePersona.id]}
                alt=""
                className="h-full w-full object-cover object-[center_18%]"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900 sm:text-xl">{activePersona.displayName}</p>
              <p className="text-xs font-medium text-slate-500">เพื่อน AI ในระบบ</p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestChangePeer}
            aria-label="เปลี่ยนเพื่อน"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>เปลี่ยนเพื่อน</span>
          </button>
        </header>

        {confirmChangePeer ? (
          <div
            className="mx-3 mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:mx-4"
            role="alertdialog"
            aria-labelledby="change-peer-title"
            aria-describedby="change-peer-desc"
          >
            <p id="change-peer-title" className="text-sm font-bold text-amber-950">
              เปลี่ยนเพื่อนคุย?
            </p>
            <p id="change-peer-desc" className="mt-1 text-sm text-amber-900/90">
              การสนทนากับ {activePersona.displayName} จะถูกล้าง และต้องเลือกเพื่อนใหม่
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetPersona}
                className="rounded-xl bg-[#0057A8] px-3 py-2 text-xs font-bold text-white hover:bg-[#00468a]"
              >
                ยืนยันเปลี่ยนเพื่อน
              </button>
              <button
                type="button"
                onClick={() => setConfirmChangePeer(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : null}

        <ChatThread persona={activePersona} messages={messages} sending={sending} />

        {showCrisisHint ? (
          <div className="mx-3 mb-2 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-medium">
                {sosSent
                  ? "ส่งคำขอช่วยเหลือแล้ว — ถ้าฉุกเฉินโทร 1323 ได้ทันที"
                  : "ถ้าหนักมาก แจ้งทีมดูแลหรือโทรสายด่วนได้จากห้องนี้เลย ไม่ต้องออกไปหน้าอื่น"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pl-7">
              {!sosSent ? (
                <button
                  type="button"
                  onClick={() => {
                    setSosError("");
                    setSosConfirmOpen(true);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  แจ้งทีมดูแลพิเศษ
                </button>
              ) : null}
              <a
                href="tel:1323"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
              >
                <Phone className="h-3.5 w-3.5" />
                โทร 1323
              </a>
              <Link
                href="/student/advisor"
                className="inline-flex min-h-9 items-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
              >
                นัดที่ปรึกษาจริง
              </Link>
            </div>
          </div>
        ) : null}

        <ChatComposer
          value={draft}
          disabled={sending}
          accent={activePersona.gender}
          onChange={setDraft}
          onSubmit={() => void sendMessage()}
        />
      </section>

      <ConfirmDialog
        cancelLabel="ยังไม่แจ้ง"
        confirmLabel="ยืนยันแจ้งเหตุ"
        description={
          sosError
            ? `${sosError} — หากฉุกเฉินโทร 1323 ได้ทันที`
            : "ระบบจะบันทึกคำขอช่วยเหลือไว้ กดยืนยันเฉพาะเมื่อต้องการแจ้งเหตุจริง — หากฉุกเฉินโทร 1323 ได้ทันที"
        }
        loading={sosSubmitting}
        onCancel={() => {
          if (!sosSubmitting) {
            setSosConfirmOpen(false);
            setSosError("");
          }
        }}
        onConfirm={() => {
          void handleChatSosConfirm();
        }}
        open={sosConfirmOpen}
        title={sosError ? "ส่งไม่สำเร็จ — ลองใหม่หรือโทร 1323" : "ยืนยันการแจ้งเหตุทีมดูแลพิเศษ"}
      />
    </div>
  );
}

export default function StudentChatPage() {
  return (
    <StudentPageShell activePage="chat" contentClassName="mx-auto max-w-4xl space-y-6">
      {() => (
        <Suspense
          fallback={
            <div className="flex min-h-[16rem] items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white text-sm text-slate-500">
              กำลังเปิดห้องแชท...
            </div>
          }
        >
          <StudentChatContent />
        </Suspense>
      )}
    </StudentPageShell>
  );
}
