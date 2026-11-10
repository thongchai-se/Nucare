const HOMEWORK_PATTERNS: RegExp[] = [
  /การบ้าน/,
  /ข้อสอบ/,
  /เฉลย/,
  /แบบฝึกหัด/,
  /รายงาน(?:วิจัย|วิชา|ส่ง)?/,
  /เขียน(?:โค้ด|code|โปรแกรม|รายงาน)/i,
  /ช่วย(?:ทำ|เขียน|ส่ง|แก้|ตรวจ).{0,24}(?:การบ้าน|รายงาน|โค้ด|โจทย์|โปรแกรม|บั๊ก|bug)/i,
  /แปล(?:ให้|ทั้งบท|ทั้งตอน|ภาษาอังกฤษ|อังกฤษ)/,
  /solve\s+(this|the)\s+(problem|homework|exam)/i,
  /write\s+(my|the)\s+(essay|code|report|homework)/i,
  /do\s+my\s+homework/i,
  /midterm|final\s*exam|assignment\b/i,
  /debug\s+(this|my|ให้)/i,
  /refactor\b/i,
  /จง(?:หา|เขียน|คำนวณ|แสดง|พิสูจน์)/,
  /เขียนโปรแกรม/,
  /ส่ง(?:โค้ด|code|โจทย์)/i,
];

const CRISIS_PATTERNS: RegExp[] = [
  /ฆ่าตัวตาย/,
  /อยากตาย/,
  /ทำร้ายตัวเอง/,
  /ไม่มีแรงจะมีชีวิตอยู่/,
  /\bsuicid/i,
  /self[-\s]?harm/i,
];

const CODE_LINE_PATTERNS: RegExp[] = [
  /^\s*(def|class|function|import|from|const|let|var|public|private|protected|package|using|#include|fn|func)\b/,
  /console\.log\s*\(|System\.out\.|printf\s*\(|println\s*\(/,
  /=>\s*\{/,
  /;\s*$/,
  /^\s*<\/?[a-zA-Z][^>]*>/,
  /^\s*#include\b/,
  /^\s*SELECT\s+.+\s+FROM\b/i,
];

export type ChatGuardrailResult =
  | { blocked: false; crisis: boolean }
  | { blocked: true; reason: "homework"; crisis: boolean };

/** ตรวจว่าข้อความคล้ายโค้ด/โจทย์ที่แปะมาให้ทำให้หรือไม่ */
export function looksLikeCodeOrHomeworkDump(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) {
    return false;
  }

  if (normalized.includes("```")) {
    return true;
  }

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 3) {
    const codeLikeCount = lines.filter((line) => CODE_LINE_PATTERNS.some((pattern) => pattern.test(line))).length;
    if (codeLikeCount >= 3) {
      return true;
    }
  }

  if (lines.length >= 6 && /จง(?:หา|เขียน|คำนวณ|แสดง)|Write a program|public static void|int main\s*\(/i.test(normalized)) {
    return true;
  }

  const semicolonCount = (normalized.match(/;/g) || []).length;
  const braceCount = (normalized.match(/[{}]/g) || []).length;
  if (normalized.length >= 180 && semicolonCount >= 4 && braceCount >= 2) {
    return true;
  }

  return false;
}

/** ตรวจคำตอบของบอทว่าเผลอเขียนเฉลย/โค้ดยาวหรือไม่ */
export function looksLikeCodeSolution(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) {
    return false;
  }
  if (normalized.includes("```")) {
    return true;
  }
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const codeLikeCount = lines.filter((line) => CODE_LINE_PATTERNS.some((pattern) => pattern.test(line))).length;
  return codeLikeCount >= 4 || (normalized.length >= 400 && codeLikeCount >= 2);
}

/** ตรวจข้อความว่าขอทำการบ้าน/วิชาการหรือมีสัญญาณวิกฤตหรือไม่ */
export const evaluateStudentChatGuardrails = (content: string): ChatGuardrailResult => {
  const normalized = content.trim();
  const crisis = CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
  const homework =
    HOMEWORK_PATTERNS.some((pattern) => pattern.test(normalized)) || looksLikeCodeOrHomeworkDump(normalized);

  if (homework) {
    return { blocked: true, reason: "homework", crisis };
  }

  return { blocked: false, crisis };
};
