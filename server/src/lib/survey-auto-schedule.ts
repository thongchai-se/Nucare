import {
  SurveyAudienceType,
  SurveyFrequency,
  SurveyStatus,
  SurveyWaveStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import { toEligibilityRuleInput, syncWaveAssignments } from "./survey-eligibility-service";
import {
  buildNextWaveDraft,
  resolveScheduleIntervalDays,
  type SurveyScheduleConfig,
  type SurveyWaveDraft,
} from "./survey-schedule";
import { ensureVersionForWave } from "./survey-versioning";
import { closeExpiredOpenWaves, syncSurveyActiveFromWaves } from "./survey-wave-lifecycle";

/** จำนวนรอบสูงสุดที่ไล่ตามทันต่อหนึ่งแบบประเมินใน 1 tick — กันลูปยาวถ้าเซิร์ฟเวอร์หยุดไปนาน */
const MAX_CATCH_UP_STEPS = 5000;

export type AutoScheduleSkipReason =
  | "one_shot"
  | "no_interval"
  | "no_anchor"
  | "pending_scheduled_wave"
  | "duplicate_wave"
  | "window_passed"
  | "too_far_behind";

export type AutoWavePlan =
  | { action: "skip"; reason: AutoScheduleSkipReason }
  | { action: "create"; draft: SurveyWaveDraft; status: "OPEN" | "SCHEDULED" };

export type AutoSchedulePlanInput = {
  surveyId: string;
  config: SurveyScheduleConfig;
  now: Date;
  /** วันเปิดของคลื่นล่าสุด (ทุกสถานะ) หรือ null ถ้ายังไม่เคยมีคลื่น */
  lastOpensAt: Date | null;
  /** วันเริ่มของแบบประเมิน ใช้เป็นจุดตั้งต้นเมื่อยังไม่มีคลื่น */
  surveyStartsAt: Date | null;
  /** มีคลื่น SCHEDULED ที่ยังไม่ถึงเวลาเปิดอยู่แล้วหรือไม่ — ไม่สร้างล่วงหน้าซ้อน */
  hasPendingFutureWave: boolean;
  /** คีย์ idempotency ของคลื่นที่มีอยู่แล้ว (ทุกสถานะ รวม CANCELLED) */
  existingKeys: ReadonlySet<string>;
  termKey?: string | null;
};

/** สร้างข้อความ ISO ของวันที่ หรือ "-" ถ้าไม่มี (ใช้ประกอบคีย์) */
function isoOrDash(date: Date | null | undefined): string {
  return date ? date.toISOString() : "-";
}

/**
 * สร้างคีย์ idempotency ของคลื่น: ถ้ามี termKey ใช้ (surveyId+term), ถ้ามี weekStart ใช้ (surveyId+วันเริ่มสัปดาห์),
 * ไม่เช่นนั้นใช้ (surveyId+opensAt) เพื่อให้เรียกซ้ำกี่ครั้งก็ได้ผลเดิม
 */
export function buildWaveIdempotencyKey(input: {
  surveyId: string;
  opensAt: Date;
  termKey?: string | null;
  weekStart?: Date | null;
}): string {
  const term = input.termKey?.trim();
  if (term) {
    return `${input.surveyId}|term|${term}`;
  }
  if (input.weekStart) {
    return `${input.surveyId}|week|${isoOrDash(input.weekStart)}`;
  }
  return `${input.surveyId}|opens|${isoOrDash(input.opensAt)}`;
}

/**
 * คืนคีย์ทั้งหมดที่ถือว่า "ซ้ำ" กับร่างคลื่นนี้ (คีย์หลัก + คีย์ opensAt) เพื่อกันซ้ำทั้งแบบรายเทอม/รายสัปดาห์
 * และคลื่นที่แอดมินสร้างเองด้วยเวลาเปิดเดียวกัน
 */
export function buildWaveDuplicateKeys(input: {
  surveyId: string;
  opensAt: Date;
  termKey?: string | null;
  weekStart?: Date | null;
}): string[] {
  const primary = buildWaveIdempotencyKey(input);
  const byOpensAt = buildWaveIdempotencyKey({ surveyId: input.surveyId, opensAt: input.opensAt });
  return primary === byOpensAt ? [primary] : [primary, byOpensAt];
}

/** แปลงเลขวันของ weekStart/opensAt ที่มีในฐานข้อมูลเป็นชุดคีย์ idempotency (ทุกคีย์ที่เกี่ยวข้อง) */
export function collectExistingWaveKeys(
  waves: ReadonlyArray<{
    surveyId: string;
    opensAt: Date;
    termKey: string | null;
    weekStart: Date | null;
  }>
): Set<string> {
  const keys = new Set<string>();
  for (const wave of waves) {
    for (const key of buildWaveDuplicateKeys(wave)) {
      keys.add(key);
    }
  }
  return keys;
}

/** แบบประเมินนี้ตั้งความถี่ที่สร้างรอบอัตโนมัติได้หรือไม่ (ต้องไม่ใช่ ONE_SHOT และคำนวณช่วงวันได้) */
export function isAutoSchedulable(config: SurveyScheduleConfig): boolean {
  if (config.frequency === SurveyFrequency.ONE_SHOT) {
    return false;
  }
  const days = resolveScheduleIntervalDays(config);
  return days !== null && days > 0;
}

/**
 * ตัดสินว่าควรสร้างคลื่นถัดไปหรือไม่ — คำนวณจุดเปิดแบบ deterministic จากคลื่นล่าสุด (ไม่ขึ้นกับเวลา tick)
 * ถ้าตามไม่ทันหลายรอบจะข้ามไปรอบล่าสุดที่ถึงเวลา และไม่สร้างถ้าซ้ำ/พ้นช่วงเปิดแล้ว; O(k) k = จำนวนรอบที่ตามทัน
 */
export function planNextAutoWave(input: AutoSchedulePlanInput): AutoWavePlan {
  const { config, now } = input;
  if (config.frequency === SurveyFrequency.ONE_SHOT) {
    return { action: "skip", reason: "one_shot" };
  }
  if (!isAutoSchedulable(config)) {
    return { action: "skip", reason: "no_interval" };
  }
  if (input.hasPendingFutureWave) {
    return { action: "skip", reason: "pending_scheduled_wave" };
  }

  const draftFrom = (cursor: Date): SurveyWaveDraft =>
    // now = cursor ทำให้ buildNextWaveDraft คืน cursor + ช่วง (ไม่ถูกดึงมาที่เวลาปัจจุบัน)
    buildNextWaveDraft({
      frequency: config.frequency,
      scheduleEvery: config.scheduleEvery,
      scheduleUnit: config.scheduleUnit,
      now: cursor,
      lastOpensAt: cursor,
      termKey: input.termKey ?? null,
    });

  let draft: SurveyWaveDraft;
  if (input.lastOpensAt) {
    draft = draftFrom(input.lastOpensAt);
  } else if (input.surveyStartsAt) {
    draft = buildNextWaveDraft({
      frequency: config.frequency,
      scheduleEvery: config.scheduleEvery,
      scheduleUnit: config.scheduleUnit,
      now: input.surveyStartsAt,
      lastOpensAt: null,
      termKey: input.termKey ?? null,
    });
  } else {
    return { action: "skip", reason: "no_anchor" };
  }

  // ไล่ไปรอบล่าสุดที่เปิดได้แล้ว (opensAt <= now) แทนการย้อนสร้างทุกรอบที่พลาด
  let steps = 0;
  while (draft.opensAt.getTime() <= now.getTime()) {
    const next = draftFrom(draft.opensAt);
    if (next.opensAt.getTime() > now.getTime()) {
      break;
    }
    draft = next;
    steps += 1;
    if (steps > MAX_CATCH_UP_STEPS) {
      return { action: "skip", reason: "too_far_behind" };
    }
  }

  const keys = buildWaveDuplicateKeys({
    surveyId: input.surveyId,
    opensAt: draft.opensAt,
    termKey: draft.termKey,
    weekStart: draft.weekStart,
  });
  if (keys.some((key) => input.existingKeys.has(key))) {
    return { action: "skip", reason: "duplicate_wave" };
  }

  const isDue = draft.opensAt.getTime() <= now.getTime();
  if (isDue && draft.closesAt && draft.closesAt.getTime() <= now.getTime()) {
    return { action: "skip", reason: "window_passed" };
  }

  return { action: "create", draft, status: isDue ? "OPEN" : "SCHEDULED" };
}

export type AutoScheduleTickResult = {
  closed: number;
  created: number;
  opened: number;
  skipped: number;
};

/**
 * รัน 1 tick ของงานสร้างรอบแบบประเมินอัตโนมัติ: ปิดคลื่นที่หมดเวลา, เปิดคลื่น SCHEDULED ที่ถึงเวลา,
 * แล้วสร้างคลื่นถัดไปของแบบ PUBLISHED ที่ตั้งความถี่ไว้ (ผูกเวอร์ชัน + สร้าง assignment เมื่อเปิด) เรียกซ้ำได้โดยไม่สร้างซ้ำ
 */
export async function materializeDueWaves(now: Date = new Date()): Promise<AutoScheduleTickResult> {
  const result: AutoScheduleTickResult = { closed: 0, created: 0, opened: 0, skipped: 0 };
  result.closed = await closeExpiredOpenWaves(now);

  const surveys = await prisma.survey.findMany({
    where: {
      status: SurveyStatus.PUBLISHED,
      frequency: { not: SurveyFrequency.ONE_SHOT },
    },
    include: { eligibilityRule: true },
  });
  const candidates = surveys.filter((survey) =>
    isAutoSchedulable({
      frequency: survey.frequency,
      scheduleEvery: survey.scheduleEvery,
      scheduleUnit: survey.scheduleUnit,
    })
  );
  if (candidates.length === 0) {
    return result;
  }

  const surveyIds = candidates.map((survey) => survey.id);

  // อ่านรวมครั้งเดียว: วันเปิดล่าสุดต่อแบบ + คลื่น SCHEDULED ที่รอเปิด (ไม่ query ต่อแบบ)
  const [latestRows, scheduledWaves] = await Promise.all([
    prisma.surveyWave.groupBy({
      by: ["surveyId"],
      where: { surveyId: { in: surveyIds } },
      _max: { opensAt: true },
    }),
    prisma.surveyWave.findMany({
      where: { surveyId: { in: surveyIds }, status: SurveyWaveStatus.SCHEDULED },
      select: {
        id: true,
        surveyId: true,
        opensAt: true,
        closesAt: true,
        termKey: true,
        weekStart: true,
      },
    }),
  ]);
  const latestBySurvey = new Map(latestRows.map((row) => [row.surveyId, row._max.opensAt]));
  const scheduledBySurvey = new Map<string, typeof scheduledWaves>();
  for (const wave of scheduledWaves) {
    const list = scheduledBySurvey.get(wave.surveyId) ?? [];
    list.push(wave);
    scheduledBySurvey.set(wave.surveyId, list);
  }

  for (const survey of candidates) {
    try {
      const pending = scheduledBySurvey.get(survey.id) ?? [];

      // 1) เปิดคลื่น SCHEDULED ที่ถึงเวลาแล้ว (และยังไม่เลยกำหนดปิด) — เลือกรอบล่าสุดเพียงรอบเดียว
      const due = pending
        .filter(
          (wave) =>
            wave.opensAt.getTime() <= now.getTime() &&
            (!wave.closesAt || wave.closesAt.getTime() > now.getTime())
        )
        .sort((a, b) => b.opensAt.getTime() - a.opensAt.getTime())[0];
      if (due) {
        const opened = await openScheduledWave(survey, due.id, now);
        if (opened) {
          result.opened += 1;
        }
      }

      // 2) สร้างคลื่นถัดไปตามความถี่ (idempotent)
      const futurePending = pending.some((wave) => wave.opensAt.getTime() > now.getTime());
      const lastOpensAt = latestBySurvey.get(survey.id) ?? null;
      const plan = planNextAutoWave({
        surveyId: survey.id,
        config: {
          frequency: survey.frequency,
          scheduleEvery: survey.scheduleEvery,
          scheduleUnit: survey.scheduleUnit,
        },
        now,
        lastOpensAt,
        surveyStartsAt: survey.startsAt,
        hasPendingFutureWave: futurePending,
        // ตรวจเบื้องต้นจากคลื่น SCHEDULED ที่โหลดมาแล้ว; การตรวจซ้ำที่แน่นอนอยู่ในธุรกรรมตอนสร้าง
        existingKeys: collectExistingWaveKeys(pending.map((wave) => ({ ...wave }))),
      });

      if (plan.action === "skip") {
        result.skipped += 1;
        continue;
      }

      const created = await createWaveIfAbsent(survey, plan, now);
      if (created === "created") {
        result.created += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      console.error(`[survey-auto-schedule] survey ${survey.id} failed:`, error);
    }
  }

  return result;
}

type SurveyForSchedule = {
  id: string;
  audienceType: SurveyAudienceType;
  eligibilityRule: Parameters<typeof toEligibilityRuleInput>[0];
};

/** เปิดคลื่น SCHEDULED: ปิดคลื่น OPEN อื่น ผูกเวอร์ชันล่าสุด สร้าง assignment และซิงก์สถานะแบบ ใน transaction เดียว */
async function openScheduledWave(
  survey: SurveyForSchedule,
  waveId: string,
  now: Date
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const wave = await tx.surveyWave.findUnique({ where: { id: waveId } });
    if (!wave || wave.status !== SurveyWaveStatus.SCHEDULED) {
      return false;
    }

    await tx.surveyWave.updateMany({
      where: { surveyId: wave.surveyId, status: SurveyWaveStatus.OPEN, id: { not: wave.id } },
      data: { status: SurveyWaveStatus.CLOSED, closesAt: now },
    });
    const version = await ensureVersionForWave(wave.surveyId, null, tx);
    await tx.surveyWave.update({
      where: { id: wave.id },
      data: { status: SurveyWaveStatus.OPEN, versionId: version.id },
    });
    await syncWaveAssignments({
      waveId: wave.id,
      audienceType: survey.audienceType,
      rule: toEligibilityRuleInput(survey.eligibilityRule),
      db: tx,
    });
    await syncSurveyActiveFromWaves(tx, wave.surveyId);
    return true;
  });
}

