export const MIN_STUDY_YEAR = 1;
export const MAX_STUDY_YEAR = 4;

export const STUDY_YEAR_OPTIONS = [1, 2, 3, 4] as const;

export type StudyYearOption = (typeof STUDY_YEAR_OPTIONS)[number];

export const STUDY_YEAR_RANGE_MESSAGE = `ชั้นปีต้องเป็นตัวเลข ${MIN_STUDY_YEAR}-${MAX_STUDY_YEAR}`;

export const clampStudyYear = (value: number): number =>
  Math.min(Math.max(Math.trunc(value), MIN_STUDY_YEAR), MAX_STUDY_YEAR);

export const normalizeStudyYear = (raw: string | number): number => {
  const normalized = typeof raw === "number" ? raw : Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(normalized) || normalized < MIN_STUDY_YEAR || normalized > MAX_STUDY_YEAR) {
    throw new Error(STUDY_YEAR_RANGE_MESSAGE);
  }

  return normalized;
};
