"use client";

import { MessageCircle } from "lucide-react";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import { COMMON_ISSUE_BAR_CLASSES } from "@/lib/executive-ui";
import type { CommonIssueItem } from "@/types/executive";

type ExecutiveCommonIssuesProps = {
  issues: CommonIssueItem[];
  bucketLabel: string;
};

export function ExecutiveCommonIssues({ issues, bucketLabel }: ExecutiveCommonIssuesProps) {
  const visibleIssues = issues.filter((issue) => issue.count > 0);

  return (
    <ExecutiveSectionShell
      icon={<MessageCircle className="text-[#0057A8]" size={18} />}
      title="ปัญหาที่พบบ่อยจากการขอปรึกษา"
      subtitle={`จากคำขอปรึกษาในระบบ (${bucketLabel})`}
      className="flex h-full flex-col"
    >
      {visibleIssues.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-slate-50 px-6 py-10 text-center">
          <MessageCircle className="mb-3 h-9 w-9 text-slate-300" aria-hidden />
          <p className="text-sm font-semibold text-slate-800">ยังไม่มีข้อมูลคำขอปรึกษา</p>
          <p className="mt-1 text-sm text-slate-500">เมื่อมีการขอปรึกษา ระบบจะสรุปหัวข้อที่พบบ่อยให้ที่นี่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleIssues.map((issue, index) => {
            const barClass = COMMON_ISSUE_BAR_CLASSES[index % COMMON_ISSUE_BAR_CLASSES.length];

            return (
              <div key={issue.label} className="rounded-xl bg-slate-50/80 p-3.5 sm:bg-transparent sm:p-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 sm:w-40 sm:shrink-0 lg:w-48">
                    <p className="text-sm font-semibold text-slate-900">{issue.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500 sm:hidden">
                      {issue.count.toLocaleString()} ครั้ง · {issue.percent}%
                    </p>
                  </div>

                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      style={{ width: `${issue.percent}%` }}
                      className={`h-full rounded-full transition-[width] duration-300 ease-out ${barClass}`}
                    />
                  </div>

                  <div className="hidden shrink-0 text-right sm:block sm:w-24">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">{issue.percent}%</p>
                    <p className="text-[11px] text-slate-500">{issue.count.toLocaleString()} ครั้ง</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ExecutiveSectionShell>
  );
}
