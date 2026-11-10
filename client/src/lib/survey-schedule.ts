export type SurveyScheduleFrequency = "ONE_SHOT" | "WEEKLY" | "ACADEMIC_TERM" | "CUSTOM_INTERVAL";
export type SurveyScheduleUnit = "DAYS" | "WEEKS" | "MONTHS";

export type SurveyWaveDraft = {
  label: string;
  opensAt: Date;
  closesAt: Date | null;
  termKey: string | null;
  weekStart: Date | null;
};

/** แปลงช่วงกำหนดเองเป็นจำนวนวัน (เดือน ≈ 30 วัน) */
export function scheduleIntervalToDays(
  every: number | null | undefined,
  unit: SurveyScheduleUnit | null | undefined
): number | null {
  if (!every || every < 1 || !unit) {
    return null;
  }
  if (unit === "DAYS") {
    return every;
  }
  if (unit === "WEEKS") {
    return every * 7;
  }
  return every * 30;
}

export function resolveScheduleIntervalDays(input: {
  frequency: SurveyScheduleFrequency;
  scheduleEvery: number | null;
  scheduleUnit: SurveyScheduleUnit | null;
}): number | null {
  if (input.frequency === "ONE_SHOT" || input.frequency === "ACADEMIC_TERM") {
    return null;
  }
  if (input.frequency === "WEEKLY") {
    return 7;
  }
  return scheduleIntervalToDays(input.scheduleEvery, input.scheduleUnit);
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatThaiDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

/** แปลง Date เป็นค่า datetime-local ตามเวลาท้องถิ่น */
export function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** สร้างร่างคลื่นรอบถัดไปให้แอดมินตรวจก่อนเปิดจริง */
export function buildNextWaveDraft(input: {
  frequency: SurveyScheduleFrequency;
  scheduleEvery: number | null;
  scheduleUnit: SurveyScheduleUnit | null;
  now?: Date;
  lastOpensAt?: Date | null;
  termKey?: string | null;
  openDurationDays?: number | null;
}): SurveyWaveDraft {
  const now = input.now ?? new Date();
  const intervalDays = resolveScheduleIntervalDays({
    frequency: input.frequency,
    scheduleEvery: input.scheduleEvery,
    scheduleUnit: input.scheduleUnit,
  });

  let opensAt = now;
  if (input.lastOpensAt && intervalDays && intervalDays > 0) {
    const candidate = addDays(input.lastOpensAt, intervalDays);
    opensAt = candidate.getTime() > now.getTime() ? candidate : now;
  }

  const openDurationDays =
    input.openDurationDays && input.openDurationDays > 0
      ? input.openDurationDays
      : input.frequency === "ONE_SHOT"
        ? null
        : intervalDays && intervalDays > 0
          ? Math.max(1, intervalDays - 1)
          : input.frequency === "ACADEMIC_TERM"
            ? 90
            : 7;

  const closesAt = openDurationDays ? addDays(opensAt, openDurationDays) : null;
  const termKey =
    input.frequency === "ACADEMIC_TERM"
      ? (input.termKey?.trim() || `เทอม-${opensAt.getFullYear() + 543}`)
      : input.termKey?.trim() || null;

  let label = `รอบ ${formatThaiDateLabel(opensAt)}`;
  if (input.frequency === "WEEKLY") {
    label = `สัปดาห์ ${formatThaiDateLabel(startOfLocalDay(opensAt))}`;
  } else if (input.frequency === "ACADEMIC_TERM") {
    label = termKey || label;
  } else if (input.frequency === "CUSTOM_INTERVAL" && input.scheduleEvery && input.scheduleUnit) {
    const unitLabel =
      input.scheduleUnit === "DAYS" ? "วัน" : input.scheduleUnit === "WEEKS" ? "สัปดาห์" : "เดือน";
    label = `ทุก ${input.scheduleEvery} ${unitLabel} · ${formatThaiDateLabel(opensAt)}`;
  }

  return {
    label,
    opensAt,
    closesAt,
    termKey,
    weekStart: input.frequency === "WEEKLY" ? startOfLocalDay(opensAt) : null,
  };
}
