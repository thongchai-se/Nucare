"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePublicSiteMedia } from "@/hooks/use-public-site-media";
import {
  studentDevelopmentBoard,
  type StudentDevBoardItem,
} from "@/lib/student-development-board";
import { resolveMediaHref } from "@/lib/media-href";

function slidesFromBoard(): StudentDevBoardItem[] {
  const board = studentDevelopmentBoard;
  return [board.featured, ...board.items];
}

function StudentDevCarouselSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="กำลังโหลดประชาสัมพันธ์"
      className="overflow-hidden"
    >
      <div className="relative min-h-[18rem] overflow-hidden rounded-[1.35rem] bg-slate-200 sm:min-h-[16rem] sm:aspect-[16/9] lg:min-h-0 lg:aspect-[21/9]">
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_70%_20%,rgba(56,189,248,0.18),transparent_48%),linear-gradient(145deg,#0b1f3a_0%,#163a5f_48%,#0c4a6e_100%)]" />
      </div>
    </section>
  );
}

/** คารูเซลประชาสัมพันธ์ — แสดงเฉพาะภาพ กดตามลิงก์ที่กองพัฒตั้งไว้ เลื่อนอัตโนมัติเมื่อมีหลายภาพ */
export function StudentDevCarousel() {
  const { items, isLoading } = usePublicSiteMedia("STUDENT_ACTIVITY");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const slides = useMemo<StudentDevBoardItem[]>(() => {
    if (isLoading) {
      return [];
    }
    if (items.length > 0) {
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary || item.title,
        imageSrc: item.imageUrl,
        imageAlt: item.altText || item.title,
        href: item.href || undefined,
        ctaLabel: item.ctaLabel || undefined,
        tag: item.tag || undefined,
      }));
    }
    return slidesFromBoard();
  }, [isLoading, items]);

  useEffect(() => {
    setIndex(0);
  }, [slides]);

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

  if (isLoading) {
    return <StudentDevCarouselSkeleton />;
  }

  const slide = slides[index] ?? slides[0];
  if (!slide) {
    return null;
  }

  const link = resolveMediaHref(slide.href);

  const body = (
    <div className="relative min-h-[18rem] overflow-hidden rounded-[1.35rem] sm:min-h-[16rem] sm:aspect-[16/9] lg:min-h-0 lg:aspect-[21/9]">
      {slide.imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจาก /api/uploads ที่แอดมินจัดการ
        <img
          src={slide.imageSrc}
          alt={slide.imageAlt}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(56,189,248,0.28),transparent_48%),linear-gradient(145deg,#0b1f3a_0%,#163a5f_48%,#0c4a6e_100%)]"
          aria-hidden="true"
        />
      )}

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2.5 z-10 flex items-center justify-center gap-2 px-4">
          {slides.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={`ไปสไลด์ ${slideIndex + 1}`}
              aria-current={slideIndex === index ? "true" : undefined}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIndex(slideIndex);
              }}
              className={`h-2 rounded-full transition-all ${
                slideIndex === index ? "w-6 bg-white shadow-sm" : "w-2 bg-white/55 hover:bg-white/80"
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
      {link ? (
        link.external ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label={slide.imageAlt || slide.title || "เปิดลิงก์ประชาสัมพันธ์"}
          >
            {body}
          </a>
        ) : (
          <Link
            href={link.href}
            className="block outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label={slide.imageAlt || slide.title || "เปิดลิงก์ประชาสัมพันธ์"}
          >
            {body}
          </Link>
        )
      ) : (
        body
      )}
    </section>
  );
}
