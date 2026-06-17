"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, Loader2, Send, X } from "lucide-react";
import api from "@/lib/axios";
import type {
  ActiveStudentSurveyResult,
  Survey,
  SurveyAnswerValue,
  SurveyQuestion,
} from "@/types/survey";

type OrientationSurveyModalProps = {
  hasSubmitted: boolean;
  onClose: () => void;
  onSubmitted: (response: ActiveStudentSurveyResult) => void;
  open: boolean;
  submittedAt: string | null;
  survey: Survey | null;
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

const buildInitialAnswers = (survey: Survey | null): AnswerState => {
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
  submittedAt,
  survey,
}: OrientationSurveyModalProps) {
  const [answers, setAnswers] = useState<AnswerState>(() => buildInitialAnswers(survey));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [missingQuestionId, setMissingQuestionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const questionNodeRefs = useRef<Record<string, HTMLElement | null>>({});

  const requiredQuestionIds = useMemo(
    () => new Set((survey?.questions || []).filter((question) => question.isRequired).map((question) => question.id)),
    [survey?.questions]
  );
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
    }
  }, [open, survey]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
      questionNodeRefs.current[questionId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
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
      const payload = {
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
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50"
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
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50"
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
                onClick={() => updateAnswer(question.id, value)}
                className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-4 text-sm font-black transition-colors ${
                  answer === value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50"
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
    <div className="fixed inset-0" style={{ inset: 0, position: "fixed", zIndex: 10000 }}>
      <button
        type="button"
        aria-label="close orientation survey"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        style={{ inset: 0, position: "fixed" }}
        onClick={onClose}
      />

      <div
        className="fixed inset-0 grid place-items-center overflow-y-auto overscroll-contain p-3 sm:p-4"
        style={{ inset: 0, position: "fixed", zIndex: 1 }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 bg-blue-700 px-4 py-3 text-white sm:gap-4 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h3 className="flex min-w-0 items-center gap-2 text-base font-bold leading-snug sm:text-lg">
                <ClipboardList className="h-4 w-4 shrink-0 text-blue-200 sm:h-5 sm:w-5" />
                <span className="min-w-0 truncate">{survey?.title || "แบบสอบถาม"}</span>
              </h3>
              {survey?.description ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-blue-100 sm:line-clamp-3 sm:text-sm sm:leading-6">
                  {survey.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-blue-200 transition-colors hover:bg-blue-600 hover:text-white"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 sm:space-y-5 sm:p-6">
            {!survey ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                ยังไม่มีแบบสอบถามที่เปิดใช้งานในขณะนี้
              </div>
            ) : hasSubmitted ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                <p className="text-sm font-black">ส่งแบบสอบถามแล้ว</p>
                <p className="mt-1 text-sm">เวลาส่ง: {formatThaiDateTime(submittedAt)}</p>
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

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:p-5">
            <button
              type="button"
              onClick={onClose}
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
      </div>
    </div>,
    document.body
  );
}
