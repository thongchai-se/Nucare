import {
  facultyAddress,
  facultyEnglishBanner,
  facultyEnglishFullName,
  facultyFaxDisplay,
  facultyName,
  facultyOfficeHours,
  facultyOfficeHoursLabel,
  facultyPhoneDisplay,
  facultyPhonePrimaryTel,
  universityName,
} from "@/lib/brand";

export type PublicSiteSettings = {
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  facultyNameTh: string;
  universityNameTh: string;
  facultyEnglishBanner: string;
  facultyEnglishFullName: string;
  contactAddress: string;
  contactPhoneDisplay: string;
  contactPhoneTel: string;
  contactFaxDisplay: string;
  contactOfficeHoursLabel: string;
  contactOfficeHours: string;
  updatedAt?: string;
};

/** ค่าสำรองเมื่อ API ยังไม่พร้อม — สอดคล้อง brand.ts */
export const PUBLIC_SITE_SETTINGS_FALLBACK: PublicSiteSettings = {
  maintenanceEnabled: false,
  maintenanceMessage: "",
  facultyNameTh: facultyName,
  universityNameTh: universityName,
  facultyEnglishBanner,
  facultyEnglishFullName,
  contactAddress: facultyAddress,
  contactPhoneDisplay: facultyPhoneDisplay,
  contactPhoneTel: facultyPhonePrimaryTel,
  contactFaxDisplay: facultyFaxDisplay,
  contactOfficeHoursLabel: facultyOfficeHoursLabel,
  contactOfficeHours: facultyOfficeHours,
};
