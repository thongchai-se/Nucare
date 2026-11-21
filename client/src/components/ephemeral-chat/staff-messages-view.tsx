"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import {
  countUnreadChatPeers,
  indexChatSessionsByPeer,
  sortPeersByChatAttention,
} from "@/lib/ephemeral-chat-attention";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { UI_ACTION_PRIMARY_COMPACT } from "@/lib/ui-classes";
import { setVisibleInterval } from "@/lib/visible-interval";
import { FilterSummaryChip } from "@/components/ui/filter-summary-chip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { InlineLoader } from "@/components/ui/page-loader";
import {
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterSearchInput,
  RosterSelectFilter,
  RosterTable,
  RosterTableCard,
  RosterTd,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import type { EphemeralChatPeer, EphemeralChatSession } from "./types";

const PEER_PAGE_SIZE = 10;
const YEAR_OPTIONS = ["1", "2", "3", "4"] as const;

type AttentionFilter = "all" | "unread";

type SessionsResponse = {
  sessions: EphemeralChatSession[];
  unreadCount?: number;
};

type PeersResponse = {
  peers: EphemeralChatPeer[];
  total?: number;
  page?: number;
  pageSize?: number;
};

type StaffMessagesViewProps = {
  onOpenChat: (peerUserId: string) => void;
  /** เรียกหลังโหลดรายการ — อัปเดต badge เมนู */
  onUnreadCountChange?: (count: number) => void;
};

function matchesPeerSearch(peer: EphemeralChatPeer, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = `${peer.name} ${peer.studentId || ""} ${peer.employeeId || ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** ไดเรกทอรีข้อความ — กรองชั้นปีแบบติดตามคัดกรอง + ชิปยังไม่อ่าน · footer Admin */
export function StaffMessagesView({
  onOpenChat,
  onUnreadCountChange,
}: StaffMessagesViewProps) {
  const [peers, setPeers] = useState<EphemeralChatPeer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<EphemeralChatSession[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<"ALL" | string>("ALL");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;

  const loadSessions = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoadingSessions(true);
    }
    try {
      const response = await api.get<SessionsResponse>("/api/chat/sessions");
      const list = response.data.sessions || [];
      setSessions(list);
      const unread =
        typeof response.data.unreadCount === "number"
          ? response.data.unreadCount
          : list.filter((session) => session.unread).length;
      onUnreadCountChangeRef.current?.(unread);
    } catch (err) {
      if (!options?.quiet) {
        setSessions([]);
        setError((prev) => prev || getApiErrorMessage(err, "โหลดข้อความไม่สำเร็จ"));
      }
    } finally {
      if (!options?.quiet) {
        setLoadingSessions(false);
      }
    }
  }, []);

  const loadPeers = useCallback(
    async (nextPage: number, query: string, year: "ALL" | string) => {
      setLoadingPeers(true);
      try {
        const response = await api.get<PeersResponse>("/api/chat/peers", {
          params: {
            page: String(nextPage),
            pageSize: String(PEER_PAGE_SIZE),
            ...(query ? { q: query } : {}),
            ...(year !== "ALL" ? { studyYear: year } : {}),
          },
        });
        setPeers(response.data.peers || []);
        setTotal(
          typeof response.data.total === "number"
            ? response.data.total
            : (response.data.peers || []).length
        );
        setError("");
      } catch (err) {
        setPeers([]);
        setTotal(0);
        setError(getApiErrorMessage(err, "โหลดรายชื่อนิสิตไม่สำเร็จ"));
      } finally {
        setLoadingPeers(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadSessions();
    const clearPoll = setVisibleInterval(() => {
      void loadSessions({ quiet: true });
    }, 20_000);
    return () => clearPoll();
  }, [loadSessions]);

  useEffect(() => {
    // โหลดไดเรกทอรีเสมอเพื่อตัวนับ «ทั้งหมด» แม้กำลังดูแท็บยังไม่อ่าน
    void loadPeers(page, appliedQuery, yearFilter);
  }, [appliedQuery, loadPeers, page, yearFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setAppliedQuery((prev) => {
        if (prev === next) {
          return prev;
        }
        setPage(1);
        return next;
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const attentionByPeerId = useMemo(
    () => indexChatSessionsByPeer(sessions),
    [sessions]
  );

  const unreadCount = useMemo(
    () => countUnreadChatPeers(attentionByPeerId),
    [attentionByPeerId]
  );

  const unreadPeers = useMemo(() => {
    const fromSessions = sessions
      .filter((session) => session.unread)
      .map((session) => session.peer);
    const unique = new Map<string, EphemeralChatPeer>();
    for (const peer of fromSessions) {
      if (!unique.has(peer.id)) {
        unique.set(peer.id, peer);
      }
    }
    return sortPeersByChatAttention([...unique.values()], attentionByPeerId).filter((peer) => {
      if (yearFilter !== "ALL" && peer.kind === "student" && peer.studyYear !== yearFilter) {
        return false;
      }
      return matchesPeerSearch(peer, appliedQuery);
    });
  }, [appliedQuery, attentionByPeerId, sessions, yearFilter]);

  const directoryPeers = useMemo(
    () => sortPeersByChatAttention(peers, attentionByPeerId),
    [attentionByPeerId, peers]
  );

  const usingUnreadFilter = attentionFilter === "unread";
  const filteredTotal = usingUnreadFilter ? unreadPeers.length : total;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PEER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = filteredTotal === 0 ? 0 : (currentPage - 1) * PEER_PAGE_SIZE + 1;
  const rangeEnd =
    filteredTotal === 0 ? 0 : Math.min(currentPage * PEER_PAGE_SIZE, filteredTotal);

  const visiblePeers = useMemo(() => {
    if (!usingUnreadFilter) {
      return directoryPeers;
    }
    const start = (currentPage - 1) * PEER_PAGE_SIZE;
    return unreadPeers.slice(start, start + PEER_PAGE_SIZE);
  }, [currentPage, directoryPeers, unreadPeers, usingUnreadFilter]);

  const loading =
    !usingUnreadFilter &&
    (loadingPeers || loadingSessions) &&
    peers.length === 0 &&
    total === 0;
  const emptyMessage = appliedQuery
    ? "ไม่พบนิสิตที่ตรงกับคำค้น"
    : usingUnreadFilter
      ? "ไม่มีข้อความที่ยังไม่อ่าน"
      : yearFilter !== "ALL"
        ? `ไม่พบนิสิตชั้นปี ${yearFilter}`
        : "ยังไม่มีนิสิตที่ทักได้";

  return (
    <section className="w-full space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">ข้อความ</h2>
        <p className="mt-1 text-sm text-slate-500">
          เลือกคนเพื่อทักหรือเปิดคุยต่อ ข้อความจะถูกลบทุกวัน
        </p>
      </header>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="กรองข้อความ">
        <FilterSummaryChip
          density="compact"
          label="ทั้งหมด"
          value={total}
          selected={attentionFilter === "all"}
          onClick={() => {
            setAttentionFilter("all");
            setPage(1);
          }}
        />
        <FilterSummaryChip
          density="compact"
          label="ยังไม่อ่าน"
          value={unreadCount}
          selected={attentionFilter === "unread"}
          onClick={() => {
            setAttentionFilter("unread");
            setPage(1);
          }}
        />
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="ค้นหาชื่อหรือรหัส (ไม่บังคับ)"
              aria-label="ค้นหารายชื่อนิสิต ถ้าต้องการ"
            />
            <RosterToolbarEnd>
              <RosterSelectFilter
                value={yearFilter}
                onChange={(value) => {
                  setYearFilter(value);
                  setPage(1);
                }}
                aria-label="กรองชั้นปี"
              >
                <option value="ALL">ทุกชั้นปี</option>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    ชั้นปี {year}
                  </option>
                ))}
              </RosterSelectFilter>
            </RosterToolbarEnd>
          </>
        }
      >
        {loading || (!usingUnreadFilter && loadingPeers && visiblePeers.length === 0) ? (
          <InlineLoader label="กำลังโหลดรายชื่อ" className="px-6 py-16" />
        ) : (
          <>
            <RosterTable
              columns={[
                { key: "student", label: "นิสิต", width: "52%" },
                { key: "year", label: "ชั้นปี", width: "18%", align: "center" },
                { key: "actions", label: "จัดการ", align: "center", width: "30%" },
              ]}
              emptyMessage={
                <span className="inline-flex flex-col items-center gap-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0057A8]/10 text-[#0057A8]">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  {emptyMessage}
                </span>
              }
              minWidthClass="min-w-[560px]"
            >
              {visiblePeers.map((peer) => {
                const attention = attentionByPeerId.get(peer.id);
                const unread = Boolean(attention?.unread);
                const meta = peer.studentId || peer.roleLabels.join(" · ") || peer.employeeId || "นิสิต";

                return (
                  <RosterRow key={peer.id} onClick={() => onOpenChat(peer.id)}>
                    <RosterTd>
                      <div className="flex min-w-0 items-center gap-2">
                        <RosterPersonCell
                          name={peer.name}
                          meta={meta}
                          avatarText={peer.initials}
                          showAvatar
                        />
                        {unread ? (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                            aria-label="ยังไม่อ่าน"
                          />
                        ) : null}
                      </div>
                    </RosterTd>
                    <RosterTd align="center" className="font-medium text-slate-700">
                      {peer.studyYear || "—"}
                    </RosterTd>
                    <RosterTd align="center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenChat(peer.id);
                        }}
                        className={UI_ACTION_PRIMARY_COMPACT}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {unread ? "เปิดแชท" : "ทักหา"}
                      </button>
                    </RosterTd>
                  </RosterRow>
                );
              })}
            </RosterTable>

            <RosterMobileList
              emptyMessage={
                <span className="inline-flex flex-col items-center gap-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0057A8]/10 text-[#0057A8]">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  {emptyMessage}
                </span>
              }
            >
              {visiblePeers.map((peer) => {
                const attention = attentionByPeerId.get(peer.id);
                const unread = Boolean(attention?.unread);
                const meta = peer.studentId || peer.roleLabels.join(" · ") || peer.employeeId || "นิสิต";

                return (
                  <RosterMobileCard key={peer.id}>
                    <button
                      type="button"
                      onClick={() => onOpenChat(peer.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-3">
                        <RosterPersonCell
                          name={peer.name}
                          meta={meta}
                          avatarText={peer.initials}
                          showAvatar
                        />
                        {unread ? (
                          <span
                            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                            aria-label="ยังไม่อ่าน"
                          />
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        ชั้นปี {peer.studyYear || "—"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChat(peer.id)}
                      className={`${UI_ACTION_PRIMARY_COMPACT} mt-4 w-full py-2.5 text-sm`}
                    >
                      <Send className="h-4 w-4" />
                      {unread ? "เปิดแชท" : "ทักหา"}
                    </button>
                  </RosterMobileCard>
                );
              })}
            </RosterMobileList>
          </>
        )}

        {filteredTotal > 0 ? (
          <ListPaginationFooter
            total={filteredTotal}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            currentPage={currentPage}
            canGoPrev={currentPage > 1}
            canGoNext={currentPage < totalPages}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          />
        ) : null}
      </RosterTableCard>
    </section>
  );
}
