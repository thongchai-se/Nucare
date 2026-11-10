export type UpcomingCalendarAppointment = {
  id: string;
  studentName: string;
  scheduledAt: string;
  scheduledAtLabel: string;
  topic: string;
  location: string;
};

export type UpcomingCalendarDay = {
  dateKey: string;
  dayOfMonth: number;
  weekdayShort: string;
  monthShort: string;
  isToday: boolean;
  appointments: UpcomingCalendarAppointment[];
};

export type WeekTimelineEvent = UpcomingCalendarAppointment & {
  dayIndex: number;
  startMinutes: number;
  durationMinutes: number;
  timeLabel: string;
  toneIndex: number;
};

export type WeekTimelineModel = {
  days: UpcomingCalendarDay[];
  events: WeekTimelineEvent[];
  startHour: number;
  endHour: number;
  hourHeightPx: number;
  rangeLabel: string;
  monthTitle: string;
};

const WEEKDAY_SHORT_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
const MONTH_SHORT_TH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;
const MONTH_FULL_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export const WEEK_TIMELINE_HOUR_HEIGHT_PX = 56;
export const WEEK_TIMELINE_DEFAULT_START_HOUR = 8;
export const WEEK_TIMELINE_DEFAULT_END_HOUR = 18;
export const WEEK_TIMELINE_SLOT_MINUTES = 60;

/** สร้างคีย์วันที่แบบท้องถิ่น YYYY-MM-DD จาก Date */
export function toLocalDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** แปลง ISO เป็นคีย์วันที่ท้องถิ่น — คืน null ถ้าไม่ใช่วันที่ */
export function scheduledAtToLocalDateKey(scheduledAt: string): string | null {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return toLocalDateKey(date);
}

/** นาทีจากเที่ยงคืนท้องถิ่นของเวลานัด — คืน null ถ้าเสีย */
export function getAppointmentStartMinutes(scheduledAt: string): number | null {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getHours() * 60 + date.getMinutes();
}

/** ป้ายเวลาสั้น เช่น 13:00 */
export function formatHourMinuteLabel(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safe / 60) % 24;
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * สร้างปฏิทิน n วันถัดไป (รวมวันนี้) แล้วจัดกลุ่มนัดตามวัน — O(n + days)
 */
export function buildUpcomingWeekCalendar(
  appointments: UpcomingCalendarAppointment[],
  now = new Date(),
  dayCount = 7
): UpcomingCalendarDay[] {
  const safeDayCount = Math.max(1, Math.floor(dayCount));
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toLocalDateKey(todayStart);

  const byDay = new Map<string, UpcomingCalendarAppointment[]>();
  for (const item of appointments) {
    const key = scheduledAtToLocalDateKey(item.scheduledAt);
    if (!key) {
      continue;
    }
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      byDay.set(key, [item]);
    }
  }

  const days: UpcomingCalendarDay[] = [];
  for (let offset = 0; offset < safeDayCount; offset += 1) {
    const date = new Date(todayStart);
    date.setDate(todayStart.getDate() + offset);
    const dateKey = toLocalDateKey(date);
    const dayAppointments = byDay.get(dateKey) ?? [];
    days.push({
      dateKey,
      dayOfMonth: date.getDate(),
      weekdayShort: WEEKDAY_SHORT_TH[date.getDay()] ?? "",
      monthShort: MONTH_SHORT_TH[date.getMonth()] ?? "",
      isToday: dateKey === todayKey,
      appointments: dayAppointments,
    });
  }

  return days;
}

/**
 * โมเดล week view: คอลัมน์วัน × แกนชั่วโมง + การ์ดนัดวางตามเวลา
 * ช่วงชั่วโมงขยายตามนัดจริง แต่ไม่แคบกว่าค่าเริ่ม (8–18)
 */
export function buildWeekTimelineModel(
  appointments: UpcomingCalendarAppointment[],
  now = new Date(),
  dayCount = 7
): WeekTimelineModel {
  const days = buildUpcomingWeekCalendar(appointments, now, dayCount);
  const dayIndexByKey = new Map(days.map((day, index) => [day.dateKey, index]));

  let minHour = WEEK_TIMELINE_DEFAULT_START_HOUR;
  let maxHour = WEEK_TIMELINE_DEFAULT_END_HOUR;
  const events: WeekTimelineEvent[] = [];

  for (const item of appointments) {
    const dateKey = scheduledAtToLocalDateKey(item.scheduledAt);
    const startMinutes = getAppointmentStartMinutes(item.scheduledAt);
    if (!dateKey || startMinutes === null) {
      continue;
    }
    const dayIndex = dayIndexByKey.get(dateKey);
    if (dayIndex === undefined) {
      continue;
    }

    const startHour = Math.floor(startMinutes / 60);
    minHour = Math.min(minHour, startHour);
    maxHour = Math.max(maxHour, startHour + 1);

    events.push({
      ...item,
      dayIndex,
      startMinutes,
      durationMinutes: WEEK_TIMELINE_SLOT_MINUTES,
      timeLabel: formatHourMinuteLabel(startMinutes),
      toneIndex: dayIndex % 4,
    });
  }

  events.sort((left, right) => {
    if (left.dayIndex !== right.dayIndex) {
      return left.dayIndex - right.dayIndex;
    }
    return left.startMinutes - right.startMinutes;
  });

  const start = days[0];
  const end = days[days.length - 1];
  const rangeLabel =
    start && end
      ? `${start.dayOfMonth} ${start.monthShort} – ${end.dayOfMonth} ${end.monthShort}`
      : "";
  const monthTitle = start
    ? `${MONTH_FULL_TH[new Date(start.dateKey + "T12:00:00").getMonth()] ?? ""} ${
        new Date(start.dateKey + "T12:00:00").getFullYear() + 543
      }`
    : "";

  return {
    days,
    events,
    startHour: Math.max(0, Math.min(minHour, WEEK_TIMELINE_DEFAULT_START_HOUR)),
    endHour: Math.min(24, Math.max(maxHour, WEEK_TIMELINE_DEFAULT_END_HOUR)),
    hourHeightPx: WEEK_TIMELINE_HOUR_HEIGHT_PX,
    rangeLabel,
    monthTitle,
  };
}

/** คำนวณตำแหน่ง top/height ของการ์ดนัดในแกนชั่วโมง */
export function getTimelineEventStyle(
  event: Pick<WeekTimelineEvent, "startMinutes" | "durationMinutes">,
  startHour: number,
  hourHeightPx = WEEK_TIMELINE_HOUR_HEIGHT_PX
): { top: number; height: number } {
  const offsetMinutes = event.startMinutes - startHour * 60;
  return {
    top: (offsetMinutes / 60) * hourHeightPx,
    height: Math.max(hourHeightPx * 0.72, (event.durationMinutes / 60) * hourHeightPx - 4),
  };
}
