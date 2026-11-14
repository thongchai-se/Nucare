"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FileSpreadsheet,
  Upload,
  ShieldAlert,
  X,
} from "lucide-react";
import api from "@/lib/axios";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { useAuth } from "@/context/auth.context";
import { AdminShell } from "@/components/admin-shell";
import { InlineAlert } from "@/components/ui/inline-alert";
import { normalizeImportedStudentName } from "@/lib/name-prefix";
import { normalizeStudyYear } from "@/lib/study-year";
import { formatStudentIdDisplay } from "@/lib/student-id";

type CsvStudentRow = {
  studentId: string;
  name: string;
  email: string;
  studyYear: number | null;
  section: string;
  isIncomplete: boolean;
  rowError?: string;
};

type ImportOutcome = "success" | "partial" | "failed";

type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  outcome: ImportOutcome;
};

type ImportResponse = {
  message: string;
  summary: ImportSummary;
  onboardingHint?: string;
  createdCredentials?: Array<{ studentId: string; temporaryPassword: string }>;
  failures: Array<{ studentId: string; reason: string }>;
  updatedStudents: Array<{ studentId: string; reason: string }>;
  skippedStudents: Array<{ studentId: string; reason: string }>;
};

const downloadCredentialCsv = (filename: string, header: string, rows: string[]) => {
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

type ExistingCheckResponse = {
  summary: {
    total: number;
    existing: number;
    available: number;
  };
  existingStudents: Array<{
    studentId: string | null;
    name: string;
    email: string | null;
    studyYear: number | null;
    section: string | null;
    reason: string;
  }>;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const IMPORT_CHUNK_SIZE = 100;
const STUDENT_ID_PATTERN = /^\d{9}-\d$/;
const STUDENT_ID_FORMAT_MESSAGE = "รหัสนักศึกษาต้องอยู่ในรูปแบบ 663380696-6";
const SECTION_REQUIRED_MESSAGE = "กรุณาระบุเซคหรือกลุ่ม";

const normalizeHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const findHeaderIndex = (headers: string[], aliases: string[]): number => {
  const aliasSet = new Set(aliases.map((item) => normalizeHeader(item)));
  return headers.findIndex((header) => aliasSet.has(normalizeHeader(header)));
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
};

const normalizeStudentId = (raw: string): string => {
  const normalized = raw.trim();
  if (!STUDENT_ID_PATTERN.test(normalized)) {
    throw new Error(STUDENT_ID_FORMAT_MESSAGE);
  }
  return normalized;
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeComparableSection = (value: string | null | undefined): string =>
  (value || "").trim().toLowerCase();

const parseCsvStudents = (csvText: string): { rows: CsvStudentRow[]; errors: string[] } => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["ไฟล์ CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว"] };
  }

  const headers = parseCsvLine(lines[0]);
  const studentIdIndex = findHeaderIndex(headers, ["studentId", "student_id", "รหัสนักศึกษา"]);
  const nameIndex = findHeaderIndex(headers, ["name", "fullname", "ชื่อ", "ชื่อสกุล", "ชื่อ-นามสกุล"]);
  const emailIndex = findHeaderIndex(headers, ["email", "mail", "อีเมล"]);
  const studyYearIndex = findHeaderIndex(headers, ["studyYear", "study_year", "year", "yearLevel", "ชั้นปี"]);
  const sectionIndex = findHeaderIndex(headers, ["section", "group", "sec", "กลุ่ม", "เซค"]);

  if (studentIdIndex === -1 || nameIndex === -1 || emailIndex === -1 || studyYearIndex === -1 || sectionIndex === -1) {
    return {
      rows: [],
      errors: ["หัวตารางต้องมี studentId, name, email, studyYear และ section"],
    };
  }

  const parsedRows: CsvStudentRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const studentIdRaw = cols[studentIdIndex] || "";
    const nameRaw = cols[nameIndex] || "";
    const emailRaw = cols[emailIndex] || "";
    const studyYearRaw = cols[studyYearIndex] || "";
    const sectionRaw = cols[sectionIndex] || "";

    const name = normalizeImportedStudentName(nameRaw);
    const email = emailRaw.trim();
    const section = sectionRaw.trim();

    let normalizedStudentId = "";
    let studyYear: number | null = null;
    let rowError = "";

    if (studentIdRaw.trim().length > 0) {
      try {
        normalizedStudentId = normalizeStudentId(studentIdRaw);
      } catch (error) {
        rowError = error instanceof Error ? error.message : "ข้อมูล studentId ไม่ถูกต้อง";
      }
    }

    if (!rowError && (!studentIdRaw.trim() || !name || !email || !studyYearRaw.trim() || !section)) {
      rowError = "ข้อมูล studentId, name, email, studyYear หรือ section ว่าง";
    }

    if (!rowError && !isValidEmail(email)) {
      rowError = "รูปแบบอีเมลไม่ถูกต้อง";
    }

    if (!rowError) {
      try {
        studyYear = normalizeStudyYear(studyYearRaw);
      } catch (error) {
        rowError = error instanceof Error ? error.message : "ข้อมูลชั้นปีไม่ถูกต้อง";
      }
    }

    if (!rowError && !section) {
      rowError = SECTION_REQUIRED_MESSAGE;
    }

    if (!rowError && section.length > 50) {
      rowError = "เซคหรือกลุ่มยาวเกิน 50 ตัวอักษร";
    }

    parsedRows.push({
      studentId: normalizedStudentId || studentIdRaw.trim(),
      name,
      email,
      studyYear,
      section,
      isIncomplete: rowError.length > 0,
      rowError: rowError || undefined,
    });
  }

  return { rows: parsedRows, errors };
};

