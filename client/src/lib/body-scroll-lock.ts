type ScrollLockSnapshot = {
  bodyOverflow: string;
  htmlOverflow: string;
  bodyOverscrollBehavior: string;
  htmlOverscrollBehavior: string;
};

let lockCount = 0;
let snapshot: ScrollLockSnapshot | null = null;

/**
 * ล็อกสกอลล์พื้นหลังแบบนับจำนวน — ใช้ overflow:hidden อย่างเดียว
 * ไม่ใช้ position:fixed (กันกระชากเลื่อนขึ้น/ลงตอนเปิด-ปิดโมดัล)
 * ไม่ใส่ paddingRight เพราะโปรเจกต์ใช้ scrollbar-gutter: stable อยู่แล้ว
 */
export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => {};
  }

  if (lockCount === 0) {
    snapshot = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !snapshot) {
      return;
    }

    const restore = snapshot;
    snapshot = null;
    document.documentElement.style.overflow = restore.htmlOverflow;
    document.body.style.overflow = restore.bodyOverflow;
    document.documentElement.style.overscrollBehavior = restore.htmlOverscrollBehavior;
    document.body.style.overscrollBehavior = restore.bodyOverscrollBehavior;
  };
}

/** จำนวนล็อกที่ค้างอยู่ — ใช้ในเทสเท่านั้น */
export function getBodyScrollLockCountForTests(): number {
  return lockCount;
}

/** รีเซ็ตสถานะล็อก — ใช้ในเทสเท่านั้น */
export function resetBodyScrollLockForTests(): void {
  lockCount = 0;
  snapshot = null;
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.documentElement.style.overscrollBehavior = "";
  document.body.style.overscrollBehavior = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
}
