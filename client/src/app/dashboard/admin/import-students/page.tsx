"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Menu,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/auth.context";

type CsvStudentRow = {
  studentId: string;
  name: string;
  email?: string;
  isIncomplete: boolean;
  rowError?: string;
};

type ImportSummary = {
  total: number;
  created: number;
  existing: number;
  failed: number;
};

type ImportResponse = {
  message: string;
  summary: ImportSummary;
  initialPasswordRule: string;
  failures: Array<{ studentId: string; reason: string }>;
  existingStudents: Array<{ studentId: string; reason: string }>;
};

type ExistingCheckResponse = {
  summary: {
    total: number;
    existing: number;
    available: number;
  };
  existingStudents: Array<{
    studentId: string;
    name: string;
    email: string | null;
    reason: string;
  }>;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

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
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length !== 10) {
    throw new Error("รหัสนักศึกษาต้องมี 10 หลัก");
  }
  return `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`;
};

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

  if (studentIdIndex === -1 || nameIndex === -1) {
    return {
      rows: [],
      errors: ["หัวตารางต้องมีอย่างน้อย studentId และ name"],
    };
  }

  const parsedRows: CsvStudentRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const studentIdRaw = cols[studentIdIndex] || "";
    const nameRaw = cols[nameIndex] || "";
    const emailRaw = emailIndex >= 0 ? cols[emailIndex] || "" : "";

    const name = nameRaw.trim();
    const email = emailRaw.trim() || undefined;

    let normalizedStudentId = "";
    let rowError = "";

    if (studentIdRaw.trim().length > 0) {
      try {
        normalizedStudentId = normalizeStudentId(studentIdRaw);
      } catch (error) {
        rowError = error instanceof Error ? error.message : "ข้อมูล studentId ไม่ถูกต้อง";
      }
    }

    if (!studentIdRaw.trim() || !name) {
      rowError = "ข้อมูล studentId หรือ name ว่าง";
    }

    parsedRows.push({
      studentId: normalizedStudentId || studentIdRaw.trim(),
      name,
      email,
      isIncomplete: rowError.length > 0,
      rowError: rowError || undefined,
    });
  }

  return { rows: parsedRows, errors };
};

const formatFileSize = (sizeInBytes: number): string => `${(sizeInBytes / 1024).toFixed(1)} KB`;

