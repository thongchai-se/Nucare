"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Archive,
  ClipboardList,
  Copy,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { Survey, SurveyStatus } from "@/types/survey";

type SurveyListViewProps = {
  surveys: Survey[];
  activeSurveys: Survey[];
  archivedSurveys: Survey[];
  displaySurveys: Survey[];
  selectedFormId?: string;
  editorOpen: boolean;
  loadingData: boolean;
  serverError: string;
  viewMode: "active" | "archived";
  openMenuSurveyId: string | null;
  restoringId: string | null;
  togglingSurveyId: string | null;
  duplicatingId: string | null;
  statusLabels: Record<SurveyStatus, string>;
  formatThaiDateTime: (value: string | null) => string;
  handleCreateNew: () => void;
  handleSelectSurvey: (surveyId: string) => void | Promise<void>;
  handleToggleSurveyActive: (survey: Survey, nextIsActive: boolean) => void | Promise<void>;
  handleRequestDeleteSurvey: (survey: Survey) => void | Promise<void>;
  handleRestoreSurvey: (survey: Survey) => void | Promise<void>;
  handleDuplicateSurvey: (survey: Survey) => void | Promise<void>;
  setViewMode: Dispatch<SetStateAction<"active" | "archived">>;
  setOpenMenuSurveyId: Dispatch<SetStateAction<string | null>>;
  setServerError: Dispatch<SetStateAction<string>>;
};

