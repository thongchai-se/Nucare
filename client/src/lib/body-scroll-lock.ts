type ScrollLockSnapshot = {
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  htmlOverflow: string;
  scrollY: number;
};

let lockCount = 0;
let snapshot: ScrollLockSnapshot | null = null;

/**
 * ล็อกสกอลล์หน้าเว็บแบบนับจำนวน — ค้างตำแหน่งสกอลล์ด้วย position:fixed
 * ไม่ใส่ paddingRight เพราะโปรเจกต์ใช้ scrollbar-gutter: stable อยู่แล้ว
 * (ถ้าใส่จะชดเชยซ้ำแล้วเนื้อหาเลื่อนซ้ายตอนเปิดโมดัล)
 */
export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => {};
  }

  if (lockCount === 0) {
    snapshot = {
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      htmlOverflow: document.documentElement.style.overflow,
      scrollY: window.scrollY,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${snapshot.scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
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
    document.body.style.position = restore.bodyPosition;
    document.body.style.top = restore.bodyTop;
    document.body.style.left = restore.bodyLeft;
    document.body.style.right = restore.bodyRight;
    document.body.style.width = restore.bodyWidth;
    window.scrollTo(0, restore.scrollY);
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
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
}