export default function ImportStudentsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvFileSize, setCsvFileSize] = useState("");

  const [rows, setRows] = useState<CsvStudentRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");

  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewSection, setShowPreviewSection] = useState(false);

  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [successAnimationKey, setSuccessAnimationKey] = useState(0);
  const [successImportedCount, setSuccessImportedCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [previewExistingStudents, setPreviewExistingStudents] = useState<
    ExistingCheckResponse["existingStudents"]
  >([]);
  const [existingCheckLoading, setExistingCheckLoading] = useState(false);
  const [existingCheckError, setExistingCheckError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/dashboard/admin/manage-students");
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
    () => new Set(previewExistingStudents.map((row) => row.studentId)),
    [previewExistingStudents]
  );

  const availableRowsCount = useMemo(
    () => rows.filter((row) => !row.isIncomplete && !previewExistingStudentIdSet.has(row.studentId)).length,
    [rows, previewExistingStudentIdSet]
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
      availableRowsCount > 0 &&
      !existingCheckLoading &&
      !importing,
    [rows.length, availableRowsCount, incompleteRowsCount, existingCheckLoading, importing]
  );

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
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
    resetParsedState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSelectedFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setServerError("กรุณาอัปโหลดไฟล์ .csv เท่านั้น");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setServerError("ไฟล์มีขนาดใหญ่เกิน 5MB");
      return;
    }

    setServerError("");
    setSelectedFile(file);
    setCsvFileName(file.name);
    setCsvFileSize(formatFileSize(file.size));
    resetParsedState();
  };

  const checkExistingBeforeImport = async (csvRows: CsvStudentRow[]) => {
    setExistingCheckLoading(true);
    setExistingCheckError("");
    setPreviewExistingStudents([]);

    const validStudentIds = csvRows
      .filter((row) => !row.isIncomplete && row.studentId.length > 0)
      .map((row) => row.studentId);

    if (validStudentIds.length === 0) {
      setExistingCheckLoading(false);
      return;
    }

    try {
      const response = await api.post<ExistingCheckResponse>("/api/admin/students/check-existing", {
        studentIds: validStudentIds,
      });
      setPreviewExistingStudents(response.data.existingStudents);
    } catch (_error) {
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
    } catch (_error) {
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
    if (!canImport) {
      if (incompleteRowsCount > 0) {
        setServerError("กรุณาแก้ข้อมูลไม่ครบก่อน จึงจะนำเข้าระบบได้");
      } else {
        setServerError("ไม่พบข้อมูลใหม่ที่นำเข้าได้ (ข้อมูลซ้ำทั้งหมด)");
      }
      return;
    }

    const rowsToImport = rows.filter(
      (row) => !row.isIncomplete && !previewExistingStudentIdSet.has(row.studentId)
    );

    setImporting(true);
    setServerError("");

    try {
      const response = await api.post<ImportResponse>("/api/admin/students/import", {
        rows: rowsToImport,
      });

      if (response.data.summary.failed > 0) {
        setServerError(
          `นำเข้าได้บางส่วน (เพิ่มใหม่ ${response.data.summary.created} รายการ, ไม่สำเร็จ ${response.data.summary.failed} รายการ)`
        );
        return;
      }

      setSuccessImportedCount(response.data.summary.created);
      setSuccessAnimationKey((current) => current + 1);
      setShowImportSuccessModal(true);
      removeFile();
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError("นำเข้าข้อมูลไม่สำเร็จ");
      }
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Admin Only</span>
          </div>
          <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm">หน้านำเข้าข้อมูลนักศึกษาสำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium"
          >
            กลับไป Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div
        className={`fixed inset-0 z-40 bg-gray-900/50 transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={toggleSidebar}
      />

      <div className="flex min-h-screen overflow-x-hidden">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col bg-gray-900 text-white transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 px-5 sm:px-6">
            <h2 className="text-xl font-semibold tracking-wide">Admin Panel</h2>
            <button
              type="button"
              className="text-gray-400 transition-colors hover:text-white lg:hidden"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-2 px-4 py-6">
            <Link href="/dashboard" onClick={closeSidebar} className="block rounded-lg px-4 py-2.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white">
              หน้าหลัก
            </Link>
            <Link href="/dashboard/admin/manage-students" onClick={closeSidebar} className="block rounded-lg px-4 py-2.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white">
              จัดการข้อมูลนักศึกษา
            </Link>
            <span className="block rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white">
              นำเข้านักศึกษา (CSV)
            </span>
          </nav>

          <div className="border-t border-gray-800 p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 transition hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </div>
        </aside>

        <section className="relative flex min-h-screen w-full flex-1 flex-col lg:w-[calc(100%-16rem)]">
          <div
            className={`absolute inset-0 z-[80] flex items-center justify-center p-6 transition-all duration-300 ease-out ${
              showImportSuccessModal
                ? "opacity-100 scale-100"
                : "pointer-events-none opacity-0 scale-95"
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
                  เพิ่มข้อมูลใหม่ {successImportedCount} รายการ
                </span>
              </p>
            </div>
          </div>

          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="text-gray-600 transition-colors hover:text-gray-900 lg:hidden"
                onClick={toggleSidebar}
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="truncate text-lg font-medium text-gray-800 sm:text-xl">นำเข้าข้อมูลนักศึกษาเป็นกลุ่ม (Batch Onboard)</h1>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
              AD
            </div>
          </header>
          <div className="relative mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 md:p-8">

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
                        กรุณาอัปโหลดไฟล์ .csv โดยต้องมีหัวตารางอย่างน้อย studentId และ name ส่วน email ไม่บังคับ
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
                            <p className="font-semibold text-gray-500">email (optional)</p>
                            <p className="mt-1 break-all text-gray-500">somchai.j@university.ac.th</p>
                          </div>
                        </div>
                      </div>

                      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-sm sm:block">
                        <table className="w-full table-fixed text-left">
                          <thead className="bg-gray-100 text-gray-600">
                            <tr>
                              <th className="border-b border-gray-200 px-4 py-2 font-medium">studentId *</th>
                              <th className="border-b border-gray-200 px-4 py-2 font-medium">name *</th>
                              <th className="border-b border-gray-200 px-4 py-2 font-medium">email (optional)</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono text-xs text-gray-600">
                            <tr>
                              <td className="border-b border-gray-100 px-4 py-2">663380595-6</td>
                              <td className="border-b border-gray-100 px-4 py-2">สมชาย ใจดี</td>
                              <td className="border-b border-gray-100 px-4 py-2 text-gray-400">somchai.j@university.ac.th</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm sm:p-8">
                  <div
                    className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 transition-all duration-200 sm:p-12 ${
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
                      className="relative inline-flex items-center justify-center rounded-xl bg-gray-900 px-6 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="mx-auto text-center">{previewing ? "กำลังตรวจสอบ..." : "ตรวจสอบข้อมูล"}</span>
                      {previewing && <span className="spinner absolute right-3.5" />}
                    </button>
                  </div>
                </section>
              </>
            )}

            {showPreviewSection && (
              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-8">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">พรีวิวข้อมูลก่อนนำเข้า</h2>
                    <p className="mt-1 text-sm text-gray-500">กรุณาตรวจสอบความถูกต้องและข้อมูลซ้ำก่อนนำเข้าจริง</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-green-800">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      พร้อมนำเข้า: <span className="font-bold">{availableRowsCount}</span> รายการ
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-orange-800">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                      ข้อมูลซ้ำ: <span className="font-bold">{duplicateRowsCount}</span> รายการ
                    </div>
                  </div>
                </div>

                {incompleteRowsCount > 0 && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    กรุณาแก้ข้อมูลไม่ครบก่อนนำเข้า: ข้อมูลไม่ครบ {incompleteRowsCount} รายการ
                  </div>
                )}

                {incompleteRowsCount === 0 && duplicateRowsCount > 0 && (
                  <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                    พบข้อมูลซ้ำ {duplicateRowsCount} รายการ ระบบจะข้ามรายการซ้ำและนำเข้าเฉพาะรายการใหม่
                  </div>
                )}

                {parseErrors.length > 0 && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-medium">พบข้อมูลบางแถวไม่สมบูรณ์ และจะไม่ถูกนำเข้า</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {parseErrors.slice(0, 10).map((errorMessage) => (
                        <li key={errorMessage}>{errorMessage}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {existingCheckError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {existingCheckError}
                  </div>
                )}

                <div className="mb-6 max-h-80 overflow-y-auto overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-gray-600">
                      <tr>
                        <th className="w-16 px-4 py-3 text-center font-medium">ลำดับ</th>
                        <th className="px-4 py-3 font-medium">รหัสนักศึกษา</th>
                        <th className="px-4 py-3 font-medium">ชื่อ-นามสกุล</th>
                        <th className="px-4 py-3 font-medium">อีเมล</th>
                        <th className="px-4 py-3 font-medium">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {rows.map((row, index) => {
                        const duplicated = !row.isIncomplete && previewExistingStudentIdSet.has(row.studentId);

                        return (
                          <tr key={`${row.studentId}-${index}`} className="transition-colors hover:bg-gray-50">
                            <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-800">{row.studentId || "-"}</td>
                            <td className="px-4 py-3 text-gray-800">{row.name || "-"}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{row.email || "-"}</td>
                            <td className="px-4 py-3">
                              {row.isIncomplete ? (
                                <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                  ข้อมูลไม่ครบ
                                </span>
                              ) : duplicated ? (
                                <span className="inline-flex rounded-md border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                                  ข้อมูลซ้ำ (ข้าม)
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
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
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
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    อัปโหลดไฟล์ใหม่
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!canImport}
                    className="relative inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-green-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="mx-auto text-center">{importing ? "กำลังบันทึกข้อมูล..." : "ยืนยันนำเข้าข้อมูล"}</span>
                    {importing && <span className="spinner absolute right-3.5" />}
                    {existingCheckLoading && !importing && (
                      <Loader2 className="absolute right-3.5 h-4 w-4 animate-spin" />
                    )}
                  </button>
                </div>
              </section>
            )}

            {serverError && (
              <section className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{serverError}</p>
              </section>
            )}
          </div>
        </section>
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

        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 9999px;
          border-top: 3px solid #ffffff;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes stroke {
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </main>
  );
}
