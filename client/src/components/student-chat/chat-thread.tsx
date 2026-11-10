"use client";

import { useEffect, useRef } from "react";
import type { StudentChatMessage, StudentChatPersona, StudentChatPersonaId } from "./types";

const PERSONA_AVATAR_SRC: Record<StudentChatPersonaId, string> = {
  "peer-male": "/student-chat/persona-peer-male.png",
  "peer-female": "/student-chat/persona-peer-female.png",
};

type ChatThreadProps = {
  persona: StudentChatPersona;
  messages: StudentChatMessage[];
  sending?: boolean;
};

export function ChatThread({ persona, messages, sending = false }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isMale = persona.gender === "male";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  return (
    <div
      className={`relative flex min-h-[22rem] flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5 ${
        isMale
          ? "bg-[linear-gradient(180deg,#f0f9ff_0%,#f8fafc_42%,#ffffff_100%)]"
          : "bg-[linear-gradient(180deg,#fff1f2_0%,#fafafa_42%,#ffffff_100%)]"
      }`}
    >
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isLatest = index === messages.length - 1;

        return (
          <div
            key={message.id}
            className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"} ${
              isLatest ? "animate-[chat-rise_280ms_cubic-bezier(0.16,1,0.3,1)_both]" : ""
            }`}
          >
            {!isUser ? (
              <div className="relative mb-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={PERSONA_AVATAR_SRC[persona.id]}
                  alt=""
                  className="h-full w-full object-cover object-[center_18%]"
                />
              </div>
            ) : null}

            <div
              className={`max-w-[min(85%,28rem)] rounded-[1.25rem] px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                isUser
                  ? "rounded-br-md bg-slate-900 text-white"
                  : isMale
                    ? "rounded-bl-md border border-sky-100/80 bg-white text-slate-800"
                    : "rounded-bl-md border border-rose-100/80 bg-white text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        );
      })}

      {sending ? (
        <div className="flex items-end gap-2 justify-start animate-[chat-rise_280ms_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="relative mb-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PERSONA_AVATAR_SRC[persona.id]}
              alt=""
              className="h-full w-full object-cover object-[center_18%]"
            />
          </div>
          <div
            className={`rounded-[1.25rem] rounded-bl-md border bg-white px-4 py-3 shadow-sm ${
              isMale ? "border-sky-100/80" : "border-rose-100/80"
            }`}
            aria-label="กำลังพิมพ์"
          >
            <span className="flex gap-1.5">
              <span className="h-1.5 w-1.5 animate-[chat-dot_1s_ease-out_infinite] rounded-full bg-slate-400" />
              <span className="h-1.5 w-1.5 animate-[chat-dot_1s_ease-out_infinite] rounded-full bg-slate-400 [animation-delay:160ms]" />
              <span className="h-1.5 w-1.5 animate-[chat-dot_1s_ease-out_infinite] rounded-full bg-slate-400 [animation-delay:320ms]" />
            </span>
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
