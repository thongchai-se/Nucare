"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Pause, Play } from "lucide-react";
import { homeHeroSlides, type HomeHeroSlide } from "@/lib/home-media";
import { fetchPublicSiteMedia } from "@/lib/site-media-api";

function HeroSlideVisual({
  src,
  title,
  alt,
}: {
  src: string;
  title: string;
  alt: string;
}) {
  if (src.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[radial-gradient(ellipse_at_65%_30%,rgba(56,189,248,0.22),transparent_48%),linear-gradient(145deg,#0b1f3a_0%,#163a5f_50%,#0c4a6e_100%)] px-6 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white sm:h-12 sm:w-12 [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-[1.125rem] sm:[&_svg]:w-[1.125rem]">
        <ImageIcon strokeWidth={2.25} aria-hidden="true" />
      </span>
      <p className="text-sm font-bold text-white sm:text-base">{title}</p>
      <p className="text-xs text-sky-100/90 sm:text-sm">ใส่รูปประชาสัมพันธ์ที่นี่</p>
    </div>
  );
}

export function HomeHeroBanner() {
  const [slides, setSlides] = useState<HomeHeroSlide[]>(homeHeroSlides);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await fetchPublicSiteMedia("HOME_HERO");
      if (cancelled || items.length === 0) {
        return;
      }
      setSlides(
        items.map((item) => ({
          id: item.id,
          src: item.imageUrl,
          title: item.title,
          alt: item.altText || item.title,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slideCount = slides.length;
  const canLoop = slideCount > 1;

  const trackSlides = useMemo(() => {
    if (!canLoop) {
      return slides.map((slide) => ({ key: slide.id, slide }));
    }

    const first = slides[0];
    const last = slides[slideCount - 1];
    return [
      { key: `clone-last-${last.id}`, slide: last },
      ...slides.map((slide) => ({ key: slide.id, slide })),
      { key: `clone-first-${first.id}`, slide: first },
    ];
  }, [canLoop, slideCount, slides]);

  // With clones: [lastClone, ...real, firstClone] → start on first real slide
  const [position, setPosition] = useState(canLoop ? 1 : 0);
  const [withTransition, setWithTransition] = useState(true);
  const [paused, setPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const pointerStartX = useRef<number | null>(null);
  const positionRef = useRef(position);
  const isAnimatingRef = useRef(false);
  const pendingJumpRef = useRef<number | null>(null);

  positionRef.current = position;

  const realIndex = !canLoop
    ? 0
    : position === 0
      ? slideCount - 1
      : position === slideCount + 1
        ? 0
        : position - 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // After an instant jump off a clone, re-enable transition on the next frame
  useLayoutEffect(() => {
    if (withTransition || pendingJumpRef.current === null) {
      return;
    }

    pendingJumpRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      setWithTransition(true);
      isAnimatingRef.current = false;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [withTransition, position]);

  useEffect(() => {
    if (!canLoop || paused || reduceMotion || interactionPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      goNext();
    }, 7000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goNext is stable via refs
  }, [canLoop, paused, reduceMotion, interactionPaused, realIndex]);

  const jumpTo = (nextPosition: number) => {
    pendingJumpRef.current = nextPosition;
    isAnimatingRef.current = true;
    setWithTransition(false);
    setPosition(nextPosition);
  };

  const settleIfNeeded = () => {
    if (!canLoop) {
      return;
    }

    const current = positionRef.current;
    if (current === slideCount + 1) {
      jumpTo(1);
      return;
    }
    if (current === 0) {
      jumpTo(slideCount);
    }
  };

  const goNext = () => {
    if (slideCount === 0 || isAnimatingRef.current) {
      return;
    }

    if (!canLoop) {
      setPosition((current) => Math.min(current + 1, slideCount - 1));
      return;
    }

    if (reduceMotion) {
      setWithTransition(false);
      setPosition((current) => {
        const next = current + 1;
        if (next >= slideCount + 1) {
          return 1;
        }
        return next;
      });
      window.requestAnimationFrame(() => setWithTransition(true));
      return;
    }

    isAnimatingRef.current = true;
    setWithTransition(true);
    setPosition((current) => {
      if (current >= slideCount + 1) {
        return current;
      }
      return current + 1;
    });
  };

  const goPrev = () => {
    if (slideCount === 0 || isAnimatingRef.current) {
      return;
    }

    if (!canLoop) {
      setPosition((current) => Math.max(current - 1, 0));
      return;
    }

    if (reduceMotion) {
      setWithTransition(false);
      setPosition((current) => {
        const next = current - 1;
        if (next <= 0) {
          return slideCount;
        }
        return next;
      });
      window.requestAnimationFrame(() => setWithTransition(true));
      return;
    }

    isAnimatingRef.current = true;
    setWithTransition(true);
    setPosition((current) => {
      if (current <= 0) {
        return current;
      }
      return current - 1;
    });
  };

  const goToRealIndex = (slideIndex: number) => {
    if (isAnimatingRef.current || slideIndex < 0 || slideIndex >= slideCount) {
      return;
    }

    const target = canLoop ? slideIndex + 1 : slideIndex;
    if (target === positionRef.current) {
      return;
    }

    if (reduceMotion) {
      setWithTransition(false);
      setPosition(target);
      window.requestAnimationFrame(() => setWithTransition(true));
      return;
    }

    isAnimatingRef.current = true;
    setWithTransition(true);
    setPosition(target);
  };

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.propertyName !== "transform") {
      return;
    }

    const current = positionRef.current;
    if (canLoop && (current === 0 || current === slideCount + 1)) {
      settleIfNeeded();
      return;
    }

    isAnimatingRef.current = false;
  };

  const autoplayActive = canLoop && !paused && !reduceMotion;
  const currentSlide = slides[realIndex];

  if (slideCount === 0) {
    return null;
  }

  return (
    <section
      id="hero"
      className="relative z-0 w-full overflow-hidden border-b border-slate-200 bg-slate-900 pt-16 sm:pt-20"
      aria-roledescription="carousel"
      aria-label="ภาพประชาสัมพันธ์หน้าแรก"
    >
      <div
        className="relative h-[min(68vh,730px)] min-h-[470px] w-full touch-pan-y overflow-hidden sm:min-h-[550px] md:min-h-[620px] lg:h-[min(73vh,800px)]"
        onPointerDown={(event) => {
          if (event.button !== 0 || !canLoop) {
            return;
          }
          pointerStartX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerStartX.current === null) {
            return;
          }
          const delta = event.clientX - pointerStartX.current;
          pointerStartX.current = null;
          if (Math.abs(delta) < 48) {
            return;
          }
          if (delta < 0) {
            goNext();
          } else {
            goPrev();
          }
        }}
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
        onMouseEnter={() => setInteractionPaused(true)}
        onMouseLeave={() => setInteractionPaused(false)}
        onFocusCapture={() => setInteractionPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setInteractionPaused(false);
          }
        }}
      >
        <div
          className={`flex h-full w-full ease-out ${
            withTransition && !reduceMotion ? "transition-transform duration-500" : "transition-none"
          }`}
          style={{ transform: `translateX(-${position * 100}%)` }}
          onTransitionEnd={handleTransitionEnd}
        >
          {trackSlides.map((item) => (
            <div key={item.key} className="relative h-full w-full shrink-0 grow-0 basis-full">
              <HeroSlideVisual src={item.slide.src} title={item.slide.title} alt={item.slide.alt} />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/70 to-transparent" />

        {currentSlide ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-12 sm:pb-14">
            <p className="mx-auto max-w-4xl text-center text-xs font-semibold text-white drop-shadow sm:text-sm">
              {currentSlide.title}
            </p>
          </div>
        ) : null}

        {canLoop ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="ภาพก่อนหน้า"
              className="absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center bg-transparent sm:w-20 md:w-24"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/30 text-white backdrop-blur-sm sm:h-10 sm:w-10">
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="ภาพถัดไป"
              className="absolute inset-y-0 right-0 z-10 flex w-14 items-center justify-center bg-transparent sm:w-20 md:w-24"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/30 text-white backdrop-blur-sm sm:h-10 sm:w-10">
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
            </button>

            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-3.5">
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={autoplayActive ? "หยุดสไลด์ชั่วคราว" : "เล่นสไลด์ต่อ"}
                aria-pressed={!autoplayActive}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-slate-950/40 text-white backdrop-blur-sm transition-colors hover:bg-slate-950/55"
              >
                {autoplayActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>

              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToRealIndex(slideIndex)}
                  aria-label={`ไปที่ภาพ ${slideIndex + 1}`}
                  aria-current={slideIndex === realIndex ? true : undefined}
                  className={`h-2.5 min-w-2.5 rounded-full transition-all ${
                    slideIndex === realIndex ? "w-7 bg-white" : "w-2.5 bg-white/45 hover:bg-white/75"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
