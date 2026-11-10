import { createKkuGenChatProvider, resolveKkuGenApiKey, resolveKkuGenBaseUrl } from "./kku-gen-provider";
import { resolveKkuChatModel } from "./kku-gen-models";
import { createMockChatProvider } from "./mock-provider";
import type { ChatProvider } from "./types";

/** กัน production ใช้ mock chat โดยไม่ตั้งใจ (ยกเว้น ALLOW_MOCK_CHAT=true) */
export function assertChatReadyForEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (`${process.env.ALLOW_MOCK_CHAT || ""}`.trim().toLowerCase() === "true") {
    return;
  }

  const providerName = (process.env.CHAT_PROVIDER || "mock").trim().toLowerCase();
  if (providerName !== "kku" && providerName !== "kku-gen") {
    throw new Error(
      "Production requires CHAT_PROVIDER=kku|kku-gen (or set ALLOW_MOCK_CHAT=true for a controlled exception)"
    );
  }
  if (!resolveKkuGenApiKey()) {
    throw new Error("Production chat requires AI_API_KEY/aiapikey when CHAT_PROVIDER=kku|kku-gen");
  }
}

/**
 * เลือก ChatProvider ตาม CHAT_PROVIDER
 * - mock = คำตอบจำลองในเครื่อง
 * - kku / kku-gen = KKU Gen AI (Gemini/GPT/Claude เท่านั้น)
 */
export const getStudentChatProvider = (): ChatProvider => {
  const providerName = (process.env.CHAT_PROVIDER || "mock").trim().toLowerCase();

  if (providerName === "kku" || providerName === "kku-gen") {
    const apiKey = resolveKkuGenApiKey();
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("CHAT_PROVIDER=kku but AI_API_KEY/aiapikey is missing");
      }
      console.warn("CHAT_PROVIDER=kku but AI_API_KEY/aiapikey is missing — falling back to mock");
      return createMockChatProvider();
    }

    return createKkuGenChatProvider({
      apiKey,
      baseUrl: resolveKkuGenBaseUrl(),
      model: resolveKkuChatModel(process.env.KKU_GEN_CHAT_MODEL),
    });
  }

  return createMockChatProvider();
};
