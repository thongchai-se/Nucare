"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { MessageCircle, Users, X } from "lucide-react";
import { EphemeralChatInbox } from "./ephemeral-chat-inbox";
import type { EphemeralChatPeer } from "./types";

type EphemeralChatPanelProps = {
  open: boolean;
  currentUserId: string;
  /** เปิดคุยกับคนนี้ทันที */
  peerUserId: string | null;
  onClose: () => void;
  /** รายชื่อสำหรับสลับคู่สนทนาในแผง (ถ้ามี) */
  peers?: EphemeralChatPeer[];
  onSelectPeer?: (peerUserId: string) => void;
  /** peer ที่ยังมีข้อความรออ่าน — โชว์จุดแดงตอนเปลี่ยนคน */
  unreadPeerIds?: ReadonlySet<string>;
};

/**
 * แผงทักหา — ไม่ล็อกสกอลล์ทั้งหน้า (กันกระชากตอนปิด)
 * มือถือเป็นชีทเต็มจอเหนือ bottom nav · เดสก์ท็อปเป็นแผงลอยมุมขวา
 */
export function EphemeralChatPanel({
  open,
  currentUserId,
  peerUserId,
  onClose,
  peers = [],
  onSelectPeer,
  unreadPeerIds,
}: EphemeralChatPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [pickingPeer, setPickingPeer] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPickingPeer(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (pickingPeer) {
          setPickingPeer(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pickingPeer]);

  if (!mounted || !open || !peerUserId) {
    return null;
  }

  const activePeer = peers.find((peer) => peer.id === peerUserId) ?? null;
  const canSwitchPeer = Boolean(onSelectPeer && peers.length > 1);
  const unreadSwitchCount = unreadPeerIds
    ? peers.reduce((count, peer) => count + (unreadPeerIds.has(peer.id) ? 1 : 0), 0)
    : 0;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="ปิดพื้นหลังแชท"
        className="fixed inset-0 z-[130] bg-slate-900/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ทักหาในระบบ"
        className="fixed inset-x-0 bottom-0 z-[131] flex h-[min(100dvh,100%)] max-h-[100dvh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-20px_rgba(15,23,42,0.35),0_8px_16px_-8px_rgba(15,23,42,0.12)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(36rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(26rem,calc(100vw-1.5rem))] sm:rounded-2xl"
        style={{ animation: "toast-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <header className="relative flex shrink-0 items-center gap-2.5 border-b border-slate-100 bg-gradient-to-b from-sky-50/90 to-white px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0057A8] text-xs font-bold text-white shadow-[0_8px_16px_-8px_rgba(0,87,168,0.55)]">
            {activePeer?.initials && !pickingPeer ? (
              <span aria-hidden>{activePeer.initials}</span>
            ) : (
              <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {pickingPeer ? "เลือกคนที่จะทัก" : activePeer?.name || "ทักหาในระบบ"}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {pickingPeer
                ? "เลือกแล้วคุยต่อได้ทันที"
                : activePeer?.roleLabels?.join(" · ") || "ข้อความจะถูกลบทุกวัน"}
            </p>
          </div>
          {canSwitchPeer && !pickingPeer ? (
            <button
              type="button"
              onClick={() => setPickingPeer(true)}
              className="relative inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Users className="h-3.5 w-3.5" />
              เปลี่ยนคน
              {unreadSwitchCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadSwitchCount > 9 ? "9+" : unreadSwitchCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดแชท"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        {pickingPeer && onSelectPeer ? (
          <ul className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {[...peers]
              .sort((left, right) => {
                const leftUnread = unreadPeerIds?.has(left.id) ? 1 : 0;
                const rightUnread = unreadPeerIds?.has(right.id) ? 1 : 0;
                if (leftUnread !== rightUnread) {
                  return rightUnread - leftUnread;
                }
                return left.name.localeCompare(right.name, "th");
              })
              .map((peer) => {
                const selected = peer.id === peerUserId;
                const unread = Boolean(unreadPeerIds?.has(peer.id));
                return (
                  <li key={peer.id} className="border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPeer(peer.id);
                        setPickingPeer(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white ${
                        selected ? "bg-[#0057A8]/5" : "bg-transparent"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          unread || selected
                            ? "bg-[#0057A8] text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        {peer.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            unread ? "font-bold text-slate-900" : "font-semibold text-slate-900"
                          }`}
                        >
                          {peer.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {peer.roleLabels.join(" · ") || peer.employeeId || "บุคลากร"}
                        </p>
                      </div>
                      {selected ? (
                        <span className="text-[11px] font-bold text-[#0057A8]">กำลังคุย</span>
                      ) : unread ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                          aria-label="ยังไม่อ่าน"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
          </ul>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <EphemeralChatInbox
              key={peerUserId}
              currentUserId={currentUserId}
              peerUserId={peerUserId}
              hidePeerHeader
              className="h-full min-h-0"
            />
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
