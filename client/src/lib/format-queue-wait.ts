/** คำนวณข้อความอายุคิวแบบสั้นสำหรับ triage ในรายการซ้าย */
export function formatQueueWait(createdAt: string, nowMs: number = Date.now()): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return "เพิ่งเข้าคิว";
  }

  const minutes = Math.max(0, Math.floor((nowMs - created.getTime()) / 60_000));
  if (minutes < 2) {
    return "เพิ่งเข้าคิว";
  }
  if (minutes < 60) {
    return `รอมา ${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `รอมา ${hours} ชม.`;
  }

  return `รอมา ${Math.floor(hours / 24)} วัน`;
}
