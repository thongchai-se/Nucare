export const MIN_STUDY_YEAR = 1;
export const MAX_STUDY_YEAR = 4;

export const STUDY_YEAR_RANGE_MESSAGE = `Study year must be between ${MIN_STUDY_YEAR} and ${MAX_STUDY_YEAR}`;

export const clampStudyYear = (value: number): number =>
  Math.min(Math.max(Math.trunc(value), MIN_STUDY_YEAR), MAX_STUDY_YEAR);

export const normalizeStudyYear = (raw: number): number => {
  const normalized = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(normalized) || normalized < MIN_STUDY_YEAR || normalized > MAX_STUDY_YEAR) {
    throw new Error(STUDY_YEAR_RANGE_MESSAGE);
  }

  return normalized;
};
