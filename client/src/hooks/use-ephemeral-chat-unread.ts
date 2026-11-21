"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";
import { setVisibleInterval } from "@/lib/visible-interval";

type UnreadCountResponse = { unreadCount: number };

const POLL_MS = 30_000;

/**
 * ดึงจำนวนห้องแชทชั่วคราวที่ยังไม่อ่าน — สำหรับ badge เมนู
 * โพลเบา ๆ (ข้ามเมื่อแท็บซ่อน) และรีเฟรชเมื่อแท็บกลับมาโฟกัส
 */
export function useEphemeralChatUnread(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await api.get<UnreadCountResponse>("/api/chat/unread-count");
      setUnreadCount(Math.max(0, response.data.unreadCount || 0));
    } catch {
      // เงียบเมื่อยังไม่มีสิทธิ์ / เครือข่ายล้ม
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    void refresh();
    const clearPoll = setVisibleInterval(() => {
      void refresh();
    }, POLL_MS);

    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearPoll();
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  return { unreadCount, refreshUnreadCount: refresh };
}
