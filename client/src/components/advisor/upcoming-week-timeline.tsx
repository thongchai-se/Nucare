"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { UI_TEXT_LINK } from "@/lib/ui-classes";
import {
  buildWeekTimelineModel,
  formatHourMinuteLabel,
  getTimelineEventStyle,
  type UpcomingCalendarAppointment,
} from "./upcoming-week-calendar";

type UpcomingWeekTimelineProps = {
  appointments: UpcomingCalendarAppointment[];
  onOpenAll: () => void;
  onOpenAppointment?: (appointmentId: string) => void;
};

const EVENT_TONES = [
  "border-[#0057A8]/25 bg-[#E8F3FC] text-[#0B4F8C]",
  "border-cyan-200 bg-cyan-50 text-cyan-900",
  "border-sky-200 bg-sky-50 text-sky-900",
  "border-indigo-200 bg-indigo-50 text-indigo-900",
] as const;

/** ปฏิทินสัปดาห์แนว timeline — คอลัมน์วัน × แกนชั่วโมง วางการ์ดนัดตามเวลา */
export function UpcomingWeekTimeline({
  appointments,
  onOpenAll,
  onOpenAppointment,
}: UpcomingWeekTimelineProps) {
  const model = useMemo(() => buildWeekTimelineModel(appointments), [appointments]);
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let hour = model.startHour; hour < model.endHour; hour += 1) {
      list.push(hour);
    }
    return list;
  }, [model.endHour, model.startHour]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    model.days.some((day) => day.isToday) &&
    nowMinutes >= model.startHour * 60 &&
    nowMinutes <= model.endHour * 60;
  const nowTop = ((nowMinutes - model.startHour * 60) / 60) * model.hourHeightPx;
  const gridHeight = hours.length * model.hourHeightPx;
  const columnTemplate = `3rem repeat(${model.days.length}, minmax(0, 1fr))`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {model.days[0]?.monthShort ?? ""}
            </span>
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {model.days[0]?.dayOfMonth ?? ""}
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">{model.monthTitle || "นัดใกล้ถึง"}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              มุมมองสัปดาห์ · {model.rangeLabel || "7 วันข้างหน้า"}
            </p>
          </div>
        </div>
        <button type="button" onClick={onOpenAll} className={UI_TEXT_LINK}>
          ดูทั้งหมด
        </button>
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="ยังไม่มีนัดใน 7 วัน"
          description="เมื่อมีนัดที่ยืนยันแล้ว จะวางเป็นการ์ดบนตารางเวลานี้"
        />
      ) : (
        <div className="-mx-1 overflow-x-auto overscroll-contain px-1">
          <div className="min-w-[44rem]">
            <div className="grid border-b border-slate-200 pb-2" style={{ gridTemplateColumns: columnTemplate }}>
              <div />
              {model.days.map((day) => (
                <div key={day.dateKey} className="px-1 text-center">
                  <p className="text-[11px] font-semibold text-slate-500">{day.weekdayShort}</p>
                  <div
                    className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                      day.isToday ? "bg-[#0057A8] text-white" : "text-slate-800"
                    }`}
                  >
                    {day.dayOfMonth}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-1 max-h-[22rem] overflow-y-auto overscroll-contain">
              <div className="grid" style={{ gridTemplateColumns: columnTemplate, height: gridHeight }}>
                <div className="relative">
                  {hours.map((hour) => (
                    <div
                      key={`label-${hour}`}
                      className="absolute right-1 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-slate-400"
                      style={{ top: (hour - model.startHour) * model.hourHeightPx }}
                    >
                      {formatHourMinuteLabel(hour * 60)}
                    </div>
                  ))}
                </div>

                {model.days.map((day, dayIndex) => (
                  <div
                    key={`col-${day.dateKey}`}
                    className={`relative border-l border-slate-100 ${day.isToday ? "bg-[#0057A8]/[0.03]" : ""}`}
                  >
                    {hours.map((hour) => (
                      <div
                        key={`${day.dateKey}-${hour}`}
                        className="absolute inset-x-0 border-t border-slate-100"
                        style={{
                          top: (hour - model.startHour) * model.hourHeightPx,
                          height: model.hourHeightPx,
                        }}
                      />
                    ))}

                    {model.events
                      .filter((event) => event.dayIndex === dayIndex)
                      .map((event) => {
                        const style = getTimelineEventStyle(event, model.startHour, model.hourHeightPx);
                        const tone = EVENT_TONES[event.toneIndex] ?? EVENT_TONES[0];
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => (onOpenAppointment ? onOpenAppointment(event.id) : onOpenAll())}
                            className={`absolute inset-x-1 z-[1] overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/40 ${tone}`}
                            style={{ top: style.top, height: style.height }}
                            title={`${event.studentName} · ${event.timeLabel}`}
                          >
                            <span className="block truncate text-[11px] font-bold leading-tight">
                              {event.studentName}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] font-semibold tabular-nums opacity-80">
                              {event.timeLabel}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>

              {showNowLine ? (
                <div
                  className="pointer-events-none absolute left-12 right-0 z-[2] flex items-center"
                  style={{ top: nowTop }}
                >
                  <span className="mr-2 rounded bg-[#C24712] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                    {formatHourMinuteLabel(nowMinutes)}
                  </span>
                  <span className="h-px flex-1 border-t border-dashed border-[#C24712]" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
