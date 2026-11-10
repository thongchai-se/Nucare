/** ข้อความอีเมลธุรกรรมที่ใช้ซ้ำ — ใส่ env แล้วส่งได้ทันทีผ่าน notifyUser */

export function buildHighRiskAdvisorEmail(input: {
  studentName: string;
  studentIdLabel: string | null;
  sourceLabel: string;
}): { subject: string; text: string; html: string } {
  const who = input.studentIdLabel
    ? `${input.studentName} (${input.studentIdLabel})`
    : input.studentName;
  const subject = `[NUCARE] ผลคัดกรองความเสี่ยงสูง — ${input.studentName}`;
  const text = [
    `เรียน อาจารย์ที่ปรึกษา`,
    ``,
    `ระบบตรวจพบผลคัดกรองความเสี่ยงสูงของนิสิต ${who}`,
    `แหล่งที่มา: ${input.sourceLabel}`,
    ``,
    `กรุณาเข้าสู่ระบบ NUCARE เพื่อติดตาม และส่งต่อไปศูนย์ให้คำปรึกษาเมื่อเห็นสมควร`,
    `ทีมผู้เชี่ยวชาญจะได้รับคิวหลังมีการส่งต่อจากท่าน หรือเมื่อนิสิตขอนัดผู้เชี่ยวชาญเอง`,
    ``,
    `— NUCARE`,
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">ผลคัดกรองความเสี่ยงสูง</h2>
      <p>ระบบตรวจพบผลคัดกรองความเสี่ยงสูงของนิสิต <strong>${escapeHtml(who)}</strong></p>
      <p>แหล่งที่มา: ${escapeHtml(input.sourceLabel)}</p>
      <p>กรุณาเข้าสู่ระบบ NUCARE เพื่อติดตาม และส่งต่อไปศูนย์ให้คำปรึกษาเมื่อเห็นสมควร</p>
      <p style="color:#64748b;font-size:13px;">ทีมผู้เชี่ยวชาญจะได้รับคิวหลังมีการส่งต่อจากท่าน หรือเมื่อนิสิตขอนัดผู้เชี่ยวชาญเอง</p>
    </div>
  `;
  return { subject, text, html };
}

export function buildHighRiskUnassignedEmail(input: {
  studentName: string;
  studentIdLabel: string | null;
  sourceLabel: string;
}): { subject: string; text: string; html: string } {
  const who = input.studentIdLabel
    ? `${input.studentName} (${input.studentIdLabel})`
    : input.studentName;
  const subject = `[NUCARE] นิสิตความเสี่ยงสูงยังไม่มีที่ปรึกษา — ${input.studentName}`;
  const text = [
    `เรียน ผู้เกี่ยวข้อง`,
    ``,
    `ระบบตรวจพบผลคัดกรองความเสี่ยงสูงของนิสิต ${who} แต่ยังไม่มีที่ปรึกษาประจำในระบบ`,
    `แหล่งที่มา: ${input.sourceLabel}`,
    ``,
    `กรุณาเข้าสู่ระบบเพื่อมอบหมายที่ปรึกษา และติดตามต่อ`,
    ``,
    `— NUCARE`,
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">นิสิตความเสี่ยงสูงยังไม่มีที่ปรึกษา</h2>
      <p>ระบบตรวจพบผลคัดกรองความเสี่ยงสูงของนิสิต <strong>${escapeHtml(who)}</strong> แต่ยังไม่มีที่ปรึกษาประจำ</p>
      <p>แหล่งที่มา: ${escapeHtml(input.sourceLabel)}</p>
      <p>กรุณามอบหมายที่ปรึกษาและติดตามต่อใน NUCARE</p>
    </div>
  `;
  return { subject, text, html };
}

export function buildStudentCounselingRequestEmail(input: {
  studentName: string;
  studentIdLabel: string | null;
  note: string | null;
}): { subject: string; text: string; html: string } {
  const who = input.studentIdLabel
    ? `${input.studentName} (${input.studentIdLabel})`
    : input.studentName;
  const subject = `[NUCARE] นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิต — ${input.studentName}`;
  const text = [
    `เรียน ทีมสุขภาพจิต`,
    ``,
    `นิสิต ${who} ขอนัดพบผู้เชี่ยวชาญสุขภาพจิตผ่านระบบ`,
    input.note ? `รายละเอียดจากนิสิต: ${input.note}` : null,
    ``,
    `กรุณาเข้าสู่ระบบ NUCARE เพื่อรับคิวและนัดหมาย`,
    ``,
    `— NUCARE`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิต</h2>
      <p>นิสิต <strong>${escapeHtml(who)}</strong> ส่งคำขอพบผู้เชี่ยวชาญผ่านระบบ</p>
      ${input.note ? `<p>รายละเอียด: ${escapeHtml(input.note)}</p>` : ""}
      <p>กรุณาเข้าสู่ระบบ NUCARE เพื่อรับคิวและนัดหมาย</p>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
