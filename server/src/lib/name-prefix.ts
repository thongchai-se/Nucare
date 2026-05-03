import { Role } from "@prisma/client";

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

const getPrefixRulesForRole = (role: Role): PrefixRule[] =>
  role === Role.STUDENT ? studentPrefixRules : staffPrefixRules;

export const normalizePersonNameForRole = (rawName: string, role: Role): string => {
  const normalizedName = normalizeWhitespace(rawName);
  if (!normalizedName) {
    return "";
  }

  for (const rule of getPrefixRulesForRole(role)) {
    if (!rule.pattern.test(normalizedName)) {
      continue;
    }

    const nameWithoutPrefix = normalizeWhitespace(normalizedName.replace(rule.pattern, ""));
    return nameWithoutPrefix ? `${rule.canonical} ${nameWithoutPrefix}` : rule.canonical;
  }

  return normalizedName;
};

export const stripKnownNamePrefix = (rawName: string): string => {
  const normalizedName = normalizeWhitespace(rawName);
  if (!normalizedName) {
    return "";
  }

  for (const rule of allPrefixRules) {
    if (!rule.pattern.test(normalizedName)) {
      continue;
    }

    return normalizeWhitespace(normalizedName.replace(rule.pattern, ""));
  }

  return normalizedName;
};
