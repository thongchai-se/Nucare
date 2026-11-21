import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "รูปแบบวันเวลาไม่ถูกต้อง",
      });
      return z.NEVER;
    }
    return parsed;
  });

/** คิวรีรายการ audit ของแอดมิน — จำกัดจำนวนและช่วงเวลา */
export const listAuditLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    from: optionalDate,
    to: optionalDate,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from.getTime() > data.to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "วันเริ่มต้องไม่เกินวันสิ้นสุด",
      });
    }
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

/** สร้าง where ของ Prisma จากช่วงเวลา */
export function buildAuditLogCreatedAtFilter(input: {
  from?: Date;
  to?: Date;
}): { gte?: Date; lte?: Date } | undefined {
  if (!input.from && !input.to) {
    return undefined;
  }
  return {
    ...(input.from ? { gte: input.from } : {}),
    ...(input.to ? { lte: input.to } : {}),
  };
}
