"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import {
  studentDevelopmentBoard,
  type StudentDevBoardItem,
} from "@/lib/student-development-board";
import { fetchPublicSiteMedia } from "@/lib/site-media-api";

function slidesFromBoard(): StudentDevBoardItem[] {
  const board = studentDevelopmentBoard;
  return [board.featured, ...board.items];
}

/** คารูเซลประชาสัมพันธ์ — เลื่อนอัตโนมัติ พร้อมหยุดด้วยมือและเคารพ reduced-motion */
export function StudentDevCarousel() {
  const [slides, setSlides] = useState<StudentDevBoardItem[]>(slidesFromBoard);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await fetchPublicSiteMedia("STUDENT_ACTIVITY");
      if (cancelled || items.length === 0) {
        return;
      }
      setSlides(
        items.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary || item.title,
          imageSrc: item.imageUrl,
          imageAlt: item.altText || item.title,
          href: item.href || undefined,
          ctaLabel: item.ctaLabel || undefined,
          tag: item.tag || undefined,
        }))
      );
      setIndex(0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused || reduceMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, slides.length]);

  const slide = slides[index] ?? slides[0];
  if (!slide) {
    return null;
  }

  const autoplayActive = !paused && !reduceMotion && slides.length > 1;

  const body = (
    <div className="relative aspect-[21/9] min-h-[12rem] overflow-hidden rounded-[1.35rem] sm:min-h-[14rem] lg:min-h-[16rem]">
      {slide.imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจาก /api/uploads ที่แอดมินจัดการ
        <img src={slide.imageSrc} alt={slide.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(56,189,248,0.28),transparent_48%),linear-gradient(145deg,#0b1f3a_0%,#163a5f_48%,#0c4a6e_100%)]"
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        {slide.tag ? (
          <span className="inline-flex rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
            {slide.tag}
          </span>
        ) : null}
        <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">{slide.title}</h2>
        <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
          {slide.summary}
        </p>
        {slide.ctaLabel ? (
          <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-slate-900 shadow-sm">
            {slide.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      {slides.length > 1 && !reduceMotion ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setPaused((current) => !current);
          }}
          className="absolute right-3 top-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/30 bg-slate-950/45 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-slate-950/60"
          aria-pressed={autoplayActive}
          aria-label={autoplayActive ? "หยุดเลื่อนอัตโนมัติ" : "เล่นเลื่อนอัตโนมัติ"}
        >
          {autoplayActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span>{autoplayActive ? "หยุด" : "เล่น"}</span>
        </button>
      ) : null}

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {slides.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={`ไปสไลด์ ${slideIndex + 1}: ${item.title}`}
              aria-current={slideIndex === index ? "true" : undefined}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIndex(slideIndex);
              }}
              className={`h-2 rounded-full transition-all ${
                slideIndex === index ? "w-6 bg-white" : "w-2 bg-white/45 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label="ประชาสัมพันธ์"
      className="overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {slide.href ? (
        <Link
          href={slide.href}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}
