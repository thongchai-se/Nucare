"use client";

import { useMemo, useState } from "react";
import { ImageIcon, PlayCircle, X } from "lucide-react";
import { usePublicSiteMedia } from "@/hooks/use-public-site-media";
import { facultyFullName } from "@/lib/brand";
import {
  getYoutubeEmbedId,
  homeGalleryItems,
  homeYoutube,
  type HomeGalleryItem,
} from "@/lib/home-media";

type HomeVideoClip = {
  id: string;
  title: string;
  url: string;
};

/** แถบชื่อใต้สื่อ — เตี้ย พื้นขาว ตัวเข้ม ตัดด้วย … */
function MediaCaption({
  title,
  asButton = false,
  onClick,
}: {
  title: string;
  asButton?: boolean;
  onClick?: () => void;
}) {
  const className =
    "w-full border-t border-slate-100 bg-white px-3 py-2 text-center";
  const label = (
    <span className="block truncate text-xs font-semibold leading-snug text-slate-700 sm:text-sm">
      {title}
    </span>
  );

  if (asButton && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} transition-colors hover:bg-slate-50`}
        title={title}
        aria-label={`ดูชื่อเต็ม: ${title}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={className} title={title}>
      {label}
    </div>
  );
}

function YoutubePlayerCard({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const [playing, setPlaying] = useState(false);
  const youtubeId = getYoutubeEmbedId(url);
  const youtubePoster = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null;

  if (!youtubeId) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
          <PlayCircle className="h-8 w-8" />
        </span>
        <p className="text-base font-semibold text-white">{title}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full">
      {playing ? (
        <iframe
          title={title}
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label={`เล่นวิดีโอ ${title}`}
        >
          {youtubePoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={youtubePoster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.35),transparent_42%),linear-gradient(160deg,#0f172a_0%,#1e293b_100%)]" />
          )}
          <span className="absolute inset-0 bg-slate-950/30 transition-colors group-hover:bg-slate-950/40" />
          <span className="relative text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-110">
            <PlayCircle className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1.35} />
          </span>
        </button>
      )}
    </div>
  );
}

function MediaSectionSkeleton({ galleryCount }: { galleryCount: number }) {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดสื่อประชาสัมพันธ์">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 sm:gap-5">
        {Array.from({ length: galleryCount }, (_, index) => (
          <div
            key={`gallery-skel-${index}`}
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
          >
            <div className="aspect-[16/10] animate-pulse bg-slate-100" />
            <div className="border-t border-slate-100 bg-white px-3 py-2">
              <div className="mx-auto h-3.5 w-2/3 max-w-[10rem] animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 max-w-4xl sm:mt-14">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="aspect-video animate-pulse bg-slate-200" />
          <div className="border-t border-slate-100 bg-white px-3 py-2">
            <div className="mx-auto h-3.5 w-40 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeMediaSection() {
  const galleryMedia = usePublicSiteMedia("HOME_GALLERY");
  const videoMedia = usePublicSiteMedia("HOME_VIDEO");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState("");
  const [titleModal, setTitleModal] = useState<string | null>(null);

  const isLoading = galleryMedia.isLoading || videoMedia.isLoading;

  const galleryItems = useMemo<HomeGalleryItem[]>(() => {
    if (galleryMedia.isLoading) {
      return [];
    }
    if (galleryMedia.items.length > 0) {
      return galleryMedia.items.map((item) => ({
        id: item.id,
        src: item.imageUrl,
        title: item.title,
        alt: item.altText || item.title,
      }));
    }
    return homeGalleryItems;
  }, [galleryMedia.isLoading, galleryMedia.items]);

  const videoClips = useMemo<HomeVideoClip[]>(() => {
    if (videoMedia.isLoading) {
      return [];
    }
    const mappedVideos = videoMedia.items
      .filter((item) => Boolean(item.href && getYoutubeEmbedId(item.href)))
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.href as string,
      }));
    if (mappedVideos.length > 0) {
      return mappedVideos;
    }
    return [
      {
        id: "fallback-youtube",
        title: homeYoutube.title,
        url: homeYoutube.url,
      },
    ];
  }, [videoMedia.isLoading, videoMedia.items]);

  const openGalleryLightbox = (src: string, title: string) => {
    setLightboxSrc(src);
    setLightboxTitle(title);
  };

  return (
    <section id="media" className="relative z-0 border-y border-slate-100 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[102rem] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">กิจกรรมและสื่อประชาสัมพันธ์</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
            ภาพกิจกรรมของ{facultyFullName} และคลิปแนะนำระบบ Nucare
          </p>
        </div>

        {isLoading ? (
          <MediaSectionSkeleton galleryCount={homeGalleryItems.length} />
        ) : (
          <>
            <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 sm:gap-5">
              {galleryItems.map((item) => {
                const hasImage = Boolean(item.src.trim());

                return (
                  <article
                    key={item.id}
                    className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
                  >
                    {hasImage ? (
                      <button
                        type="button"
                        onClick={() => openGalleryLightbox(item.src, item.title)}
                        className="group block w-full text-center"
                        aria-label={`ดูภาพ ${item.title}`}
                      >
                        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.src}
                            alt={item.alt}
                            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>
                        <MediaCaption title={item.title} />
                      </button>
                    ) : (
                      <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
                          <ImageIcon className="h-5 w-5" />
                        </span>
                        <p className="truncate px-2 text-xs font-semibold leading-snug text-slate-600 sm:text-sm">
                          {item.title}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div
              className={`mx-auto mt-12 flex flex-wrap justify-center gap-5 sm:mt-14 sm:gap-6 ${
                videoClips.length <= 1 ? "max-w-4xl" : "max-w-6xl"
              }`}
            >
              {videoClips.map((clip) => (
                <article
                  key={clip.id}
                  className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md ${
                    videoClips.length <= 1
                      ? "w-full"
                      : "w-full lg:w-[calc((100%-1.5rem)/2)]"
                  }`}
                >
                  <YoutubePlayerCard title={clip.title} url={clip.url} />
                  {clip.title ? (
                    <MediaCaption
                      title={clip.title}
                      asButton
                      onClick={() => setTitleModal(clip.title)}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {lightboxSrc ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4">
          <button
            type="button"
            aria-label="ปิดภาพขยาย"
            className="absolute inset-0"
            onClick={() => setLightboxSrc(null)}
          />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="min-w-0 flex-1 text-center text-sm font-semibold leading-snug text-slate-800">
                {lightboxTitle}
              </p>
              <button
                type="button"
                onClick={() => setLightboxSrc(null)}
                className="shrink-0 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxSrc}
                alt={lightboxTitle}
                className="mx-auto max-h-[75vh] w-full object-contain object-center"
              />
            </div>
          </div>
        </div>
      ) : null}

      {titleModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4">
          <button
            type="button"
            aria-label="ปิดชื่อคลิป"
            className="absolute inset-0"
            onClick={() => setTitleModal(null)}
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-500">ชื่อคลิป</p>
              <button
                type="button"
                onClick={() => setTitleModal(null)}
                className="shrink-0 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 text-center">
              <p className="text-base font-semibold leading-snug text-slate-800">{titleModal}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
