"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InlineLoader } from "@/components/ui/page-loader";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/student-dashboard";
import { setVisibleInterval } from "@/lib/visible-interval";
import { MessageComposer } from "./message-composer";
import { MessageThread } from "./message-thread";
import type { EphemeralChatMessage, EphemeralChatPeer } from "./types";

type EphemeralChatInboxProps = {
  currentUserId: string;
  /** เปิดคุยกับคนนี้ทันที — ไม่โชว์รายชื่อให้เลือก */
  peerUserId: string;
  /** ซ่อนหัวคู่สนทนาเมื่อแผงด้านนอกแสดงชื่ออยู่แล้ว */
  hidePeerHeader?: boolean;
  className?: string;
};

type OpenSessionResponse = {
  session: {
    id: string;
    peer: EphemeralChatPeer;
  };
  messages: EphemeralChatMessage[];
};
type MessagesResponse = { messages: EphemeralChatMessage[] };
type PostMessageResponse = { message: EphemeralChatMessage };

const POLL_MS = 5000;

/** รวมข้อความโดยคงลำดับเดิมและกัน id ซ้ำ (กัน race ระหว่างส่งกับ poll) */
function mergeMessagesById(
  previous: EphemeralChatMessage[],
  incoming: readonly EphemeralChatMessage[],
  options?: { replaceIds?: ReadonlySet<string> }
): EphemeralChatMessage[] {
  const replaceIds = options?.replaceIds;
  const base = replaceIds
    ? previous.filter((item) => !replaceIds.has(item.id))
    : previous;
  const seen = new Set(base.map((item) => item.id));
  const merged = [...base];
  for (const item of incoming) {
    if (seen.has(item.id)) {
      continue;
    }
    merged.push(item);
    seen.add(item.id);
  }
  return merged;
}

/** เธรดแชทชั่วคราวกับคู่สนทนาคนเดียว — ลบอัตโนมัติตอนเที่ยงคืน / เมื่อเซิร์ฟเวอร์แน่น */
export function EphemeralChatInbox({
  currentUserId,
  peerUserId,
  hidePeerHeader = false,
  className = "",
}: EphemeralChatInboxProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<EphemeralChatPeer | null>(null);
  const [messages, setMessages] = useState<EphemeralChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastCursorRef = useRef<string | null>(null);
  const openedPeerRef = useRef<string | null>(null);

  const openWithPeer = useCallback(async (peerId: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<OpenSessionResponse>("/api/chat/sessions", {
        peerUserId: peerId,
      });
      const session = response.data.session;
      const loaded = response.data.messages || [];
      setActiveSessionId(session.id);
      setActivePeer(session.peer);
      setMessages(mergeMessagesById([], loaded));
      lastCursorRef.current = loaded[loaded.length - 1]?.id ?? null;
    } catch (err) {
      setError(getApiErrorMessage(err, "เปิดแชทไม่สำเร็จ"));
      setActiveSessionId(null);
      setActivePeer(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!peerUserId || openedPeerRef.current === peerUserId) {
      return;
    }
    openedPeerRef.current = peerUserId;
    void openWithPeer(peerUserId);
  }, [peerUserId, openWithPeer]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const after = lastCursorRef.current;
        const response = await api.get<MessagesResponse>(
          `/api/chat/sessions/${activeSessionId}/messages`,
          after ? { params: { after } } : undefined
        );
        if (cancelled) {
          return;
        }
        const incoming = response.data.messages || [];
        if (incoming.length === 0) {
          return;
        }
        setMessages((prev) => mergeMessagesById(prev, incoming));
        lastCursorRef.current = incoming[incoming.length - 1]?.id ?? lastCursorRef.current;
      } catch {
        // poll เงียบเมื่อห้องถูกลบหลังเที่ยงคืน / แรงดันพื้นที่
      }
    };

    const clearPoll = setVisibleInterval(() => {
      void tick();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [activeSessionId]);

  const sendMessage = async () => {
    if (!activeSessionId || !draft.trim() || sending) {
      return;
    }
    const body = draft.trim();
    const optimisticId = `local-${Date.now()}`;
    const optimistic: EphemeralChatMessage = {
      id: optimisticId,
      sessionId: activeSessionId,
      senderId: currentUserId,
      body,
      createdAt: new Date().toISOString(),
    };
    setDraft("");
    setSending(true);
    setMessages((prev) => [...prev, optimistic]);
    try {
      const response = await api.post<PostMessageResponse>(
        `/api/chat/sessions/${activeSessionId}/messages`,
        { body }
      );
      const confirmed = response.data.message;
      setMessages((prev) =>
        mergeMessagesById(prev, [confirmed], {
          replaceIds: new Set([optimisticId, confirmed.id]),
        })
      );
      lastCursorRef.current = confirmed.id;
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setDraft(body);
      setError(getApiErrorMessage(err, "ส่งข้อความไม่สำเร็จ"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(0,87,168,0.06),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] ${className}`}
    >
      {error ? (
        <div className="border-b border-slate-200 px-4 py-2">
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <InlineLoader label="กำลังเปิดแชท" />
        </div>
      ) : activeSessionId && activePeer ? (
        <>
          {hidePeerHeader ? null : (
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0057A8] text-xs font-bold text-white shadow-sm">
                {activePeer.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{activePeer.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {activePeer.roleLabels.join(" · ") || "กำลังสนทนา"}
                </p>
              </div>
            </header>
          )}

          <MessageThread messages={messages} currentUserId={currentUserId} />
          <MessageComposer
            value={draft}
            disabled={sending}
            onChange={setDraft}
            onSubmit={() => {
              void sendMessage();
            }}
          />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-semibold text-slate-700">เปิดแชทไม่สำเร็จ</p>
          <p className="max-w-sm text-xs text-slate-500">ปิดแล้วลองกดคุยสั้นอีกครั้ง</p>
        </div>
      )}
    </div>
  );
}
