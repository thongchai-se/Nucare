import {
  evaluateStudentChatGuardrails,
  looksLikeCodeSolution,
} from "./guardrails";
import {
  DEFAULT_KKU_GEN_BASE_URL,
  resolveKkuChatModel,
  type KkuSafeChatModelId,
} from "./kku-gen-models";
import { getStudentChatPersona } from "./personas";
import type { ChatProvider, StudentChatMessage, StudentChatReply, StudentChatReplyInput } from "./types";

export type KkuGenProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  model?: KkuSafeChatModelId;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

/** อ่าน API key จาก env — รองรับ AI_API_KEY และ aiapikey */
export function resolveKkuGenApiKey(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const key = (env.AI_API_KEY || env.aiapikey || env.AIAPIKEY || "").trim();
  return key.length > 0 ? key : null;
}

/** อ่าน base URL จาก env */
export function resolveKkuGenBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.KKU_GEN_BASE_URL || "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_KKU_GEN_BASE_URL;
}

function extractAssistantText(payload: OpenAiChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  return "";
}

/** history สั้น + memory สรุป — ลด token ต่อคำขอเมื่อมีนิสิตจำนวนมาก */
function buildMessages(
  systemPrompt: string,
  history: StudentChatMessage[],
  content: string,
  memorySummary?: string | null
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const languageLock =
    "สำคัญ: ตอบเป็นภาษาไทยเท่านั้น สั้นเหมือนแชทเพื่อน ห้ามใช้ภาษาจีน และห้ามเขียนโค้ดหรือเฉลยโจทย์";

  const memoryBlock = memorySummary?.trim() || "";
  const systemContent = [systemPrompt, languageLock, memoryBlock].filter(Boolean).join("\n\n");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemContent },
  ];

  for (const item of history.slice(-12)) {
    if (item.role !== "user" && item.role !== "assistant") {
      continue;
    }
    const text = item.content.trim();
    if (!text) {
      continue;
    }
    messages.push({ role: item.role, content: text });
  }

  const latest = content.trim();
  const last = messages[messages.length - 1];
  if (!(last?.role === "user" && last.content === latest)) {
    messages.push({ role: "user", content: latest });
  }

  return messages;
}

/** สร้าง ChatProvider ที่เรียก KKU Gen AI (OpenAI-compatible chat completions) */
export const createKkuGenChatProvider = (options: KkuGenProviderOptions): ChatProvider => {
  const apiKey = options.apiKey.trim();
  const baseUrl = (options.baseUrl || DEFAULT_KKU_GEN_BASE_URL).replace(/\/+$/, "");
  const model = resolveKkuChatModel(options.model);
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? 45_000;

  return {
    async reply(input: StudentChatReplyInput): Promise<StudentChatReply> {
      const persona = getStudentChatPersona(input.personaId);
      if (!persona) {
        return {
          content: "ขอโทษนะ เลือกเพื่อนคุยไม่ถูกต้อง ลองเลือกใหม่ได้ไหม",
          blockedReason: null,
          crisisSuggested: false,
        };
      }

      const guard = evaluateStudentChatGuardrails(input.content);
      if (guard.blocked) {
        return {
          content: guard.crisis
            ? `${persona.homeworkRefusal}\n\n${persona.crisisNudge}`
            : persona.homeworkRefusal,
          blockedReason: "homework",
          crisisSuggested: guard.crisis,
        };
      }

      if (!apiKey) {
        return {
          content: "ระบบแชทยังตั้งค่าไม่ครบ ลองใหม่ภายหลังนะ",
          blockedReason: null,
          crisisSuggested: false,
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.85,
            max_tokens: 320,
            messages: buildMessages(
              persona.systemPrompt,
              input.history,
              input.content,
              input.memorySummary
            ),
          }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as OpenAiChatCompletionResponse;
        if (!response.ok) {
          console.error("KKU Gen chat error:", response.status, payload.error?.message || payload);
          return {
            content: "ตอนนี้คุยไม่สะดวกชั่วคราว ลองส่งใหม่ในอีกสักครู่นะ",
            blockedReason: null,
            crisisSuggested: guard.crisis,
          };
        }

        let text = extractAssistantText(payload);
        if (!text) {
          return {
            content: "ขออภัยนะ ตอบไม่ทัน ลองพิมพ์อีกครั้งได้ไหม",
            blockedReason: null,
            crisisSuggested: guard.crisis,
          };
        }

        if (looksLikeCodeSolution(text)) {
          text = persona.homeworkRefusal;
        }

        if (guard.crisis) {
          return {
            content: `${text}\n\n${persona.crisisNudge}`,
            blockedReason: null,
            crisisSuggested: true,
          };
        }

        return {
          content: text,
          blockedReason: null,
          crisisSuggested: false,
        };
      } catch (error) {
        console.error("KKU Gen chat request failed:", error);
        return {
          content: "เชื่อมต่อเพื่อน AI ไม่สำเร็จ ลองใหม่อีกครั้งนะ",
          blockedReason: null,
          crisisSuggested: guard.crisis,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
};
