"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, Loader2, Send, X } from "lucide-react";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import api from "@/lib/axios";
import type {
  ActiveStudentSurveyResult,
  StudentFacingSurvey,
  Survey,
  SurveyAnswerValue,
  SurveyQuestion,
} from "@/types/survey";

type StudentSurveyLike = Survey | StudentFacingSurvey;

type OrientationSurveyModalProps = {
  hasSubmitted: boolean;
  onClose: () => void;
  onSubmitted: (response: ActiveStudentSurveyResult) => void;
  open: boolean;
  result?: ActiveStudentSurveyResult | null;
  submittedAt: string | null;
  survey: StudentSurveyLike | null;
};

type SubmitSurveyResponse = {
  response: ActiveStudentSurveyResult;
};

type AnswerState = Record<string, SurveyAnswerValue | "">;

const isBlank = (value: SurveyAnswerValue | "" | undefined): boolean =>
  value === undefined ||
  value === "" ||
  (typeof value === "string" && value.trim().length === 0) ||
  (Array.isArray(value) && value.length === 0);

const formatThaiDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

const buildInitialAnswers = (survey: StudentSurveyLike | null): AnswerState => {
  if (!survey) {
    return {};
  }

  return Object.fromEntries(
    survey.questions.map((question) => [
      question.id,
      question.type === "MULTIPLE_CHOICE" ? [] : "",
    ])
  );
};

const buildScaleValues = (question: SurveyQuestion): number[] => {
  const min = question.minValue ?? 1;
  const max = question.maxValue ?? 5;
  const size = max - min + 1;

  if (size <= 0 || size > 20) {
    return [];
  }

  return Array.from({ length: size }, (_, index) => min + index);
};

