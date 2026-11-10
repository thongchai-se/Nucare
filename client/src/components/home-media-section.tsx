"use client";

import { useEffect, useState } from "react";
import { ImageIcon, PlayCircle, X } from "lucide-react";
import { facultyFullName } from "@/lib/brand";
import {
  getYoutubeEmbedId,
  homeGalleryItems,
  homeYoutube,
  type HomeGalleryItem,
} from "@/lib/home-media";
import { fetchPublicSiteMedia } from "@/lib/site-media-api";

export function HomeMediaSection() {
  const [galleryItems, setGalleryItems] = useState<HomeGalleryItem[]>(homeGalleryItems);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState("");
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const youtubeId = getYoutubeEmbedId(homeYoutube.url);
  const youtubePoster = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await fetchPublicSiteMedia("HOME_GALLERY");
      if (cancelled || items.length === 0) {
        return;
      }
      setGalleryItems(
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

  return (
    <section id="media" className="relative z-0 border-y border-slate-100 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[102rem] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Highlights</p>
          <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl">กิจกรรมและสื่อประชาสัมพันธ์</h2>
          <p className="px-2 text-sm leading-relaxed text-slate-500 sm:text-base">
            พื้นที่แสดงภาพกิจกรรมของ{facultyFullName} และคลิปแนะนำระบบ Nucare
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {galleryItems.map((item) => {
            const hasImage = Boolean(item.src.trim());

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
              >
                {hasImage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLightboxSrc(item.src);
                      setLightboxTitle(item.title);
                    }}
                    className="group block w-full text-left"
                    aria-label={`ดูภาพ ${item.title}`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.src}
                        alt={item.alt}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="border-t border-slate-100 bg-white px-4 py-3">
                      <h3 className="line-clamp-2 text-sm font-bold text-slate-800">{item.title}</h3>
                    </div>
                  </button>
                ) : (
                  <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#eff6ff_0%,#f8fafc_55%,#ecfeff_100%)] px-4 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-600 shadow-sm">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-bold text-slate-700">{item.title}</p>
                    <p className="text-xs text-slate-500">พื้นที่แสดงภาพกิจกรรม</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-4xl sm:mt-14">
          <div className="mb-5 text-center sm:mb-6">
            <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">{homeYoutube.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{homeYoutube.description}</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-md">
            {youtubeId ? (
              <div className="relative aspect-video w-full">
                {youtubePlaying ? (
                  <iframe
                    title={homeYoutube.title}
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setYoutubePlaying(true)}
                    className="group absolute inset-0 flex items-center justify-center"
                    aria-label={`เล่นวิดีโอ ${homeYoutube.title}`}
                  >
                    {youtubePoster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={youtubePoster}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.35),transparent_42%),linear-gradient(160deg,#0f172a_0%,#1e293b_100%)]" />
                    )}
                    <span className="absolute inset-0 bg-slate-950/35 transition-colors group-hover:bg-slate-950/45" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/95 text-blue-800 shadow-lg transition-transform group-hover:scale-105">
                      <PlayCircle className="h-9 w-9" />
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.35),transparent_42%),linear-gradient(160deg,#0f172a_0%,#1e293b_100%)] px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
                  <PlayCircle className="h-8 w-8" />
                </span>
                <p className="text-base font-bold text-white">ช่องแสดงคลิป YouTube</p>
                <p className="max-w-md text-sm leading-6 text-slate-300">
                  เตรียมพื้นที่ไว้สำหรับคลิปแนะนำระบบ 1 คลิป จากคณะ
                </p>
              </div>
            )}
          </div>
        </div>
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
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="truncate text-sm font-bold text-slate-800">{lightboxTitle}</p>
              <button
                type="button"
                onClick={() => setLightboxSrc(null)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightboxSrc} alt={lightboxTitle} className="mx-auto max-h-[75vh] w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
