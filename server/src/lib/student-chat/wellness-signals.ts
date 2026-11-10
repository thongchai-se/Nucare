/**
 * Wellness Trend Indicators — สัญญาณแนวโน้มสุขภาวะจากแชท
 * เก็บเฉพาะรหัสหัวข้อ + จำนวนครั้ง ไม่เก็บเนื้อหาข้อความ
 */

export const WELLNESS_TREND_SIGNAL_CODES = [
  "DEPRESSIVE_THEME",
  "ANXIETY_THEME",
  "ACADEMIC_STRESS",
  "SLEEP_DISTURBANCE",
  "LONELINESS_ISOLATION",
  "RELATIONSHIP_STRESS",
  "BURNOUT_FATIGUE",
  "SELF_HARM_CRISIS",
] as const;

export type WellnessTrendSignalCode = (typeof WELLNESS_TREND_SIGNAL_CODES)[number];

export type WellnessTrendSignalMeta = {
  code: WellnessTrendSignalCode;
  /** ชื่อทางการภาษาไทย */
  labelTh: string;
  /** ชื่อสั้นสำหรับสรุปแนวโน้ม */
  shortLabelTh: string;
};

export const WELLNESS_TREND_SIGNAL_META: Record<WellnessTrendSignalCode, WellnessTrendSignalMeta> = {
  DEPRESSIVE_THEME: {
    code: "DEPRESSIVE_THEME",
    labelTh: "ประเด็นอารมณ์ซึมเศร้า",
    shortLabelTh: "ซึมเศร้า",
  },
  ANXIETY_THEME: {
    code: "ANXIETY_THEME",
    labelTh: "ประเด็นความวิตกกังวล",
    shortLabelTh: "วิตกกังวล",
  },
  ACADEMIC_STRESS: {
    code: "ACADEMIC_STRESS",
    labelTh: "ความเครียดด้านการเรียน",
    shortLabelTh: "เครียดเรียน",
  },
  SLEEP_DISTURBANCE: {
    code: "SLEEP_DISTURBANCE",
    labelTh: "สัญญาณรบกวนการนอน",
    shortLabelTh: "นอนไม่ดี",
  },
  LONELINESS_ISOLATION: {
    code: "LONELINESS_ISOLATION",
    labelTh: "ความรู้สึกเหงาหรือโดดเดี่ยว",
    shortLabelTh: "เหงา",
  },
  RELATIONSHIP_STRESS: {
    code: "RELATIONSHIP_STRESS",
    labelTh: "ความเครียดด้านความสัมพันธ์",
    shortLabelTh: "ความสัมพันธ์",
  },
  BURNOUT_FATIGUE: {
    code: "BURNOUT_FATIGUE",
    labelTh: "อาการอ่อนล้าหรือหมดไฟ",
    shortLabelTh: "หมดไฟ",
  },
  SELF_HARM_CRISIS: {
    code: "SELF_HARM_CRISIS",
    labelTh: "สัญญาณวิกฤตทำร้ายตนเอง",
    shortLabelTh: "วิกฤต",
  },
};

type SignalPattern = {
  code: WellnessTrendSignalCode;
  patterns: RegExp[];
};

const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    code: "SELF_HARM_CRISIS",
    patterns: [
      /ฆ่าตัวตาย/,
      /อยากตาย/,
      /ทำร้ายตัวเอง/,
      /ไม่มีแรงจะมีชีวิตอยู่/,
      /จบชีวิต/,
      /\bsuicid/i,
      /self[-\s]?harm/i,
    ],
  },
  {
    code: "DEPRESSIVE_THEME",
    patterns: [
      /ซึมเศร้า/,
      /เศร้ามาก/,
      /หดหู่/,
      /ท้อ(?:แท้|มาก)?/,
      /สิ้นหวัง/,
      /ไม่มีความหมาย/,
      /ไม่อยากทำอะไร/,
      /ร้องไห้/,
      /\bdepress/i,
    ],
  },
  {
    code: "ANXIETY_THEME",
    patterns: [/วิตก/, /กังวล/, /ตื่นตระหนก/, /ใจสั่น/, /panic/, /\banxiety\b/i, /กลัว(?:มาก|สุด)?/],
  },
  {
    code: "ACADEMIC_STRESS",
    patterns: [
      /เครียด(?:เรื่อง)?(?:เรียน|สอบ|การบ้าน|รายงาน)/,
      /สอบ(?:ไม่ผ่าน|ตก|ใกล้)/,
      /เกรด(?:ตก|ไม่ดี)/,
      /เรียน(?:ไม่ทัน|ไม่ไหว|หนัก)/,
      /midterm|final\s*exam/i,
    ],
  },
  {
    code: "SLEEP_DISTURBANCE",
    patterns: [/นอนไม่หลับ/, /นอนน้อย/, /หลับยาก/, /ตื่นกลางดึก/, /ฝันร้าย/, /อินซอมเนีย/, /insomnia/i],
  },
  {
    code: "LONELINESS_ISOLATION",
    patterns: [/เหงา/, /โดดเดี่ยว/, /ไม่มีเพื่อน/, /ไม่มีใคร(?:เข้าใจ|คุย)/, /รู้สึกคนเดียว/, /lonely/i],
  },
  {
    code: "RELATIONSHIP_STRESS",
    patterns: [
      /ทะเลาะ/,
      /อกหัก/,
      /แฟน(?:ทิ้ง|นอกใจ)/,
      /ครอบครัว(?:ดุ|กดดัน|ไม่เข้าใจ)/,
      /ถูก(?:เพื่อน)?(?:กลั่นแกล้ง|แกล้ง)/,
      /broken\s*heart/i,
    ],
  },
  {
    code: "BURNOUT_FATIGUE",
    patterns: [/หมดไฟ/, /เบิร์นเอาท์/, /burn\s*out/i, /เหนื่อย(?:มาก|สุด|ล้า)?/, /อ่อนล้า/, /ไม่ไหวแล้ว/],
  },
];

/** สกัดรหัสสัญญาณแนวโน้มจากข้อความผู้ใช้ โดยไม่เก็บข้อความไว้ */
export const detectWellnessTrendSignals = (content: string): WellnessTrendSignalCode[] => {
  const normalized = content.trim();
  if (!normalized) {
    return [];
  }

  const matched = new Set<WellnessTrendSignalCode>();
  for (const entry of SIGNAL_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      matched.add(entry.code);
    }
  }

  return WELLNESS_TREND_SIGNAL_CODES.filter((code) => matched.has(code));
};
