"use client";

import { Filter, Megaphone, Send } from "lucide-react";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterCountBadge,
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterSearchInput,
  RosterTable,
  RosterTableCard,
  RosterTd,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import { UI_ACTION_PRIMARY_COMPACT, UI_BUTTON_PRIMARY } from "@/lib/ui-classes";
import type { PendingStudent } from "./types";

type TrackingViewProps = {
  searchKeyword: string;
  yearFilter: "ALL" | string;
  yearOptions: string[];
  filteredPendingStudents: PendingStudent[];
  onSearchKeywordChange: (value: string) => void;
  onYearFilterChange: (value: "ALL" | string) => void;
  onOpenReminder: (student: PendingStudent | null) => void;
};

export function TrackingView({
  searchKeyword,
  yearFilter,
  yearOptions,
  filteredPendingStudents,
  onSearchKeywordChange,
  onYearFilterChange,
  onOpenReminder,
}: TrackingViewProps) {
  const pagination = useListPagination(filteredPendingStudents, `${searchKeyword}:${yearFilter}`);
  const pageItems = pagination.pageItems;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-950">ติดตามการคัดกรอง</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการรายชื่อนิสิตที่ค้างประเมินและส่งแจ้งเตือนแบบเฉพาะรายหรือทั้งกลุ่ม
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenReminder(null)}
          disabled={filteredPendingStudents.length === 0}
          className={UI_BUTTON_PRIMARY}
        >
          <Megaphone className="h-4 w-4" />
          ส่งแจ้งเตือนทั้งหมด
        </button>
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput value={searchKeyword} onChange={onSearchKeywordChange} />
            <RosterToolbarEnd>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={yearFilter}
                  onChange={(event) => onYearFilterChange(event.target.value)}
                  className="bg-transparent font-medium outline-none"
                >
                  <option value="ALL">ทุกชั้นปี</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      ชั้นปี {year}
                    </option>
                  ))}
                </select>
              </div>
              <RosterCountBadge count={filteredPendingStudents.length} />
            </RosterToolbarEnd>
          </>
        }
      >
        <RosterTable
          columns={[
            { key: "student", label: "นิสิต", width: "28%" },
            { key: "year", label: "ชั้นปี", width: "10%" },
            { key: "reminder", label: "แจ้งเตือนล่าสุด", width: "22%" },
            { key: "status", label: "สถานะการประเมิน", width: "20%" },
            { key: "actions", label: "จัดการ", align: "center", width: "20%" },
          ]}
          emptyMessage="ไม่พบรายชื่อที่ตรงกับคำค้น"
        >
          {pageItems.map((student) => (
            <RosterRow key={student.id}>
              <RosterTd>
                <RosterPersonCell
                  name={student.name}
                  meta={student.studentCode || student.id}
                  avatarText={student.studentCode || student.id}
                />
              </RosterTd>
              <RosterTd className="font-medium text-slate-600">{student.year}</RosterTd>
              <RosterTd>
                <p className="truncate text-slate-500">{student.lastActive}</p>
              </RosterTd>
              <RosterTd>
                <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  {student.status}
                </span>
              </RosterTd>
              <RosterTd align="center">
                <button
                  type="button"
                  onClick={() => onOpenReminder(student)}
                  className={UI_ACTION_PRIMARY_COMPACT}
                >
                  <Send className="h-3.5 w-3.5" />
                  ส่งข้อความ
                </button>
              </RosterTd>
            </RosterRow>
          ))}
        </RosterTable>

        <RosterMobileList emptyMessage="ไม่พบรายชื่อที่ตรงกับคำค้น">
          {pageItems.map((student) => (
            <RosterMobileCard key={student.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{student.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {student.studentCode || student.id} • ชั้นปี {student.year}
                  </p>
                </div>
                <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  {student.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{student.lastActive}</p>
              <button
                type="button"
                onClick={() => onOpenReminder(student)}
                className={`${UI_ACTION_PRIMARY_COMPACT} mt-4 w-full py-2.5 text-sm`}
              >
                <Send className="h-4 w-4" />
                ส่งข้อความติดตาม
              </button>
            </RosterMobileCard>
          ))}
        </RosterMobileList>

        {pagination.total > pagination.rowsPerPage ? (
          <ListPaginationFooter
            total={pagination.total}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            currentPage={pagination.currentPage}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPrev={() => pagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => pagination.setCurrentPage((prev) => prev + 1)}
          />
        ) : null}
      </RosterTableCard>
    </div>
  );
}
