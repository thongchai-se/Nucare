import { z } from "zod";

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const trimmedOptionalEmpty = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value);

/** แพตช์การตั้งค่าระบบ — ปฏิเสธฟิลด์ที่ไม่รู้จัก */
export const patchSiteSettingsSchema = z
  .object({
    maintenanceEnabled: z.boolean().optional(),
    maintenanceMessage: z.string().trim().max(500).optional(),
    facultyNameTh: trimmedString(120).optional(),
    universityNameTh: trimmedString(120).optional(),
    facultyEnglishBanner: trimmedString(200).optional(),
    contactAddress: trimmedString(500).optional(),
    contactPhoneDisplay: trimmedString(120).optional(),
    contactPhoneTel: z
      .string()
      .trim()
      .min(5)
      .max(40)
      .regex(/^[0-9+()\-\s]+$/, "เบอร์โทรต้องเป็นตัวเลขหรือสัญลักษณ์โทรศัพท์")
      .optional(),
    contactFaxDisplay: trimmedOptionalEmpty(80).optional(),
    contactOfficeHoursLabel: trimmedOptionalEmpty(80).optional(),
    contactOfficeHours: trimmedOptionalEmpty(200).optional(),
  })
  .strict();

export type PatchSiteSettingsInput = z.infer<typeof patchSiteSettingsSchema>;