/**
 * สร้างคลื่นตามแผนใน transaction โดยล็อกต่อแบบประเมิน (advisory lock) แล้วตรวจคีย์ซ้ำอีกครั้ง
 * คืน "created" เมื่อสร้างจริง, "duplicate" เมื่อมีอยู่แล้วหรือถูก tick อื่นถือล็อกอยู่
 */
async function createWaveIfAbsent(
  survey: SurveyForSchedule,
  plan: Extract<AutoWavePlan, { action: "create" }>,
  now: Date
): Promise<"created" | "duplicate"> {
  const { draft } = plan;

  return prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${survey.id})) AS locked
    `;
    if (!lock[0]?.locked) {
      return "duplicate";
    }

    // ตรวจซ้ำด้วย opensAt / termKey / weekStart ของแบบเดียวกัน (ทุกสถานะ)
    const duplicate = await tx.surveyWave.findFirst({
      where: {
        surveyId: survey.id,
        OR: [
          { opensAt: draft.opensAt },
          ...(draft.termKey ? [{ termKey: draft.termKey }] : []),
          ...(draft.weekStart ? [{ weekStart: draft.weekStart }] : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      return "duplicate";
    }

    const isOpen = plan.status === "OPEN";
    if (isOpen) {
      await tx.surveyWave.updateMany({
        where: { surveyId: survey.id, status: SurveyWaveStatus.OPEN },
        data: { status: SurveyWaveStatus.CLOSED, closesAt: now },
      });
    }

    const version = await ensureVersionForWave(survey.id, null, tx);
    const created = await tx.surveyWave.create({
      data: {
        surveyId: survey.id,
        versionId: version.id,
        label: draft.label,
        termKey: draft.termKey,
        weekStart: draft.weekStart,
        opensAt: draft.opensAt,
        closesAt: draft.closesAt,
        status: isOpen ? SurveyWaveStatus.OPEN : SurveyWaveStatus.SCHEDULED,
      },
    });

    if (isOpen) {
      await syncWaveAssignments({
        waveId: created.id,
        audienceType: survey.audienceType,
        rule: toEligibilityRuleInput(survey.eligibilityRule),
        db: tx,
      });
      await syncSurveyActiveFromWaves(tx, survey.id);
    }
    return "created";
  });
}