export function OrientationSurveyModal({
  hasSubmitted,
  onClose,
  onSubmitted,
  open,
  result = null,
  submittedAt,
  survey,
}: OrientationSurveyModalProps) {
  const [answers, setAnswers] = useState<AnswerState>(() => buildInitialAnswers(survey));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [missingQuestionId, setMissingQuestionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const questionNodeRefs = useRef<Record<string, HTMLElement | null>>({});

  const requiredQuestionIds = useMemo(
    () => new Set((survey?.questions || []).filter((question) => question.isRequired).map((question) => question.id)),
    [survey?.questions]
  );
  const answeredCount = useMemo(
    () => (survey?.questions || []).filter((question) => !isBlank(answers[question.id])).length,
    [answers, survey?.questions]
  );
  const totalQuestionCount = survey?.questions.length ?? 0;
  const hasDraftAnswers = answeredCount > 0 && !hasSubmitted;
  const missingRequiredCount = useMemo(
    () =>
      (survey?.questions || []).filter(
        (question) => requiredQuestionIds.has(question.id) && isBlank(answers[question.id])
      ).length,
    [answers, requiredQuestionIds, survey?.questions]
  );
  const canSubmit = Boolean(survey) && !hasSubmitted && missingRequiredCount === 0;

  useEffect(() => {
    if (open) {
      setAnswers(buildInitialAnswers(survey));
      setErrorMessage("");
      setMissingQuestionId(null);
      setConfirmCloseOpen(false);
    }
  }, [open, survey]);

  const requestClose = () => {
    if (submitting) {
      return;
    }

    if (hasDraftAnswers) {
      setConfirmCloseOpen(true);
      return;
    }

    onClose();
  };

  const confirmDiscardAndClose = () => {
    setConfirmCloseOpen(false);
    onClose();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useBodyScrollLock(open);

  if (!mounted || !open) {
    return null;
  }

  const updateAnswer = (questionId: string, value: SurveyAnswerValue | "") => {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
    if (!isBlank(value)) {
      setMissingQuestionId((current) => (current === questionId ? null : current));
    }
  };

  const toggleMultiChoice = (questionId: string, optionValue: string) => {
    const currentValues = Array.isArray(answers[questionId]) ? answers[questionId] as string[] : [];
    const nextValues = currentValues.includes(optionValue)
      ? currentValues.filter((value) => value !== optionValue)
      : [...currentValues, optionValue];

    setAnswers((current) => {
      return {
        ...current,
        [questionId]: nextValues,
      };
    });
    if (nextValues.length > 0) {
      setMissingQuestionId((current) => (current === questionId ? null : current));
    }
  };

  const getFirstMissingRequiredQuestion = (): SurveyQuestion | null =>
    (survey?.questions || []).find(
      (question) => requiredQuestionIds.has(question.id) && isBlank(answers[question.id])
    ) ?? null;

  const focusQuestionControl = (questionId: string) => {
    const questionNode = questionNodeRefs.current[questionId];
    const focusable = questionNode?.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), button:not([disabled])"
    );
    focusable?.focus({ preventScroll: true });
  };

  const scrollToQuestion = (questionId: string) => {
    setMissingQuestionId(questionId);
    setErrorMessage("");

    window.requestAnimationFrame(() => {
      // nearest กันดึงสกอลล์ทั้งหน้าหลังโมดัล — เลื่อนเฉพาะคอนเทนเนอร์ในโมดัล
      questionNodeRefs.current[questionId]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      window.setTimeout(() => focusQuestionControl(questionId), 260);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!survey || submitting || hasSubmitted) {
      return;
    }

    const missingQuestion = getFirstMissingRequiredQuestion();
    if (!canSubmit || missingQuestion) {
      if (missingQuestion) {
        scrollToQuestion(missingQuestion.id);
      }
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const waveId = "waveId" in survey ? survey.waveId : undefined;
      const payload = {
        ...(waveId ? { waveId } : {}),
        answers: Object.entries(answers)
          .filter(([, value]) => !isBlank(value))
          .map(([questionId, value]) => ({
            questionId,
            value,
          })),
      };

      const response = await api.post<SubmitSurveyResponse>(
        `/api/student/surveys/${survey.id}/responses`,
        payload
      );

      onSubmitted(response.data.response);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "ไม่สามารถส่งแบบสอบถามได้"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (question: SurveyQuestion) => {
    const answer = answers[question.id];

    switch (question.type) {
      case "TEXT":
        return (
          <input
            type="text"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => updateAnswer(question.id, event.target.value)}
            maxLength={2000}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        );
      case "TEXTAREA":
        return (
          <textarea
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => updateAnswer(question.id, event.target.value)}
            rows={4}
            maxLength={8000}
            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        );
      case "SINGLE_CHOICE":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-[#0057A8]/25 hover:bg-[#0057A8]/5"
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === option.value}
                  onChange={() => updateAnswer(question.id, option.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );
      case "MULTIPLE_CHOICE":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((option) => {
              const currentValues = Array.isArray(answer) ? answer : [];

              return (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-[#0057A8]/25 hover:bg-[#0057A8]/5"
                >
                  <input
                    type="checkbox"
                    checked={currentValues.includes(option.value)}
                    onChange={() => toggleMultiChoice(question.id, option.value)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        );
      case "SCALE": {
        const scaleValues = buildScaleValues(question);

        return (
          <div className="flex flex-wrap gap-2">
            {scaleValues.map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`คะแนน ${value}${answer === value ? " (เลือกแล้ว)" : ""}`}
                aria-pressed={answer === value}
                onClick={() => updateAnswer(question.id, value)}
                className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-4 text-sm font-black transition-colors ${
                  answer === value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-[#0057A8]/25 hover:bg-[#0057A8]/5"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        );
      }
      case "NUMBER":
        return (
          <input
            type="number"
            min={question.minValue ?? undefined}
            max={question.maxValue ?? undefined}
            value={typeof answer === "number" || typeof answer === "string" ? answer : ""}
            onChange={(event) =>
              updateAnswer(question.id, event.target.value === "" ? "" : Number(event.target.value))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        );
      case "DATE":
        return (
          <input
            type="date"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => updateAnswer(question.id, event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        );
      default:
        return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden p-4 sm:p-6">
      <button
        type="button"
        aria-label="ปิดแบบสอบถาม"
        className="absolute inset-0 bg-slate-900/45"
        onClick={requestClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative flex min-h-0 max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-20px_rgba(15,23,42,0.35),0_8px_16px_-8px_rgba(15,23,42,0.12)]"
        style={{ animation: "toast-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-sky-50 to-white px-5 py-4 sm:gap-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <h3 className="flex min-w-0 items-center gap-2 text-base font-bold leading-snug text-slate-900 sm:text-lg">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0057A8] text-white">
                  <ClipboardList className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 truncate">{survey?.title || "แบบสอบถาม"}</span>
              </h3>
              {survey?.description ? (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 sm:line-clamp-3 sm:text-sm sm:leading-6">
                  {survey.description}
                </p>
              ) : null}
              {survey && !hasSubmitted && totalQuestionCount > 0 ? (
                <p className="mt-2 text-xs font-semibold text-[#0057A8]" aria-live="polite">
                  ความคืบหน้า {answeredCount}/{totalQuestionCount} ข้อ
                  {missingRequiredCount > 0 ? ` · เหลือบังคับอีก ${missingRequiredCount}` : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="ปิดแบบสอบถาม"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {survey && !hasSubmitted && totalQuestionCount > 0 ? (
            <div className="h-1.5 shrink-0 bg-blue-900/30" aria-hidden="true">
              <div
                className="h-full bg-cyan-300 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round((answeredCount / totalQuestionCount) * 100)}%` }}
              />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 sm:space-y-5 sm:p-6">
            {!survey ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                ยังไม่มีแบบสอบถามที่เปิดใช้งานในขณะนี้
              </div>
            ) : hasSubmitted ? (
              <div className="space-y-4">
                {survey.description ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    <p className="font-bold text-slate-800">เกณฑ์ของแบบประเมินนี้</p>
                    <p className="mt-2 whitespace-pre-line">{survey.description}</p>
                  </div>
                ) : null}
                <InlineAlert tone="success" className="p-5 text-emerald-900">
                  <p className="font-black">ส่งแบบสอบถามแล้ว</p>
                  <p className="mt-1 font-normal">เวลาส่ง: {formatThaiDateTime(submittedAt)}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-3">
                      <p className="text-xs font-semibold text-emerald-800/80">คะแนนรวม</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">
                        {result?.totalScore != null
                          ? `${result.totalScore}${result.maxScore != null && result.maxScore > 0 ? ` / ${result.maxScore}` : ""}`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-3">
                      <p className="text-xs font-semibold text-emerald-800/80">ผลตามเกณฑ์</p>
                      <p className="mt-1 text-sm font-bold leading-snug text-emerald-950">
                        {result?.distressLabel ||
                          (result?.totalScore != null ? "ดูรายละเอียดเกณฑ์ในแบบประเมิน" : "บันทึกคำตอบแล้ว")}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 font-normal leading-6">
                    ขอบคุณที่สละเวลา หากต้องการพูดคุยเพิ่มเติม สามารถขอคำปรึกษาจากทีมดูแลได้ทุกเมื่อ
                  </p>
                </InlineAlert>
              </div>
            ) : (
              survey.questions.map((question, index) => {
                const isMissingQuestion = missingQuestionId === question.id;

                return (
                <section
                  key={question.id}
                  ref={(node) => {
                    questionNodeRefs.current[question.id] = node;
                  }}
                  className={`scroll-mt-8 rounded-xl border bg-white p-4 shadow-sm transition-colors sm:p-5 ${
                    isMissingQuestion
                      ? "border-red-300 ring-4 ring-red-100"
                      : "border-slate-200"
                  }`}
                >
                  <div className="mb-4">
                    <p className={`text-[15px] font-bold ${isMissingQuestion ? "text-red-700" : "text-slate-900"}`}>
                      {index + 1}. {question.prompt}
                      {question.isRequired ? <span className="ml-1 text-red-500">*</span> : null}
                    </p>
                    {question.description ? (
                      <p className="mt-1 text-sm leading-6 text-slate-500">{question.description}</p>
                    ) : null}
                  </div>
                  {renderQuestionInput(question)}
                </section>
                );
              })
            )}

            {errorMessage ? <InlineAlert className="p-4">{errorMessage}</InlineAlert> : null}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:p-5">
            <button
              type="button"
              onClick={requestClose}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 sm:w-1/3"
            >
              ปิด
            </button>
            {survey && !hasSubmitted ? (
              <div className="w-full sm:w-2/3">
                <button
                  type="submit"
                  disabled={submitting}
                  aria-disabled={!canSubmit}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none ${
                    canSubmit
                      ? "bg-blue-700 text-white hover:bg-blue-800"
                      : "bg-slate-300 text-slate-600 hover:bg-slate-400 hover:text-white"
                  }`}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  ส่งแบบสอบถาม
                </button>
              </div>
            ) : null}
          </div>
        </form>

      {confirmCloseOpen ? (
        <div
          className="absolute inset-0 z-10 grid place-items-center bg-slate-950/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="survey-discard-title"
          aria-describedby="survey-discard-desc"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_24px_48px_-20px_rgba(15,23,42,0.35)]">
            <h4 id="survey-discard-title" className="text-lg font-bold text-slate-900">
              ทิ้งคำตอบที่กรอกไว้?
            </h4>
            <p id="survey-discard-desc" className="mt-2 text-sm leading-6 text-slate-600">
              คุณตอบไปแล้ว {answeredCount} ข้อ หากปิดตอนนี้คำตอบจะไม่ถูกบันทึก
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row-reverse sm:justify-center">
              <button
                type="button"
                onClick={confirmDiscardAndClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                ทิ้งคำตอบแล้วปิด
              </button>
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                กลับไปทำต่อ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
