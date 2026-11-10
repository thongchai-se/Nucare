"use client";

import { ArrowRight, BookOpen, MoreVertical } from "lucide-react";
import type { StudentGroup } from "./types";

type CoursesListViewProps = {
  studentGroups: StudentGroup[];
  onOpenGroup: (groupId: StudentGroup["id"]) => void;
};

export function CoursesListView({ studentGroups, onOpenGroup }: CoursesListViewProps) {
  return (
  
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">กลุ่มที่รับผิดชอบ</h2>
          <p className="mt-1 text-sm text-slate-500">ใช้เป็นมุมมองติดตามนักศึกษาตามสถานะการเฝ้าระวังจากข้อมูลจริงในระบบ</p>
        </div>
      </div>
  
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {studentGroups.map((group) => (
          <div
            key={group.id}
            onClick={() => onOpenGroup(group.id)}
            className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div className="absolute right-0 top-0 p-4">
              <MoreVertical size={16} className="text-slate-300" />
            </div>
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
                <BookOpen size={24} />
              </div>
            </div>
            <h3 className="mb-1 text-lg font-bold leading-tight text-slate-800 transition-colors group-hover:text-blue-600">{group.name}</h3>
            <p className="mb-4 text-xs font-bold text-slate-400">{group.code}</p>
  
            <div className="space-y-2 border-t border-slate-50 pt-4">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">คำอธิบาย:</span>
                <span className="max-w-[58%] text-right text-slate-700">{group.description}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">จำนวนนักศึกษา:</span>
                <span className="font-bold text-slate-700">{group.students} คน</span>
              </div>
            </div>
  
            <div className="mt-6 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-600">
              <span>จัดการนักศึกษา</span>
              <ArrowRight size={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  
  );
}
