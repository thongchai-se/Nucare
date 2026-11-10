"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, UserRound, X } from "lucide-react";
import { getNameInitials } from "@/lib/name-prefix";

export type StudentSearchOption = {
  id: string;
  name: string;
  studentId: string | null;
  studyYear?: number | null;
  section?: string | null;
};

type StudentSearchPickerProps = {
  label?: string;
  hint?: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: StudentSearchOption[];
  selectedId: string;
  selectedStudent?: StudentSearchOption | null;
  onSelect: (student: StudentSearchOption | null) => void;
  isLoading?: boolean;
  emptyMessage?: string;
};

/** ค้นหาและเลือกนิสิตแบบรายการคลิก — คงโฟกัสช่องค้นหาแม้ผลลัพธ์กำลังโหลด */
export function StudentSearchPicker({
  label = "ค้นหา / เลือกนิสิต",
  hint = "พิมพ์ชื่อหรือรหัสนิสิต แล้วคลิกจากรายการ",
  query,
  onQueryChange,
  options,
  selectedId,
  selectedStudent = null,
  onSelect,
  isLoading = false,
  emptyMessage = "ไม่พบนิสิตที่ตรงกับคำค้น",
}: StudentSearchPickerProps) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected =
    selectedStudent || options.find((student) => student.id === selectedId) || null;

  useEffect(() => {
    setHighlightIndex(0);
  }, [options]);

  const selectAt = (index: number) => {
    const student = options[index];
    if (!student) {
      return;
    }
    onSelect(student);
  };

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={inputId} className="block text-xs font-bold text-slate-600">
          {label}
        </label>
        <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      </div>

      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-blue-100">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#0057A8]">{selected.name}</p>
            <p className="truncate text-xs text-slate-500">{selected.studentId || "ไม่มีรหัสนิสิต"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
            เปลี่ยน
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={true}
          aria-activedescendant={options[highlightIndex] ? `${listId}-opt-${options[highlightIndex].id}` : undefined}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightIndex((current) => Math.max(current - 1, 0));
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              selectAt(highlightIndex);
            }
          }}
          placeholder="เช่น ภูมิพัฒน์ หรือ 681100001"
          autoComplete="off"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        {isLoading ? (
          <span className="loader absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" aria-hidden="true" />
        ) : null}
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="ผลการค้นหานิสิต"
        className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white"
      >
        {options.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {options.map((student, index) => {
              const isSelected = student.id === selectedId;
              const isHighlighted = index === highlightIndex;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    id={`${listId}-opt-${student.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => onSelect(student)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-blue-50"
                        : isHighlighted
                          ? "bg-slate-50"
                          : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">
                      {getNameInitials(student.name, "นศ")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0057A8]">{student.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[student.studentId || "-", student.studyYear ? `ปี ${student.studyYear}` : null, student.section ? `ตอน ${student.section}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-blue-700" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            {isLoading ? "กำลังค้นหา..." : emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
