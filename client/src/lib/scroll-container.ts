function isDocumentRoot(node: HTMLElement): boolean {
  return node === document.body || node === document.documentElement;
}

/**
 * เลื่อนเฉพาะคอนเทนเนอร์ที่ overflow ได้ไปท้ายรายการ
 * — ไม่ใช้ scrollIntoView และห้ามแตะ body/html (กันทั้งหน้ากระชากลงสุด)
 */
export function scrollOverflowContainerToBottom(node: HTMLElement | null): void {
  if (!node || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  let parent: HTMLElement | null = node.parentElement;
  while (parent && !isDocumentRoot(parent)) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY || style.overflow;
    const canScrollY =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      parent.scrollHeight > parent.clientHeight + 1;

    if (canScrollY) {
      parent.scrollTop = parent.scrollHeight;
      return;
    }
    parent = parent.parentElement;
  }
}
