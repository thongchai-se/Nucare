"use client";

import { SendHorizontal } from "lucide-react";

type MessageComposerProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

/** ช่องพิมพ์ข้อความแชทชั่วคราว — Enter ส่ง, Shift+Enter ขึ้นบรรทัด */
export function MessageComposer({ value, disabled, onChange, onSubmit }: MessageComposerProps) {
  const canSend = !disabled && value.trim().length > 0;

  return (
    <form
      className="shrink-0 border-t border-slate-100 bg-white/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-4 sm:pb-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1 transition-colors focus-within:border-[#0057A8]/35 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0057A8]/10">
        <label className="sr-only" htmlFor="ephemeral-chat-input">
          พิมพ์ข้อความ
        </label>
        <textarea
          id="ephemeral-chat-input"
          value={value}
          disabled={disabled}
          maxLength={2000}
          rows={1}
          placeholder="พิมพ์ข้อความ..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:text-slate-400"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="ส่งข้อความ"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/35 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-300 ${
            canSend ? "bg-[#0057A8] hover:bg-[#00468a]" : ""
          }`}
        >
          <SendHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
