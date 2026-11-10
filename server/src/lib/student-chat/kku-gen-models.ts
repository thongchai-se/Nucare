/**
 * โมเดลที่อนุญาตบน KKU Gen AI สำหรับแชทเพื่อนนิสิต
 * จำกัดเฉพาะ Gemini / GPT / Claude — เลี่ยงโมเดลที่มักหลุดภาษาจีน
 */
export const KKU_SAFE_CHAT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-4-argon",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "claude-sonnet-5",
  "claude-sonnet-5.5",
] as const;

export type KkuSafeChatModelId = (typeof KKU_SAFE_CHAT_MODELS)[number];

export const DEFAULT_KKU_CHAT_MODEL: KkuSafeChatModelId = "gemini-3.8-flash";

export const DEFAULT_KKU_GEN_BASE_URL = "https://gen.ai.kku.ac.th/api/v1";

/** ตรวจว่า model อยู่ในรายการที่อนุญาตหรือไม่ */
export function isKkuSafeChatModel(modelId: string): modelId is KkuSafeChatModelId {
  return (KKU_SAFE_CHAT_MODELS as readonly string[]).includes(modelId);
}

/** เลือกโมเดลจาก env — ถ้าไม่ใช่รายการที่อนุญาตให้ถอยไปค่าเริ่มต้น */
export function resolveKkuChatModel(raw: string | undefined): KkuSafeChatModelId {
  const trimmed = (raw || "").trim();
  if (trimmed && isKkuSafeChatModel(trimmed)) {
    return trimmed;
  }
  return DEFAULT_KKU_CHAT_MODEL;
}
