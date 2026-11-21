/**
 * คัดแจ้งเตือน OPEN สำหรับป๊อปอัปหน้าแรกนิสิต
 * — แสดงเฉพาะเมื่อยังมีแบบประเมินค้างทำ และจัดรายการหลายแบบได้
 */

export type StudentHomeAlertDto = {
  id: string;
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  type: string;
  sourceType?: string | null;
  createdAt: string;
};

/** แบบประเมินที่ค้างทำสำหรับรายการในป๊อปอัป */
export type PendingSurveyForPopup = {
  id: string;
  title: string;
  waveLabel?: string | null;
};

/** แจ้งเตือนจากฝ่ายพัฒนานิสิต/เปิดคลื่นเรื่องทำแบบประเมิน */
export function isAssessmentReminderAlert(alert: StudentHomeAlertDto): boolean {
  if (alert.sourceType === "StudentDevelopmentReminder" || alert.sourceType === "SurveyWave") {
    return true;
  }
  const haystack = `${alert.title} ${alert.message}`;
  return /แบบประเมิน|คัดกรอง|สุขภาพจิต/.test(haystack);
}

const byNewestFirst = (left: StudentHomeAlertDto, right: StudentHomeAlertDto): number =>
  new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

/** รวบรวม Alert เตือนแบบประเมินที่ยัง OPEN */
export function listOpenAssessmentReminderAlerts(
  alerts: StudentHomeAlertDto[]
): StudentHomeAlertDto[] {
  return alerts
    .filter((alert) => alert.status === "OPEN" && isAssessmentReminderAlert(alert))
    .slice()
    .sort(byNewestFirst);
}

/**
 * ตัดสินใจป๊อปอัป: โชว์เฉพาะเมื่อมีแบบค้างทำและมีแจ้งเตือน
 * — ถ้าทำครบแล้วให้ acknowledge Alert เตือนที่ค้าง OPEN
 */
export function resolveAssessmentReminderPopup(input: {
  pendingSurveys: PendingSurveyForPopup[];
  alerts: StudentHomeAlertDto[];
}): {
  show: boolean;
  pendingSurveys: PendingSurveyForPopup[];
  alertsToAcknowledge: StudentHomeAlertDto[];
} {
  const reminderAlerts = listOpenAssessmentReminderAlerts(input.alerts);
  const pendingSurveys = input.pendingSurveys;

  if (pendingSurveys.length === 0) {
    return {
      show: false,
      pendingSurveys: [],
      alertsToAcknowledge: reminderAlerts,
    };
  }

  if (reminderAlerts.length === 0) {
    return {
      show: false,
      pendingSurveys,
      alertsToAcknowledge: [],
    };
  }

  return {
    show: true,
    pendingSurveys,
    alertsToAcknowledge: [],
  };
}

/** @deprecated ใช้ resolveAssessmentReminderPopup แทน — คงไว้เพื่อความเข้ากันของเทสเก่า */
export function pickStudentAssessmentReminderPopup(
  alerts: StudentHomeAlertDto[]
): StudentHomeAlertDto | null {
  return listOpenAssessmentReminderAlerts(alerts)[0] ?? null;
}
