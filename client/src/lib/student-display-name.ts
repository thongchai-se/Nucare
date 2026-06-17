const exactNamePrefixes = new Set([
  "นาย",
  "นาง",
  "นางสาว",
  "ด.ช.",
  "ด.ญ.",
  "เด็กชาย",
  "เด็กหญิง",
  "น.ส.",
  "นส.",
  "คุณ",
  "mr.",
  "mrs.",
  "ms.",
  "miss",
]);

const compactNamePrefixes = [
  "นางสาว",
  "เด็กชาย",
  "เด็กหญิง",
  "น.ส.",
  "นส.",
  "ด.ช.",
  "ด.ญ.",
  "นาย",
  "นาง",
  "คุณ",
];

const normalizePrefix = (value: string): string => value.trim().toLowerCase();

export const getStudentPreferredFirstName = (
  fullName: string | null | undefined,
  fallback = "นักศึกษา",
): string => {
  const nameParts = fullName?.trim().split(/\s+/).filter(Boolean) || [];

  while (nameParts.length > 0 && exactNamePrefixes.has(normalizePrefix(nameParts[0]))) {
    nameParts.shift();
  }

  if (nameParts.length === 0) {
    return fallback;
  }

  const firstPart = nameParts[0];
  const compactPrefix = compactNamePrefixes.find(
    (prefix) => firstPart !== prefix && firstPart.startsWith(prefix),
  );

  if (compactPrefix) {
    const firstName = firstPart.slice(compactPrefix.length).trim();
    if (firstName) {
      return firstName;
    }
  }

  return firstPart || fallback;
};
