"use client";

import { SendHorizontal } from "lucide-react";

type ChatComposerProps = {
  value: string;
  disabled?: boolean;
  accent?: "male" | "female";
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatComposer({
  value,
  disabled,
  accent = "male",
  onChange,
  onSubmit,
}: ChatComposerProps) {
  const canSend = !disabled && value.trim().length > 0;
  const sendTone =
    accent === "male"
      ? "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-200"
      : "bg-rose-500 hover:bg-rose-600 focus-visible:ring-rose-200";

  return (
    <form
      className="border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-end gap-2 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-2 py-2 shadow-inner transition-colors focus-within:border-slate-300 focus-within:bg-white">
        <label className="sr-only" htmlFor="student-chat-input">
          พิมพ์ข้อความ
        </label>
        <textarea
          id="student-chat-input"
          value={value}
          disabled={disabled}
          maxLength={2000}
          rows={1}
          placeholder="พิมพ์สิ่งที่อยากเล่า..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:text-slate-400"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="ส่งข้อความ"
          className={`mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:bg-slate-300 ${
            canSend ? sendTone : ""
          }`}
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
