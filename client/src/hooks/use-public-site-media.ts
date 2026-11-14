"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import {
  clearSiteMediaCache,
  readSiteMediaCache,
  writeSiteMediaCache,
} from "@/lib/site-media-cache";
import { fetchPublicSiteMedia, type SiteMediaItemDto, type SiteMediaSlot } from "@/lib/site-media-api";

export type PublicSiteMediaStatus = "loading" | "ready";

export type PublicSiteMediaState = {
  items: SiteMediaItemDto[];
  status: PublicSiteMediaStatus;
  isLoading: boolean;
};

/** ดึงสื่อสาธารณะพร้อมแคช — ไม่โชว์ placeholder ว่างตอนโหลด และรีเฟรชแล้วยังมีรูปเดิมทันที */
export function usePublicSiteMedia(slot: SiteMediaSlot): PublicSiteMediaState {
  const [items, setItems] = useState<SiteMediaItemDto[]>([]);
  const [status, setStatus] = useState<PublicSiteMediaStatus>("loading");

  useLayoutEffect(() => {
    const cached = readSiteMediaCache(slot);
    if (!cached) {
      return;
    }
    setItems(cached);
    setStatus("ready");
  }, [slot]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fresh = await fetchPublicSiteMedia(slot);
      if (cancelled) {
        return;
      }
      writeSiteMediaCache(slot, fresh);
      setItems(fresh);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [slot]);

  return {
    items,
    status,
    isLoading: status === "loading",
  };
}

/** ล้างแคชหลังแอดมิน/กองพัฒแก้สื่อ เพื่อไม่ให้หน้าสาธารณะค้างรูปเก่า */
export function invalidatePublicSiteMediaCache(slot?: SiteMediaSlot): void {
  clearSiteMediaCache(slot);
}
