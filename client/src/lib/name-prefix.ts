type PrefixRule = {
  canonical: string;
  pattern: RegExp;
};

const studentPrefixRules: PrefixRule[] = [
  { canonical: "นางสาว", pattern: /^\s*นางสาว\s*/u },
  { canonical: "นาย", pattern: /^\s*นาย\s*/u },
  { canonical: "นาง", pattern: /^\s*นาง\s*/u },
];

const staffPrefixRules: PrefixRule[] = [
  { canonical: "อ.ดร.", pattern: /^\s*อ\.\s*ดร\.\s*/u },
  { canonical: "อ.", pattern: /^\s*อ\.\s*/u },
  { canonical: "ผศ.ดร.", pattern: /^\s*ผศ\.\s*ดร\.\s*/u },
  { canonical: "ผศ.", pattern: /^\s*ผศ\.\s*/u },
  { canonical: "รศ.ดร.", pattern: /^\s*รศ\.\s*ดร\.\s*/u },
  { canonical: "รศ.", pattern: /^\s*รศ\.\s*/u },
  { canonical: "รส.ดร.", pattern: /^\s*รส\.\s*ดร\.\s*/u },
];

const allPrefixRules = [...staffPrefixRules, ...studentPrefixRules];

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const normalizeNameWithRules = (rawName: string, rules: PrefixRule[]): string => {
  const normalizedName = normalizeWhitespace(rawName);
  if (!normalizedName) {
    return "";
  }

  for (const rule of rules) {
    if (!rule.pattern.test(normalizedName)) {
      continue;
    }

    const nameWithoutPrefix = normalizeWhitespace(normalizedName.replace(rule.pattern, ""));
    return nameWithoutPrefix ? `${rule.canonical} ${nameWithoutPrefix}` : rule.canonical;
  }

  return normalizedName;
};

export const normalizeImportedStudentName = (rawName: string): string =>
  normalizeNameWithRules(rawName, studentPrefixRules);

export const normalizeImportedStaffName = (rawName: string): string =>
  normalizeNameWithRules(rawName, staffPrefixRules);

export const stripKnownNamePrefix = (rawName: string): string =>
  normalizeNameWithRules(rawName, allPrefixRules).replace(
    /^(นางสาว|นาย|นาง|อ\.ดร\.|อ\.|ผศ\.ดร\.|ผศ\.|รศ\.ดร\.|รศ\.|รส\.ดร\.)\s*/u,
    ""
  );

export const getNameInitials = (rawName: string, fallback = "NU"): string => {
  const normalizedName = normalizeWhitespace(stripKnownNamePrefix(rawName));
  const parts = normalizedName
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zก-๙]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
};
