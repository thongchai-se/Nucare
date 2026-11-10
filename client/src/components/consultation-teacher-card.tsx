"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StudentCareTeamMember } from "@/lib/student-dashboard";

type ConsultationTeacher = Pick<
  StudentCareTeamMember,
  "id" | "name" | "image" | "initials" | "roleLabels" | "isAssignedAdvisor"
>;

/** Fixed card widths — never use % of the scroller (padding feedback collapses cards). */
const CARD_WIDTH_CLASS =
  "w-[min(18rem,calc(100vw-6.5rem))] min-w-[min(18rem,calc(100vw-6.5rem))] sm:w-64 sm:min-w-64 lg:w-56 lg:min-w-56";

export function ConsultationTeacherPortrait({
  name,
  image,
  initials,
  initialsClassName = "text-2xl",
}: {
  name: string;
  image?: string | null;
  initials: string;
  initialsClassName?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="h-full w-full object-cover" role="presentation" />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 via-slate-50 to-cyan-100 font-black text-blue-700 ${initialsClassName}`}
    >
      <span className="sr-only">{name}</span>
      {initials}
    </div>
  );
}

function scrollCardToCenter(scroller: HTMLElement, card: HTMLElement, behavior: ScrollBehavior = "smooth") {
  const target = card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2;
  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  scroller.scrollTo({ left: Math.min(maxScroll, Math.max(0, target)), behavior });
}

function getCenteredCardIndex(scroller: HTMLElement): number {
  const cards = Array.from(scroller.querySelectorAll<HTMLElement>("[data-teacher-card]"));
  if (cards.length === 0) {
    return 0;
  }

  const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - centerX);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function ConsultationTeacherCardRow({
  teachers,
  selectedId,
  onSelect,
}: {
  teachers: ConsultationTeacher[];
  selectedId: string;
  onSelect: (teacherId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const skipCenterSelectRef = useRef(false);
  const scrollSettleTimerRef = useRef<number | null>(null);
  const centerUnlockTimerRef = useRef<number | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const syncSidePadding = () => {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelector<HTMLElement>("[data-teacher-card]");
    if (!scroller || !card) {
      return;
    }

    // Use measured fixed card width only — never shrink cards based on this padding.
    const cardWidth = card.getBoundingClientRect().width;
    if (cardWidth < 120) {
      return;
    }

    const pad = Math.max(0, Math.round((scroller.clientWidth - cardWidth) / 2));
    scroller.style.setProperty("--carousel-pad", `${pad}px`);
  };

  const updateScrollState = () => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    setCanScrollPrev(scroller.scrollLeft > 4);
    setCanScrollNext(maxScroll > 4 && scroller.scrollLeft < maxScroll - 4);
    setActiveIndex(getCenteredCardIndex(scroller));
  };

  const selectCenteredTeacher = () => {
    const scroller = scrollerRef.current;
    if (!scroller || skipCenterSelectRef.current) {
      return;
    }

    const index = getCenteredCardIndex(scroller);
    const teacher = teachers[index];
    if (teacher && teacher.id !== selectedId) {
      onSelect(teacher.id);
    }
  };

  const centerTeacher = (teacherId: string, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    if (!scroller || !teacherId) {
      return;
    }

    const card = scroller.querySelector<HTMLElement>(`[data-teacher-id="${teacherId}"]`);
    if (!card) {
      return;
    }

    skipCenterSelectRef.current = true;
    scrollCardToCenter(scroller, card, behavior);

    if (centerUnlockTimerRef.current !== null) {
      window.clearTimeout(centerUnlockTimerRef.current);
    }

    centerUnlockTimerRef.current = window.setTimeout(
      () => {
        skipCenterSelectRef.current = false;
        updateScrollState();
        centerUnlockTimerRef.current = null;
      },
      behavior === "smooth" ? 340 : 0
    );
  };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    syncSidePadding();

    // Parent owns selection. Do not call onSelect here — that caused open-popup
    // flicker (layout effect → parent setState → remount → loading flash).
    const preferredId =
      (selectedId && teachers.some((teacher) => teacher.id === selectedId) ? selectedId : null) ||
      teachers[0]?.id;

    if (preferredId) {
      const card = scroller.querySelector<HTMLElement>(`[data-teacher-id="${preferredId}"]`);
      if (card) {
        skipCenterSelectRef.current = true;
        scrollCardToCenter(scroller, card, "auto");
        window.setTimeout(() => {
          skipCenterSelectRef.current = false;
        }, 0);
      }
    }

    updateScrollState();

    const resizeObserver = new ResizeObserver(() => {
      syncSidePadding();
      const currentId =
        (selectedId && teachers.some((teacher) => teacher.id === selectedId) ? selectedId : null) ||
        teachers[getCenteredCardIndex(scroller)]?.id;
      if (currentId) {
        const card = scroller.querySelector<HTMLElement>(`[data-teacher-id="${currentId}"]`);
        if (card) {
          skipCenterSelectRef.current = true;
          scrollCardToCenter(scroller, card, "auto");
          window.setTimeout(() => {
            skipCenterSelectRef.current = false;
          }, 0);
        }
      }
      updateScrollState();
    });
    resizeObserver.observe(scroller);

    return () => {
      resizeObserver.disconnect();
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
      if (centerUnlockTimerRef.current !== null) {
        window.clearTimeout(centerUnlockTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync layout when teacher list / selection changes
  }, [teachers, selectedId]);

  const handleScroll = () => {
    updateScrollState();

    if (scrollSettleTimerRef.current !== null) {
      window.clearTimeout(scrollSettleTimerRef.current);
    }

    scrollSettleTimerRef.current = window.setTimeout(() => {
      selectCenteredTeacher();
      scrollSettleTimerRef.current = null;
    }, 120);
  };

  const moveBy = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(teachers.length - 1, getCenteredCardIndex(scroller) + direction));
    const teacher = teachers[nextIndex];
    if (!teacher) {
      return;
    }

    onSelect(teacher.id);
    centerTeacher(teacher.id, "smooth");
  };

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => moveBy(-1)}
        disabled={!canScrollPrev}
        aria-label="เลื่อนไปการ์ดก่อนหน้า"
        className="absolute left-1 top-[42%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-colors hover:border-blue-200 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-0 sm:left-0"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [padding-inline:var(--carousel-pad,1.5rem)] [&::-webkit-scrollbar]:hidden"
      >
        {teachers.map((teacher, index) => {
          const selected = teacher.id === selectedId;
          const focused = index === activeIndex;

          return (
            <button
              key={teacher.id}
              type="button"
              data-teacher-card
              data-teacher-id={teacher.id}
              onClick={() => {
                onSelect(teacher.id);
                centerTeacher(teacher.id, "smooth");
              }}
              aria-pressed={selected}
              className={`${CARD_WIDTH_CLASS} box-border shrink-0 snap-center overflow-hidden rounded-2xl border bg-white text-left transition-all ${
                selected || focused
                  ? "border-blue-400 shadow-md ring-2 ring-blue-100"
                  : "border-slate-200 opacity-75 hover:border-blue-200 hover:opacity-100"
              }`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <ConsultationTeacherPortrait
                  name={teacher.name}
                  image={teacher.image}
                  initials={teacher.initials}
                  initialsClassName="text-4xl sm:text-3xl"
                />
                {teacher.isAssignedAdvisor ? (
                  <span className="absolute left-2 top-2 max-w-[calc(100%-4.75rem)] truncate rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-cyan-700 shadow-sm">
                    ที่ปรึกษาของฉัน
                  </span>
                ) : null}
                {selected ? (
                  <span className="absolute right-2 top-2 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">
                    เลือกแล้ว
                  </span>
                ) : null}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900">{teacher.name}</p>
                <p className="line-clamp-2 text-xs font-medium text-slate-500">
                  {teacher.roleLabels.join(" / ") || "อาจารย์"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => moveBy(1)}
        disabled={!canScrollNext}
        aria-label="เลื่อนไปการ์ดถัดไป"
        className="absolute right-1 top-[42%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-colors hover:border-blue-200 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-0 sm:right-0"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
        ปัดซ้ายขวาเพื่อดูอาจารย์เพิ่ม
        {teachers.length > 1 ? ` · ${activeIndex + 1}/${teachers.length}` : ""}
      </p>
    </div>
  );
}
