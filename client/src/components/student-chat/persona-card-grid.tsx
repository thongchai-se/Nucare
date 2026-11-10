"use client";

import Image from "next/image";
import Link from "next/link";
import type { StudentChatPersonaId } from "./types";

const PERSONA_CARD_SRC: Record<StudentChatPersonaId, string> = {
  "peer-male": "/student-chat/persona-peer-male.png",
  "peer-female": "/student-chat/persona-peer-female.png",
};

export type PersonaCardItem = {
  id: StudentChatPersonaId;
  label: string;
  href?: string;
};

type PersonaCardGridProps = {
  items: PersonaCardItem[];
  selectedId?: string | null;
  onSelect?: (personaId: StudentChatPersonaId) => void;
  className?: string;
  /**
   * comfortable = หน้าแชท / แถบกว้าง — การ์ดใหญ่พออ่านข้อความในภาพ
   * compact = พื้นที่แคบ — ยังเป็น 2 คอลัมน์แต่สูงขึ้นเล็กน้อย
   */
  density?: "comfortable" | "compact";
  /** card = มีขอบเงา, image = เหลือรูปกดอย่างเดียว */
  variant?: "card" | "image";
};

/** การ์ดเลือกเพื่อน — กว้างตามคอนเทนเนอร์ ไม่ลอยโดดกลางหน้า */
export function PersonaCardGrid({
  items,
  selectedId,
  onSelect,
  className = "",
  density = "comfortable",
  variant = "card",
}: PersonaCardGridProps) {
  const isComfortable = density === "comfortable";
  const isImageOnly = variant === "image";

  return (
    <div
      className={`grid w-full ${
        isComfortable
          ? "grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5"
          : "grid-cols-2 gap-2.5 sm:gap-3"
      } ${className}`}
    >
      {items.map((item, index) => {
        const selected = selectedId === item.id;
        const isMale = item.id === "peer-male";
        const cardClass = isImageOnly
          ? `group relative block overflow-hidden rounded-2xl text-left transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
              selected ? "ring-2 ring-blue-300" : "hover:-translate-y-0.5"
            }`
          : `group relative block overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
              isComfortable ? "sm:rounded-[1.35rem]" : "rounded-xl sm:rounded-2xl"
            } ${
              selected
                ? isMale
                  ? "border-sky-400 ring-2 ring-sky-100"
                  : "border-rose-400 ring-2 ring-rose-100"
                : "border-slate-200/90 hover:border-slate-300 hover:shadow-md"
            }`;

        const media = (
          <div
            className={`relative w-full overflow-hidden bg-slate-100 ${
              isComfortable
                ? "aspect-[4/5] min-h-[18rem] sm:min-h-[20rem] md:aspect-[3/4] md:min-h-[22rem] lg:min-h-[26rem]"
                : "aspect-[4/5] min-h-[12rem] sm:min-h-[14rem] lg:min-h-[16rem]"
            }`}
          >
            <Image
              src={PERSONA_CARD_SRC[item.id]}
              alt=""
              fill
              sizes={
                isComfortable
                  ? "(max-width: 640px) 92vw, (max-width: 1024px) 44vw, 440px"
                  : "(max-width: 1024px) 48vw, (max-width: 1280px) 28vw, 320px"
              }
              className="object-cover object-[center_12%]"
              priority={index === 0}
            />
          </div>
        );

        if (item.href) {
          return (
            <Link key={item.id} href={item.href} aria-label={item.label} className={cardClass}>
              {media}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            aria-pressed={selected}
            aria-label={item.label}
            className={cardClass}
          >
            {media}
          </button>
        );
      })}
    </div>
  );
}