const formatFileSize = (sizeInBytes: number): string => `${(sizeInBytes / 1024).toFixed(1)} KB`;

const normalizeComparableEmail = (value: string | null | undefined): string =>
  (value || "").trim().toLowerCase();

const isSameStudentProfile = (
  existing: ExistingCheckResponse["existingStudents"][number],
  row: CsvStudentRow
): boolean =>
  existing.name.trim() === row.name &&
  normalizeComparableEmail(existing.email) === normalizeComparableEmail(row.email) &&
  existing.studyYear === row.studyYear &&
  normalizeComparableSection(existing.section) === normalizeComparableSection(row.section);

export default function ImportStudentsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvFileSize, setCsvFileSize] = useState("");

  const [rows, setRows] = useState<CsvStudentRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [serverNotice, setServerNotice] = useState("");

  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewSection, setShowPreviewSection] = useState(false);

  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [successAnimationKey, setSuccessAnimationKey] = useState(0);
  const [successImportedCount, setSuccessImportedCount] = useState(0);
  const [successUpdatedCount, setSuccessUpdatedCount] = useState(0);
  const [showImportProgressOverlay, setShowImportProgressOverlay] = useState(false);
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [importProgressCurrent, setImportProgressCurrent] = useState(0);
  const [importProgressTotal, setImportProgressTotal] = useState(0);
  const [previewExistingStudents, setPreviewExistingStudents] = useState<
    ExistingCheckResponse["existingStudents"]
  >([]);
  const [existingCheckLoading, setExistingCheckLoading] = useState(false);
  const [existingCheckError, setExistingCheckError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(UNAUTHENTICATED_PATH);
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/admin");
    router.prefetch("/admin/manage-students");
    router.prefetch("/admin/import-staff");
  }, [router]);

  useEffect(() => {
    if (!showImportSuccessModal) {
      return;
    }

    const timer = setTimeout(() => {
      setShowImportSuccessModal(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showImportSuccessModal]);

  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);

  const previewExistingStudentIdSet = useMemo(
    () => new Set(previewExistingStudents.map((row) => row.studentId).filter((value): value is string => Boolean(value))),
    [previewExistingStudents]
  );

  const previewExistingByStudentId = useMemo(
    () =>
      new Map(
        previewExistingStudents
          .filter((row): row is ExistingCheckResponse["existingStudents"][number] & { studentId: string } =>
            Boolean(row.studentId)
          )
          .map((row) => [row.studentId, row] as const)
      ),
    [previewExistingStudents]
  );

  const previewEmailOwnerByEmail = useMemo(
    () =>
      new Map(
        previewExistingStudents
          .filter((row) => Boolean(row.email))
          .map((row) => [normalizeComparableEmail(row.email), row.studentId] as const)
      ),
    [previewExistingStudents]
  );

  const unchangedRowsCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.isIncomplete) {
          return false;
        }

        const existing = previewExistingByStudentId.get(row.studentId);
        if (!existing) {
          return false;
        }

        return isSameStudentProfile(existing, row);
      }).length,
    [rows, previewExistingByStudentId]
  );

  const updateRowsCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.isIncomplete) {
          return false;
        }

        const existing = previewExistingByStudentId.get(row.studentId);
        if (!existing) {
          return false;
        }

        return !isSameStudentProfile(existing, row);
      }).length,
    [rows, previewExistingByStudentId]
  );

  const availableRowsCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.isIncomplete) {
          return false;
        }

        if (previewExistingStudentIdSet.has(row.studentId)) {
          return false;
        }

        const emailOwnerStudentId = previewEmailOwnerByEmail.get(normalizeComparableEmail(row.email));
        return !(emailOwnerStudentId !== undefined && emailOwnerStudentId !== row.studentId);
      }).length,
    [rows, previewEmailOwnerByEmail, previewExistingStudentIdSet]
  );

  const emailConflictRowsCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.isIncomplete) {
          return false;
        }

        const emailOwnerStudentId = previewEmailOwnerByEmail.get(normalizeComparableEmail(row.email));
        return emailOwnerStudentId !== undefined && emailOwnerStudentId !== row.studentId;
      }).length,
    [rows, previewEmailOwnerByEmail]
  );

  const importableRows = useMemo(
    () =>
      rows.filter((row) => {
        if (row.isIncomplete) {
          return false;
        }

        const emailOwnerStudentId = previewEmailOwnerByEmail.get(normalizeComparableEmail(row.email));
        if (emailOwnerStudentId !== undefined && emailOwnerStudentId !== row.studentId) {
          return false;
        }

        const existing = previewExistingByStudentId.get(row.studentId);
        if (!existing) {
          return true;
        }

        return !isSameStudentProfile(existing, row);
      }),
    [rows, previewEmailOwnerByEmail, previewExistingByStudentId]
  );

  const importableRowsCount = useMemo(
    () => importableRows.length,
    [importableRows]
  );

  const duplicateRowsCount = useMemo(
    () => rows.filter((row) => !row.isIncomplete && previewExistingStudentIdSet.has(row.studentId)).length,
    [rows, previewExistingStudentIdSet]
  );

  const incompleteRowsCount = useMemo(
    () => rows.filter((row) => row.isIncomplete).length,
    [rows]
  );

  const canImport = useMemo(
    () =>
      rows.length > 0 &&
      incompleteRowsCount === 0 &&
      emailConflictRowsCount === 0 &&
      importableRowsCount > 0 &&
      !existingCheckLoading &&
      !importing,
    [rows.length, incompleteRowsCount, emailConflictRowsCount, importableRowsCount, existingCheckLoading, importing]
  );

  const handleLogout = async () => {
    await logout();
    router.replace(UNAUTHENTICATED_PATH);
  };

  const resetParsedState = () => {
    setRows([]);
    setParseErrors([]);
    setPreviewExistingStudents([]);
    setExistingCheckError("");
    setShowPreviewSection(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setCsvFileName("");
    setCsvFileSize("");
    setServerError("");
    setServerNotice("");
    setShowImportProgressOverlay(false);
    setImportProgressPercent(0);
    setImportProgressCurrent(0);
    setImportProgressTotal(0);
    resetParsedState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSelectedFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setServerError("กรุณาอัปโหลดไฟล์ .csv เท่านั้น");
      setServerNotice("");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setServerError("ไฟล์มีขนาดใหญ่เกิน 5MB");
      setServerNotice("");
      return;
    }

    setServerError("");
    setServerNotice("");
    setSelectedFile(file);
    setCsvFileName(file.name);
    setCsvFileSize(formatFileSize(file.size));
    resetParsedState();
  };

  const checkExistingBeforeImport = async (csvRows: CsvStudentRow[]) => {
    setExistingCheckLoading(true);
    setExistingCheckError("");
    setServerNotice("");
    setPreviewExistingStudents([]);

    const validRows = csvRows
      .filter((row) => !row.isIncomplete && row.studentId.length > 0)
      .map((row) => ({
        studentId: row.studentId,
        email: normalizeComparableEmail(row.email),
      }));

    const validStudentIds = validRows.map((row) => row.studentId);
    const validEmails = validRows.map((row) => row.email);

    if (validStudentIds.length === 0) {
      setExistingCheckLoading(false);
      return;
    }

    try {
      const response = await api.post<ExistingCheckResponse>("/api/admin/students/check-existing", {
        studentIds: validStudentIds,
        emails: validEmails,
      });
      setPreviewExistingStudents(response.data.existingStudents);
    } catch {
      setExistingCheckError("ไม่สามารถตรวจสอบข้อมูลซ้ำกับฐานข้อมูลได้");
    } finally {
      setExistingCheckLoading(false);
    }
  };

  const processPreview = async () => {
    if (!selectedFile) {
      return;
    }

    setPreviewing(true);
    setServerError("");
    setServerNotice("");
    resetParsedState();

    try {
      const csvText = await selectedFile.text();
      const parsed = parseCsvStudents(csvText);

      setRows(parsed.rows);
      setParseErrors(parsed.errors);

      if (parsed.rows.length > 0) {
        await checkExistingBeforeImport(parsed.rows);
      }

      setShowPreviewSection(true);
    } catch {
      setServerError("ไม่สามารถอ่านไฟล์ CSV ได้");
    } finally {
      setPreviewing(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    handleSelectedFile(file);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    handleSelectedFile(file);
  };

  const handleImport = async () => {
    setServerNotice("");

    if (!canImport) {
      if (incompleteRowsCount > 0) {
        setServerError("กรุณาแก้ข้อมูลไม่ครบก่อน จึงจะนำเข้าระบบได้");
      } else if (emailConflictRowsCount > 0) {
        setServerError("พบอีเมลซ้ำกับข้อมูลในระบบ กรุณาแก้ไขในไฟล์ CSV ก่อนนำเข้า");
      } else {
        setServerError("ไม่พบข้อมูลที่มีการเปลี่ยนแปลง จึงไม่ต้องอัปเดต");
      }
      return;
    }

    const rowsToImport = importableRows;
    const totalRows = rowsToImport.length;

    if (totalRows === 0) {
      setServerError("ไม่พบข้อมูลที่ต้องนำเข้าจริง");
      return;
    }

    setImporting(true);
    setServerError("");
    setServerNotice("");
    setImportProgressTotal(totalRows);
    setImportProgressCurrent(0);
    setImportProgressPercent(0);
    setShowImportProgressOverlay(true);

    try {
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      const mergedFailures: ImportResponse["failures"] = [];
      const mergedCredentials: NonNullable<ImportResponse["createdCredentials"]> = [];
      let processedRows = 0;

      for (let index = 0; index < rowsToImport.length; index += IMPORT_CHUNK_SIZE) {
        const chunk = rowsToImport.slice(index, index + IMPORT_CHUNK_SIZE);
        const response = await api.post<ImportResponse>("/api/admin/students/import", {
          rows: chunk,
        });

        totalCreated += response.data.summary.created;
        totalUpdated += response.data.summary.updated;
        totalSkipped += response.data.summary.skipped;
        totalFailed += response.data.summary.failed;
        mergedFailures.push(...response.data.failures);
        if (response.data.createdCredentials?.length) {
          mergedCredentials.push(...response.data.createdCredentials);
        }

        processedRows = Math.min(totalRows, processedRows + chunk.length);
        setImportProgressCurrent(processedRows);
        setImportProgressPercent(Math.min(99, Math.floor((processedRows / totalRows) * 100)));
      }

      setImportProgressCurrent(totalRows);
      setImportProgressPercent(100);

      if (mergedCredentials.length > 0) {
        downloadCredentialCsv(
          `nucare-student-temp-passwords-${Date.now()}.csv`,
          "studentId,temporaryPassword",
          mergedCredentials.map((row) => `${row.studentId},${row.temporaryPassword}`)
        );
      }

      if (totalFailed > 0) {
        const failurePreview = mergedFailures
          .slice(0, 3)
          .map((item) => `${formatStudentIdDisplay(item.studentId)}: ${item.reason}`)
          .join(" | ");

        const partialImportMessage = `นำเข้าได้บางส่วน (เพิ่มใหม่ ${totalCreated} รายการ, อัปเดต ${totalUpdated} รายการ, ข้าม ${totalSkipped} รายการ, ไม่สำเร็จ ${totalFailed} รายการ)${
          failurePreview ? ` | ตัวอย่างปัญหา: ${failurePreview}` : ""
        }${mergedCredentials.length > 0 ? " | ดาวน์โหลดไฟล์รหัสผ่านชั่วคราวแล้ว" : ""}`;

        if (totalCreated + totalUpdated + totalSkipped > 0) {
          setServerNotice(partialImportMessage);
          setServerError("");
        } else {
          setServerError(partialImportMessage);
          setServerNotice("");
        }
        return;
      }

      setServerNotice(
        mergedCredentials.length > 0
          ? "ดาวน์โหลดไฟล์รหัสผ่านชั่วคราวแล้ว — ส่งให้นิสิตครั้งเดียวและแนะนำให้เปลี่ยนรหัสผ่านทันที"
          : ""
      );
      setSuccessImportedCount(totalCreated);
      setSuccessUpdatedCount(totalUpdated);
      setSuccessAnimationKey((current) => current + 1);
      setShowImportSuccessModal(true);
      removeFile();
    } catch (error) {
      setServerNotice("");
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError("นำเข้าข้อมูลไม่สำเร็จ");
      }
    } finally {
      setImporting(false);
      setTimeout(() => {
        setShowImportProgressOverlay(false);
      }, 350);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7  text-blue-600"></span>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-semibold">เฉพาะผู้ดูแลระบบ</span>
          </div>
          <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm">หน้านำเข้าข้อมูลนักศึกษาสำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link
            href="/admin"
            className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium"
          >
            กลับไป Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      activeNav="import"
      onLogout={handleLogout}
      title="นำเข้าข้อมูล"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ (System Admin)"
    >
      <div
        className={`fixed inset-0 z-[220] flex items-center justify-center overflow-hidden bg-slate-950/35 p-3 transition-all duration-300 ease-out sm:p-4 ${
          showImportSuccessModal ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
            <div className="flex flex-col items-center gap-5 rounded-[2rem] border border-gray-100 bg-white/95 px-10 py-8 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] backdrop-blur-sm">
              <svg
                key={successAnimationKey}
                className="checkmark"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 52 52"
                aria-hidden="true"
              >
                <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
              <p className="text-lg font-medium tracking-wide text-gray-800">
                นำเข้าข้อมูลนักศึกษาสำเร็จ!
                <span className="mt-1 block text-sm font-normal text-gray-500">
                  เพิ่มใหม่ {successImportedCount} รายการ และอัปเดต {successUpdatedCount} รายการ
                </span>
              </p>
            </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">นำเข้าข้อมูล (Import Data)</h2>
            <p className="mt-1 text-sm text-slate-500">อัปเดตฐานข้อมูลนักศึกษาผ่านไฟล์ CSV ด้วย flow batch import ที่ทีมทำไว้แล้ว</p>
          </div>
          <Link
            href="/admin/import-staff"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            ไปหน้านำเข้าบุคลากร
          </Link>
        </div>

        <div className="relative">

            {!showPreviewSection && (
              <>
                <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <div className="w-full">
                      <h3 className="mb-2 text-lg font-medium text-gray-800">รูปแบบไฟล์ CSV ที่รองรับ</h3>
                      <p className="mb-4 text-sm leading-relaxed text-gray-600">
                        กรุณาอัปโหลดไฟล์ .csv โดยต้องมีหัวตาราง studentId, name, email, studyYear และ section ครบทุกช่อง
                      </p>
                      <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        บัญชีนักศึกษาที่ถูกสร้างใหม่จากการนำเข้าจะได้ <span className="font-semibold">รหัสผ่านชั่วคราวแบบสุ่ม</span> ในผลลัพธ์หลังนำเข้า และระบบจะบังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก
                      </p>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs sm:hidden">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="rounded-md border border-gray-200 bg-white p-2.5">
                            <p className="font-semibold text-gray-500">studentId *</p>
                            <p className="mt-1 font-mono text-gray-800">663380595-6</p>
                          </div>
                          <div className="rounded-md border border-gray-200 bg-white p-2.5">
                            <p className="font-semibold text-gray-500">name *</p>
                            <p className="mt-1 text-gray-800">สมชาย ใจดี</p>
                          </div>
                          <div className="rounded-md border border-gray-200 bg-white p-2.5">
                            <p className="font-semibold text-gray-500">email *</p>
                            <p className="mt-1 break-all text-gray-800">somchai.j@university.ac.th</p>
                          </div>
                          <div className="rounded-md border border-gray-200 bg-white p-2.5">
                            <p className="font-semibold text-gray-500">studyYear *</p>
                            <p className="mt-1 text-gray-800">2</p>
                          </div>
                          <div className="rounded-md border border-gray-200 bg-white p-2.5">
                            <p className="font-semibold text-gray-500">section *</p>
                            <p className="mt-1 text-gray-800">A</p>
                          </div>
                        </div>
                      </div>

                      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-sm sm:block">
                        <table className="w-full table-fixed text-left">
                          <thead className="bg-gray-100 text-gray-600">
                            <tr>
                              <th className="w-[22%] border-b border-gray-200 px-4 py-2 font-medium">studentId</th>
                              <th className="w-[24%] border-b border-gray-200 px-4 py-2 font-medium">name</th>
                              <th className="w-[24%] border-b border-gray-200 px-4 py-2 font-medium">email</th>
                              <th className="w-[12%] border-b border-gray-200 px-4 py-2 font-medium">studyYear</th>
                              <th className="w-[18%] border-b border-gray-200 px-4 py-2 font-medium">section</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono text-xs text-gray-600">
                            <tr>
                              <td className="border-b border-gray-100 px-4 py-2">663380595-6</td>
                              <td className="border-b border-gray-100 px-4 py-2">สมชาย ใจดี</td>
                              <td className="border-b border-gray-100 px-4 py-2 text-gray-400">somchai.j@university.ac.th</td>
                              <td className="border-b border-gray-100 px-4 py-2">2</td>
                              <td className="border-b border-gray-100 px-4 py-2">A</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm sm:p-8">
                  <div
                    className={`relative flex min-h-[280px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-200 sm:min-h-[340px] sm:p-12 lg:min-h-[400px] ${
                      isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      id="file-upload"
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                    />

                    {!selectedFile ? (
                      <div className="pointer-events-none flex flex-col items-center">
                        <Upload className="mb-4 h-12 w-12 text-gray-400" />
                        <p className="text-lg font-medium text-gray-700">คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวางที่นี่</p>
                        <p className="mt-1 text-sm text-gray-500">รองรับไฟล์ .csv ขนาดไม่เกิน 5MB</p>
                      </div>
                    ) : (
                      <div className="mx-auto flex w-full max-w-md items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="rounded-lg bg-green-50 p-2 text-green-600">
                          <FileSpreadsheet className="h-8 w-8" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium text-gray-800">{csvFileName}</p>
                          <p className="text-xs text-gray-500">{csvFileSize}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeFile();
                          }}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:text-red-500"
                          title="ลบไฟล์"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={removeFile}
                      className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={processPreview}
                      disabled={!selectedFile || previewing}
                      className="inline-flex min-h-11 min-w-[150px] items-center justify-center rounded-xl bg-gray-900 px-6 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {previewing ? <span className="loader h-5 w-5 "></span> : "ตรวจสอบข้อมูล"}
                    </button>
                  </div>
                </section>
              </>
            )}

            {showPreviewSection && (
              <section className="relative flex h-[calc(100dvh-9.5rem)] min-h-[520px] flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:h-[calc(100dvh-11rem)] sm:p-8">
                <div
                  className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 px-6 backdrop-blur-sm transition-all duration-300 ${
                    showImportProgressOverlay ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <div className="w-full max-w-md text-center">
                    <h3 className="text-xl font-semibold text-gray-800">กำลังบันทึกข้อมูลเข้าระบบ...</h3>
                    <p className="mt-2 text-sm text-gray-500">กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้</p>

                    <div className="relative mt-8 h-3 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner">
                      <div
                        className="progress-bar-animated absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${importProgressPercent}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between px-1 text-sm">
                      <span className="text-gray-500">
                        <span className="font-medium text-gray-700">{importProgressCurrent}</span> / {importProgressTotal} รายการ
                      </span>
                      <span className="text-lg font-bold text-blue-600">{importProgressPercent}%</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">พรีวิวข้อมูลก่อนนำเข้า</h2>
                    <p className="mt-1 text-sm text-gray-500">กรุณาตรวจสอบความถูกต้องและข้อมูลซ้ำก่อนนำเข้าจริง</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-green-800">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        เพิ่มใหม่: <span className="font-bold">{availableRowsCount}</span> รายการ
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-orange-800">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        อัปเดต: <span className="font-bold">{updateRowsCount}</span> รายการ
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-gray-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />
                      ไม่เปลี่ยนแปลง: <span className="font-bold">{unchangedRowsCount}</span> รายการ
                    </div>
                    {emailConflictRowsCount > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-red-700">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        อีเมลซ้ำในระบบ: <span className="font-bold">{emailConflictRowsCount}</span> รายการ
                      </div>
                    )}
                  </div>
                </div>

                {incompleteRowsCount > 0 ? (
                  <InlineAlert tone="warning" className="mb-4 p-4">
                    กรุณาแก้ข้อมูลไม่ครบก่อนนำเข้า: ข้อมูลไม่ครบ {incompleteRowsCount} รายการ
                  </InlineAlert>
                ) : null}

                {incompleteRowsCount === 0 && duplicateRowsCount > 0 ? (
                  <InlineAlert tone="warning" className="mb-4 p-4">
                    พบข้อมูลเดิมในระบบ {duplicateRowsCount} รายการ: อัปเดต {updateRowsCount} รายการ และข้าม{" "}
                    {unchangedRowsCount} รายการที่ไม่เปลี่ยนแปลง
                  </InlineAlert>
                ) : null}

                {emailConflictRowsCount > 0 ? (
                  <InlineAlert className="mb-4 p-4">
                    พบอีเมลซ้ำกับข้อมูลที่มีอยู่ในระบบ {emailConflictRowsCount} รายการ กรุณาแก้ไขอีเมลในไฟล์ CSV
                    ก่อนนำเข้า
                  </InlineAlert>
                ) : null}

                {parseErrors.length > 0 ? (
                  <InlineAlert className="mb-4 p-4">
                    <p>พบข้อมูลบางแถวไม่สมบูรณ์ และจะไม่ถูกนำเข้า</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 font-normal">
                      {parseErrors.slice(0, 10).map((errorMessage) => (
                        <li key={errorMessage}>{errorMessage}</li>
                      ))}
                    </ul>
                  </InlineAlert>
                ) : null}

                {existingCheckError ? (
                  <InlineAlert className="mb-4 p-4">{existingCheckError}</InlineAlert>
                ) : null}

                <div className="mb-6 min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-16" />
                      <col className="w-[18%]" />
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-gray-600">
                      <tr>
                        <th className="w-16 px-4 py-3 text-center font-medium">ลำดับ</th>
                        <th className="px-4 py-3 font-medium">รหัสนักศึกษา</th>
                        <th className="px-4 py-3 font-medium">ชื่อ-นามสกุล</th>
                        <th className="px-4 py-3 font-medium">อีเมล</th>
                        <th className="px-4 py-3 font-medium">ชั้นปี</th>
                        <th className="px-4 py-3 font-medium">เซค/กลุ่ม</th>
                        <th className="px-4 py-3 font-medium">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {rows.map((row, index) => {
                        const duplicated = !row.isIncomplete && previewExistingStudentIdSet.has(row.studentId);
                        const existing = duplicated ? previewExistingByStudentId.get(row.studentId) : undefined;
                        const unchanged = existing ? isSameStudentProfile(existing, row) : false;
                        const emailOwnerStudentId = previewEmailOwnerByEmail.get(
                          normalizeComparableEmail(row.email)
                        );
                        const emailConflict =
                          !row.isIncomplete &&
                          emailOwnerStudentId !== undefined &&
                          emailOwnerStudentId !== row.studentId;

                        return (
                          <tr key={`${row.studentId}-${index}`} className="transition-colors hover:bg-gray-50">
                            <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-800">
                              {formatStudentIdDisplay(row.studentId)}
                            </td>
                            <td className="px-4 py-3 text-gray-800">
                              <p className="truncate">{row.name || "-"}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              <p className="truncate">{row.email || "-"}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{row.studyYear ?? "-"}</td>
                            <td className="px-4 py-3 text-gray-700">
                              <p className="truncate">{row.section || "-"}</p>
                            </td>
                            <td className="px-4 py-3">
                              {row.isIncomplete ? (
                                <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                  ข้อมูลไม่ครบ
                                </span>
                              ) : emailConflict ? (
                                <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                  อีเมลซ้ำในระบบ
                                </span>
                              ) : unchanged ? (
                                <span className="inline-flex rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                                  ไม่เปลี่ยนแปลง (ข้าม)
                                </span>
                              ) : duplicated ? (
                                <span className="inline-flex rounded-md border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                                  พบในระบบ (อัปเดต)
                                </span>
                              ) : (
                                <span className="inline-flex rounded-md border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                                  พร้อมนำเข้า
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                            ไม่พบข้อมูลที่พร้อมสำหรับพรีวิว
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={importing}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    อัปโหลดไฟล์ใหม่
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!canImport || importing}
                    className="inline-flex min-h-11 min-w-[170px] items-center justify-center rounded-xl bg-green-600 px-6 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-green-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importing || existingCheckLoading ? (
                      <span className="loader h-5 w-5 "></span>
                    ) : (
                      "ยืนยันนำเข้าข้อมูล"
                    )}
                  </button>
                </div>
              </section>
            )}

            {serverNotice ? (
              <InlineAlert tone="warning" className="mt-4 rounded-2xl p-5">
                {serverNotice}
              </InlineAlert>
            ) : null}

            {serverError ? (
              <InlineAlert className="mt-4 rounded-2xl p-5">{serverError}</InlineAlert>
            ) : null}
        </div>
      </div>

      <style jsx>{`
        .checkmark {
          width: 56px;
          height: 56px;
          margin-left: auto;
          margin-right: auto;
          border-radius: 9999px;
          display: block;
          stroke-width: 2.5;
          stroke: #10b981;
          stroke-miterlimit: 10;
        }

        .checkmark-circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 2.5;
          stroke: #10b981;
          fill: none;
          animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .checkmark-check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
        }

        .progress-bar-animated {
          background-image: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.15) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.15) 75%,
            transparent 75%,
            transparent
          );
          background-size: 1rem 1rem;
          animation: progress-stripes 1s linear infinite;
        }

        @keyframes progress-stripes {
          from {
            background-position: 1rem 0;
          }

          to {
            background-position: 0 0;
          }
        }

        @keyframes stroke {
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </AdminShell>
  );
}

