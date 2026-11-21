export type ChatSessionAttentionInput = {
  peer: { id: string };
  unread?: boolean;
  preview?: { body?: string | null } | null;
  lastMessageAt: string | null;
};

export type ChatPeerAttention = {
  peerId: string;
  unread: boolean;
  previewBody: string | null;
  lastMessageAt: string | null;
};

/**
 * สร้างดัชนีสถานะแชทต่อ peer จากรายการ sessions — O(n)
 */
export function indexChatSessionsByPeer(
  sessions: readonly ChatSessionAttentionInput[]
): Map<string, ChatPeerAttention> {
  const map = new Map<string, ChatPeerAttention>();
  for (const session of sessions) {
    const peerId = session.peer?.id;
    if (!peerId) {
      continue;
    }
    map.set(peerId, {
      peerId,
      unread: Boolean(session.unread),
      previewBody: session.preview?.body?.trim() || null,
      lastMessageAt: session.lastMessageAt,
    });
  }
  return map;
}

/** นับจำนวน peer ที่มีข้อความยังไม่อ่าน — O(n) */
export function countUnreadChatPeers(
  attentionByPeerId: ReadonlyMap<string, ChatPeerAttention>
): number {
  let count = 0;
  for (const item of attentionByPeerId.values()) {
    if (item.unread) {
      count += 1;
    }
  }
  return count;
}

/**
 * เรียง peer: ยังไม่อ่าน → ข้อความล่าสุด → ชื่อ — O(n log n)
 */
export function sortPeersByChatAttention<T extends { id: string; name: string }>(
  peers: readonly T[],
  attentionByPeerId: ReadonlyMap<string, ChatPeerAttention>
): T[] {
  return [...peers].sort((left, right) => {
    const leftAtt = attentionByPeerId.get(left.id);
    const rightAtt = attentionByPeerId.get(right.id);
    const leftUnread = leftAtt?.unread ? 1 : 0;
    const rightUnread = rightAtt?.unread ? 1 : 0;
    if (leftUnread !== rightUnread) {
      return rightUnread - leftUnread;
    }
    const leftTime = leftAtt?.lastMessageAt ? new Date(leftAtt.lastMessageAt).getTime() : 0;
    const rightTime = rightAtt?.lastMessageAt ? new Date(rightAtt.lastMessageAt).getTime() : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.name.localeCompare(right.name, "th");
  });
}

/** รวมรายชื่อไดเรกทอรีกับ peer จาก session โดยไม่ซ้ำ — O(n) */
export function mergeDirectoryPeers<T extends { id: string }>(
  directoryPeers: readonly T[],
  sessionPeers: readonly T[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const peer of directoryPeers) {
    if (seen.has(peer.id)) {
      continue;
    }
    seen.add(peer.id);
    merged.push(peer);
  }
  for (const peer of sessionPeers) {
    if (seen.has(peer.id)) {
      continue;
    }
    seen.add(peer.id);
    merged.push(peer);
  }
  return merged;
}

/** กรองรายชื่อตามชื่อหรือรหัสนิสิต (ค้นในฝั่งไคลเอนต์) — O(n) */
export function filterPeersByDirectoryQuery<
  T extends { name: string; studentId?: string | null },
>(peers: readonly T[], rawQuery: string): T[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return [...peers];
  }
  return peers.filter((peer) => {
    if (peer.name.toLowerCase().includes(q)) {
      return true;
    }
    const studentId = peer.studentId?.toLowerCase() ?? "";
    return studentId.includes(q);
  });
}

/** รายชื่อ peer ที่มีข้อความยังไม่อ่าน เรียงล่าสุดก่อน — O(n log n) */
export function listUnreadChatPeers<T extends { id: string }>(
  peers: readonly T[],
  attentionByPeerId: ReadonlyMap<string, ChatPeerAttention>
): T[] {
  return peers
    .filter((peer) => attentionByPeerId.get(peer.id)?.unread)
    .sort((left, right) => {
      const leftAt = attentionByPeerId.get(left.id)?.lastMessageAt;
      const rightAt = attentionByPeerId.get(right.id)?.lastMessageAt;
      const leftTime = leftAt ? new Date(leftAt).getTime() : 0;
      const rightTime = rightAt ? new Date(rightAt).getTime() : 0;
      return rightTime - leftTime;
    });
}
