/**
 * ตั้ง interval ที่ข้าม tick เมื่อแท็บถูกซ่อน — ลดโพล API บนเซิร์ฟเวอร์จำกัด
 * คืนฟังก์ชัน cleanup เหมือน setInterval
 */
export function setVisibleInterval(tick: () => void, intervalMs: number): () => void {
  const id = window.setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    tick();
  }, intervalMs);

  return () => {
    window.clearInterval(id);
  };
}
