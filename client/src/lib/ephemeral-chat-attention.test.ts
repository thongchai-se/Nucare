import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countUnreadChatPeers,
  filterPeersByDirectoryQuery,
  indexChatSessionsByPeer,
  listUnreadChatPeers,
  mergeDirectoryPeers,
  sortPeersByChatAttention,
  type ChatSessionAttentionInput,
} from "./ephemeral-chat-attention";

function session(
  peerId: string,
  unread: boolean,
  lastMessageAt: string | null,
  previewBody?: string
): ChatSessionAttentionInput {
  return {
    peer: { id: peerId },
    unread,
    lastMessageAt,
    preview: previewBody ? { body: previewBody } : null,
  };
}

describe("ephemeral-chat-attention", () => {
  it("สร้างดัชนี unread/preview ต่อ peer", () => {
    const map = indexChatSessionsByPeer([
      session("a", true, "2026-11-19T10:00:00.000Z", "สวัสดี"),
      session("b", false, "2026-11-19T09:00:00.000Z", "  "),
    ]);
    assert.equal(map.get("a")?.unread, true);
    assert.equal(map.get("a")?.previewBody, "สวัสดี");
    assert.equal(map.get("b")?.unread, false);
    assert.equal(map.get("b")?.previewBody, null);
    assert.equal(countUnreadChatPeers(map), 1);
  });

  it("เรียง peer ที่ยังไม่อ่านขึ้นก่อน แล้วตามข้อความล่าสุด", () => {
    const map = indexChatSessionsByPeer([
      session("zebra", false, "2026-11-19T12:00:00.000Z"),
      session("alpha", true, "2026-11-19T11:00:00.000Z"),
    ]);
    const sorted = sortPeersByChatAttention(
      [
        { id: "zebra", name: "Zebra" },
        { id: "alpha", name: "Alpha" },
        { id: "beta", name: "Beta" },
      ],
      map
    );
    assert.deepEqual(
      sorted.map((peer) => peer.id),
      ["alpha", "zebra", "beta"]
    );
  });

  it("รวมไดเรกทอรีกับ peer จาก session โดยไม่ซ้ำ", () => {
    const merged = mergeDirectoryPeers(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      [
        { id: "b", name: "B-session" },
        { id: "c", name: "C" },
      ]
    );
    assert.deepEqual(
      merged.map((peer) => peer.id),
      ["a", "b", "c"]
    );
    assert.equal(merged[1]?.name, "B");
  });

  it("กรองรายชื่อตามชื่อหรือรหัสนิสิต", () => {
    const peers = [
      { id: "1", name: "สมชาย ใจดี", studentId: "681100001-1" },
      { id: "2", name: "สมหญิง รักเรียน", studentId: "681100002-2" },
    ];
    assert.equal(filterPeersByDirectoryQuery(peers, "").length, 2);
    assert.deepEqual(
      filterPeersByDirectoryQuery(peers, "สมหญ").map((peer) => peer.id),
      ["2"]
    );
    assert.deepEqual(
      filterPeersByDirectoryQuery(peers, "681100001").map((peer) => peer.id),
      ["1"]
    );
    assert.equal(filterPeersByDirectoryQuery(peers, "ไม่มีใคร").length, 0);
  });

  it("ลิสต์เฉพาะ peer ที่ยังไม่อ่านเรียงล่าสุดก่อน", () => {
    const map = indexChatSessionsByPeer([
      session("old", true, "2026-11-19T08:00:00.000Z"),
      session("new", true, "2026-11-19T12:00:00.000Z"),
      session("read", false, "2026-11-19T13:00:00.000Z"),
    ]);
    const unread = listUnreadChatPeers(
      [
        { id: "old", name: "Old" },
        { id: "new", name: "New" },
        { id: "read", name: "Read" },
      ],
      map
    );
    assert.deepEqual(
      unread.map((peer) => peer.id),
      ["new", "old"]
    );
  });
});
