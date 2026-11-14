type AuditMetaValue = string | number | boolean | null | undefined;

/**
 * รวม metadata ของ audit เป็นสตริง key=value โดยไม่ใส่เนื้อหาเสรี
 */
export const formatAuditMetadata = (
  entries: Record<string, AuditMetaValue>
): string => {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const normalizedKey = key.replace(/[=\s|]+/g, "_");
    const normalizedValue = String(value).replace(/[|\r\n]+/g, " ").trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    parts.push(`${normalizedKey}=${normalizedValue}`);
  }

  return parts.length > 0 ? parts.join(" ") : "ok";
};
