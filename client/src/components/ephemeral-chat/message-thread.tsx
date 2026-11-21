"use client";

import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { EphemeralChatMessage } from "./types";

type MessageThreadProps = {
  messages: EphemeralChatMessage[];
  currentUserId: string;
  emptyHint?: string;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/** แสดงรายการข้อความแบบ Messenger — ข้อความของฉันชิดขวา */
export function MessageThread({
  messages,
  currentUserId,
  emptyHint = "พิมพ์ข้อความเพื่อเริ่มคุย",
}: MessageThreadProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    list.scrollTop = list.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.id]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0057A8]/10 text-[#0057A8]">
          <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <p className="text-sm font-medium text-slate-600">{emptyHint}</p>
      </div>
    );
  }

  // กัน React key ซ้ำถ้า state มี id ซ้ำชั่วคราวจาก race
  const rendered: EphemeralChatMessage[] = [];
  const seenIds = new Set<string>();
  for (const message of messages) {
    if (seenIds.has(message.id)) {
      continue;
    }
    seenIds.add(message.id);
    rendered.push(message);
  }

  return (
    <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-4">
      {rendered.map((message) => {
        const mine = message.senderId === currentUserId;
        return (
          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[70%] ${
                mine
                  ? "rounded-br-md bg-[#0057A8] text-white shadow-[0_8px_18px_-10px_rgba(0,87,168,0.65)]"
                  : "rounded-bl-md border border-slate-200/80 bg-white text-slate-800 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.35)]"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p
                className={`mt-1 text-[10px] font-medium ${
                  mine ? "text-white/70" : "text-slate-400"
                }`}
              >
                {formatTime(message.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