export function SurveyListView({
  surveys,
  activeSurveys,
  archivedSurveys,
  displaySurveys,
  selectedFormId,
  editorOpen,
  loadingData,
  serverError,
  viewMode,
  openMenuSurveyId,
  restoringId,
  togglingSurveyId,
  duplicatingId,
  statusLabels,
  formatThaiDateTime,
  handleCreateNew,
  handleSelectSurvey,
  handleToggleSurveyActive,
  handleRequestDeleteSurvey,
  handleRestoreSurvey,
  handleDuplicateSurvey,
  setViewMode,
  setOpenMenuSurveyId,
  setServerError,
}: SurveyListViewProps) {
  return (
    <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-start gap-2 text-xl font-black text-slate-900 sm:text-2xl">
          <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
          แบบสอบถามและแบบประเมินสุขภาพใจ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          สร้างแบบสอบถาม เปิดรอบให้นักศึกษา และดูผลสรุปโดยไม่เปิดเผยคำตอบเกินจำเป็น
        </p>
      </div>

      <button
        type="button"
        onClick={handleCreateNew}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        สร้างแบบสอบถามใหม่
      </button>
    </div>

    {serverError && !editorOpen ? (
      <InlineAlert className="rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <p className="flex-1">{serverError}</p>
          <button
            type="button"
            onClick={() => setServerError("")}
            className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </InlineAlert>
    ) : null}

    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">แบบสอบถามทั้งหมด</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{surveys.length.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-600">{activeSurveys.length}</span> ใช้งาน
            {archivedSurveys.length > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setViewMode("archived")}
                  className="font-semibold text-slate-500 underline decoration-dotted hover:text-slate-700"
                >
                  {archivedSurveys.length} เก็บถาวร
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-bold text-emerald-700">เปิดใช้งานอยู่</p>
          <p className="mt-2 text-2xl font-black text-emerald-800">
            {surveys.filter((survey) => survey.isActive).length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">ผู้ส่งคำตอบรวม</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {surveys.reduce((total, survey) => total + survey.responseCount, 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Privacy-first summary
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
            แสดงผู้ที่ทำแบบสอบถามแล้วพร้อมผลคะแนนสรุป โดยไม่เปิดคำตอบรายข้อบนหน้ารวม
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">รายการแบบสอบถาม</h2>
              <p className="mt-1 text-sm text-slate-500">
                {viewMode === "active"
                  ? "กดชื่อแบบสอบถามเพื่อเข้าไปแก้ไข เปิด/ปิดได้จาก switch ในรายการ"
                  : "แบบสอบถามที่เก็บถาวรแล้ว กด ดึงกลับ เพื่อนำกลับมาใช้งาน"}
              </p>
            </div>
            {viewMode === "active" ? (
              <button
                type="button"
                onClick={handleCreateNew}
                className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                เพิ่มแบบสอบถาม
              </button>
            ) : null}
          </div>

          <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-slate-100/60 p-1 sm:self-start">
            <button
              type="button"
              onClick={() => setViewMode("active")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                viewMode === "active"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              ใช้งาน
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${
                viewMode === "active" ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
              }`}>
                {activeSurveys.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("archived")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                viewMode === "archived"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              เก็บถาวร
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${
                viewMode === "archived" ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
              }`}>
                {archivedSurveys.length}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {displaySurveys.map((survey) => {
            const isSelected = survey.id === selectedFormId;
            const menuOpen = openMenuSurveyId === survey.id;
            const isToggling = togglingSurveyId === survey.id;
            const isRestoring = restoringId === survey.id;
            const isArchived = viewMode === "archived";

            return (
              <article
                key={`mobile-${survey.id}`}
                className={`relative rounded-2xl border p-4 transition-colors ${
                  isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                }`}
                onClick={() => {
                  void handleSelectSurvey(survey.id);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-base font-black text-slate-950">{survey.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {survey.description || "ไม่มีคำอธิบาย"}
                    </p>
                  </div>

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuSurveyId((current) => (current === survey.id ? null : survey.id));
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                      aria-label="เมนูแบบสอบถาม"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen ? (
                      <div
                        className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuSurveyId(null);
                            void handleSelectSurvey(survey.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4" />
                          แก้ไข/รายละเอียด
                        </button>
                        {!isArchived ? (
                          <button
                            type="button"
                            disabled={duplicatingId !== null}
                            onClick={() => {
                              void handleDuplicateSurvey(survey);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {duplicatingId === survey.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            ทำสำเนา
                          </button>
                        ) : null}
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRestoreSurvey(survey);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            ดึงกลับ
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                void handleToggleSurveyActive(survey, !survey.isActive);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <Power className="h-4 w-4" />
                              {survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleRequestDeleteSurvey(survey);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              ลบ
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      survey.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : survey.status === "ARCHIVED"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {survey.isActive ? "เปิดอยู่" : statusLabels[survey.status]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {survey.questionCount.toLocaleString()} คำถาม
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    ทำแล้ว {survey.responseCount.toLocaleString()}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="min-w-0 text-xs font-medium text-slate-500">
                    แก้ไขล่าสุด {formatThaiDateTime(survey.updatedAt)}
                  </div>
                  {isArchived ? (
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRestoreSurvey(survey);
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRestoring ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      ดึงกลับ
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleToggleSurveyActive(survey, !survey.isActive);
                      }}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                        survey.isActive ? "bg-emerald-500" : "bg-slate-300"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-label={survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                      aria-pressed={survey.isActive}
                    >
                      <span
                        className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                          survey.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {displaySurveys.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              {loadingData ? (
                <>
                  <span className="loader h-4 w-4 text-blue-600" aria-hidden />
                  กำลังโหลดแบบสอบถาม...
                </>
              ) : viewMode === "archived" ? (
                "ยังไม่มีแบบสอบถามที่เก็บถาวร"
              ) : (
                'ยังไม่มีแบบสอบถามในระบบ กด “เพิ่มแบบสอบถาม” เพื่อเริ่มสร้าง'
              )}
            </div>
          ) : null}
        </div>

        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[7rem]" />
              <col className="w-[5.5rem]" />
              <col className="w-[5.5rem]" />
              <col className="w-[10.5rem]" />
              <col className="w-[5rem]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">แบบสอบถาม</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">สถานะ</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">คำถาม</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">ทำแล้ว</th>
                <th className="whitespace-nowrap px-4 py-3">แก้ไขล่าสุด</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displaySurveys.map((survey) => {
                const isSelected = survey.id === selectedFormId;
                const menuOpen = openMenuSurveyId === survey.id;
                const isToggling = togglingSurveyId === survey.id;
                const isRestoring = restoringId === survey.id;
                const isArchived = viewMode === "archived";

                return (
                  <tr
                    key={survey.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      void handleSelectSurvey(survey.id);
                    }}
                  >
                    <td className="px-4 py-4 align-middle">
                      <p className="line-clamp-1 font-black text-slate-950">{survey.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{survey.description || "ไม่มีคำอธิบาย"}</p>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex justify-center">
                        {isArchived ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                            เก็บถาวร
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleToggleSurveyActive(survey, !survey.isActive);
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                              survey.isActive ? "bg-emerald-500" : "bg-slate-300"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            aria-label={survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                            aria-pressed={survey.isActive}
                          >
                            <span
                              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                survey.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600 align-middle">{survey.questionCount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-center text-slate-600 align-middle">{survey.responseCount.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500 align-middle">{formatThaiDateTime(survey.updatedAt)}</td>
                    <td className="px-4 py-4 text-right align-middle">
                      {isArchived ? (
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRestoreSurvey(survey);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRestoring ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          ดึงกลับ
                        </button>
                      ) : (
                        <div className="relative inline-flex">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuSurveyId((current) => (current === survey.id ? null : survey.id));
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                            aria-label="เมนูแบบสอบถาม"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuOpen ? (
                            <div
                              className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuSurveyId(null);
                                  void handleSelectSurvey(survey.id);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" />
                                แก้ไข/รายละเอียด
                              </button>
                              <button
                                type="button"
                                disabled={duplicatingId !== null}
                                onClick={() => {
                                  void handleDuplicateSurvey(survey);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {duplicatingId === survey.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                ทำสำเนา
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleToggleSurveyActive(survey, !survey.isActive);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <Power className="h-4 w-4" />
                                {survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleRequestDeleteSurvey(survey);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                ลบ
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displaySurveys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {loadingData ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span className="loader h-4 w-4 text-blue-600" aria-hidden />
                        กำลังโหลดแบบสอบถาม...
                      </span>
                    ) : viewMode === "archived" ? (
                      "ยังไม่มีแบบสอบถามที่เก็บถาวร"
                    ) : (
                      'ยังไม่มีแบบสอบถามในระบบ กด “เพิ่มแบบสอบถาม” เพื่อเริ่มสร้าง'
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </>
  );
}
