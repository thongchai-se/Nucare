"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  FileText,
  HeartPulse,
  History,
  LogOut,
  Menu,
  Phone,
  Plus,
  Search,
  Send,
  ShieldAlert,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";

type StudentRiskLevel = "high" | "medium" | "normal";

type AdvisorStudent = {
  id: string;
  studentId: string | null;
  name: string;
  year: string;
  riskLevel: StudentRiskLevel;
  lastAssessment: string | null;
  careRecordCount: number;
  image: string;
};

type AdvisorHistoryItem = {
  id: string;
  kind: "CARE" | "REFERRAL";
  date: string;
  type: string;
  topic: string;
  action: string;
  outcome: string | null;
  advisorName: string;
  isUrgent: boolean;
};

type ToastState = {
  show: boolean;
  msg: string;
  type: "success" | "info";
};

const advisorRoles = new Set(["ADVISOR"]);

type AdvisorStudentsResponse = {
  students: AdvisorStudent[];
  total: number;
};

type StudentHistoryResponse = {
  student: AdvisorStudent;
  history: AdvisorHistoryItem[];
};

const formatThaiDate = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getErrorMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "เกิดข้อผิดพลาด";
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
};

const getRoleSubtitle = (role: string | undefined): string => {
  return "อาจารย์ที่ปรึกษา";
};

const formatStudentIdDisplay = (studentId: string | null | undefined): string => {
  if (!studentId) {
    return "-";
  }

  if (/^\d{9}-\d$/.test(studentId)) {
    return studentId;
  }

  if (/^\d{10}$/.test(studentId)) {
    return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
  }

  return studentId;
};

export default function AdvisorDashboardPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();

  const [students, setStudents] = useState<AdvisorStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<AdvisorHistoryItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState<ToastState>({ show: false, msg: "", type: "success" });

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") {
      router.replace("/dashboard/admin");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "EXECUTIVE") {
      router.replace("/dashboard/executive");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "MENTAL_HEALTH") {
      router.replace("/dashboard/mental-health");
      return;
    }

    if (!loading && user?.role === "INSTRUCTOR") {
      router.replace("/dashboard/instructor");
      return;
    }

    if (!loading && user && !advisorRoles.has(user.role)) {
      router.replace("/dashboard/student");
    }
  }, [loading, router, user]);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    setServerError("");

    try {
      const response = await api.get<AdvisorStudentsResponse>("/api/advisor/students");
      const nextStudents = response.data.students;

      setStudents(nextStudents);
      setSelectedStudentId((previousSelected) => {
        if (!previousSelected) {
          return nextStudents[0]?.id ?? null;
        }

        const stillExists = nextStudents.some((student) => student.id === previousSelected);
        return stillExists ? previousSelected : (nextStudents[0]?.id ?? null);
      });
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const loadStudentHistory = useCallback(async (studentId: string) => {
    setLoadingHistory(true);

    try {
      const response = await api.get<StudentHistoryResponse>(`/api/advisor/students/${studentId}/history`);
      setHistoryItems(response.data.history);

      // Keep list data in sync after mutations done by other advisors.
      const refreshedStudent = response.data.student;
      setStudents((previous) =>
        previous.map((student) =>
          student.id === refreshedStudent.id
            ? {
                ...student,
                ...refreshedStudent,
              }
            : student
        )
      );
    } catch (error) {
      setHistoryItems([]);
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (loading || !user || !advisorRoles.has(user.role)) {
      return;
    }

    void loadStudents();
  }, [loading, user, loadStudents]);

  useEffect(() => {
    if (!selectedStudentId) {
      setHistoryItems([]);
      return;
    }

    void loadStudentHistory(selectedStudentId);
  }, [selectedStudentId, loadStudentHistory]);

  useEffect(() => {
    if (!toast.show) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast({ show: false, msg: "", type: "success" });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast.show]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return students;
    }

    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(normalizedQuery) ||
        formatStudentIdDisplay(student.studentId).includes(normalizedQuery)
    );
  }, [searchQuery, students]);

  const showToast = (msg: string, type: "success" | "info" = "success") => {
    setToast({ show: true, msg, type });
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleSaveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedStudent) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      await api.post(`/api/advisor/students/${selectedStudent.id}/care-records`, {
        careDate: String(formData.get("careDate") || ""),
        careType: String(formData.get("careType") || ""),
        topic: String(formData.get("topic") || ""),
        action: String(formData.get("action") || ""),
        outcome: String(formData.get("outcome") || ""),
      });

      setIsRecordModalOpen(false);
      showToast("บันทึกข้อมูลการดูแลลงระบบเรียบร้อยแล้ว");
      await Promise.all([loadStudents(), loadStudentHistory(selectedStudent.id)]);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  const handleReferral = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedStudent) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      await api.post(`/api/advisor/students/${selectedStudent.id}/referrals`, {
        target: String(formData.get("target") || ""),
        reason: String(formData.get("reason") || ""),
        isUrgent: Boolean(formData.get("urgent")),
      });

      setIsReferralModalOpen(false);
      showToast("ส่งต่อข้อมูลนักศึกษาสำเร็จ ทีมงานจะได้รับการแจ้งเตือนทันที", "info");
      await loadStudentHistory(selectedStudent.id);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  const handleSelectStudent = (student: AdvisorStudent) => {
    setSelectedStudentId(student.id);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <Activity className="h-7 w-7 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!advisorRoles.has(user.role)) {
    return null;
  }

  const subtitle = getRoleSubtitle(user.role);

  const SidebarContent = () => (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-blue-800 bg-blue-700 p-5 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Teacher Portal</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md p-1.5 transition-colors hover:bg-blue-600"
          title="ออกจากระบบ"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <div className="shrink-0 border-b border-slate-100 bg-white p-5">
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            {(user.name || "อจ")
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0] || "")
              .join("")
              .toUpperCase() || "อจ"}
          </div>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50/50 p-3">
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">นักศึกษาในที่ปรึกษา</p>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
            {filteredStudents.length}
          </span>
        </div>

        {filteredStudents.length > 0 ? (
          filteredStudents.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => handleSelectStudent(student)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                selectedStudent?.id === student.id
                  ? "border-blue-200 bg-blue-50 shadow-sm ring-1 ring-blue-500/20"
                  : "border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="relative shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                    selectedStudent?.id === student.id
                      ? "bg-blue-200 text-blue-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {student.image}
                </div>
                {student.riskLevel === "high" && (
                  <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500" />
                )}
                {student.riskLevel === "medium" && (
                  <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500" />
                )}
                {student.riskLevel === "normal" && (
                  <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-bold ${
                    selectedStudent?.id === student.id ? "text-blue-900" : "text-slate-800"
                  }`}
                >
                  {student.name}
                </p>
                <p className="text-xs font-medium text-slate-500">{formatStudentIdDisplay(student.studentId)}</p>
              </div>
            </button>
          ))
        ) : (
          <div className="px-4 py-10 text-center">
            <Search className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">ไม่พบรายชื่อนักศึกษา</p>
            <p className="mt-1 text-xs text-slate-500">ลองค้นหาด้วยคำอื่น หรือตรวจสอบรหัสอีกครั้ง</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-100/50 font-sans text-slate-800 md:flex-row">
      <div
        className={`fixed right-6 top-6 z-[100] transform transition-all duration-300 ${
          toast.show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <div className="flex min-w-[280px] items-center gap-3 rounded-lg border-l-4 border-emerald-500 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-slate-800">{toast.msg}</p>
        </div>
      </div>

      <div className="sticky top-0 z-30 flex items-center justify-between bg-blue-700 p-4 text-white shadow-md md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Teacher Portal</span>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="rounded-lg bg-blue-600 p-2 transition-colors hover:bg-blue-500"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[280px] shrink-0 transform flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[320px] lg:w-[340px] md:relative md:translate-x-0 md:shadow-none ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="absolute right-4 top-4 z-50 rounded-lg bg-blue-800/50 p-2 text-white md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent />
      </aside>

      <main className="flex h-[calc(100vh-64px)] w-full min-w-0 flex-1 flex-col overflow-y-auto md:h-screen">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
          {serverError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {serverError}
            </div>
          )}

          {loadingStudents && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600">
              <Activity className="h-4 w-4 animate-spin text-blue-600" /> กำลังโหลดข้อมูลนักศึกษา...
            </div>
          )}

          {selectedStudent ? (
            <div className="space-y-6 sm:space-y-8">
              <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-6 flex flex-col justify-between gap-6 border-b border-slate-100 pb-6 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-slate-100 to-slate-200 text-xl font-bold text-slate-500 shadow-md sm:h-20 sm:w-20 sm:text-2xl">
                      {selectedStudent.image}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h2 className="mb-1.5 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
                        {selectedStudent.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500 sm:gap-3">
                        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                          <User className="h-3.5 w-3.5" /> {formatStudentIdDisplay(selectedStudent.studentId)}
                        </span>
                        <span className="whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                          ชั้นปีที่ {selectedStudent.year}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 flex-row gap-2 sm:gap-3 lg:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsRecordModalOpen(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-700 px-3 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-800 hover:shadow-lg active:scale-[0.98] sm:px-5 sm:py-3 sm:text-[15px] lg:flex-none"
                    >
                      <Plus className="h-4 w-4 shrink-0" /> บันทึกการดูแล
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsReferralModalOpen(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-red-100 bg-white px-3 py-2.5 text-sm font-bold text-red-600 transition-all hover:border-red-200 hover:bg-red-50 active:scale-[0.98] sm:px-5 sm:py-3 sm:text-[15px] lg:flex-none"
                    >
                      <Send className="h-4 w-4 shrink-0" /> ส่งต่อเคส
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-transform hover:-translate-y-1 sm:gap-4 sm:p-5">
                    <div
                      className={`mt-0.5 shrink-0 rounded-xl p-2 shadow-sm sm:p-2.5 ${
                        selectedStudent.riskLevel === "high"
                          ? "bg-red-100 text-red-600"
                          : selectedStudent.riskLevel === "medium"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      {selectedStudent.riskLevel === "high" ? (
                        <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : selectedStudent.riskLevel === "medium" ? (
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : (
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                        ผลประเมิน 9Q ล่าสุด
                      </p>
                      <p
                        className={`overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold leading-tight sm:text-[17px] ${
                          selectedStudent.riskLevel === "high"
                            ? "text-red-700"
                            : selectedStudent.riskLevel === "medium"
                              ? "text-amber-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {selectedStudent.riskLevel === "high"
                          ? "เสี่ยงสูง (ซึมเศร้า)"
                          : selectedStudent.riskLevel === "medium"
                            ? "เฝ้าระวัง"
                            : "ปกติ"}
                      </p>
                      <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-slate-500 sm:text-xs">
                        อัปเดต: {formatThaiDate(selectedStudent.lastAssessment)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-transform hover:-translate-y-1 sm:gap-4 sm:p-5">
                    <div className="mt-0.5 shrink-0 rounded-xl bg-indigo-100 p-2 text-indigo-600 shadow-sm sm:p-2.5">
                      <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                        ประวัติการดูแล
                      </p>
                      <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold leading-tight text-slate-800 sm:text-[17px]">
                        {selectedStudent.careRecordCount > 0 ? `${selectedStudent.careRecordCount} ครั้ง` : "ยังไม่มีประวัติ"}
                      </p>
                      <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-slate-500 sm:text-xs">
                        ในภาคการศึกษานี้
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-transform hover:-translate-y-1 sm:col-span-2 sm:gap-4 sm:p-5 lg:col-span-1">
                    <div className="mt-0.5 shrink-0 rounded-xl bg-blue-100 p-2 text-blue-600 shadow-sm sm:p-2.5">
                      <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                        ข้อมูลติดต่อด่วน
                      </p>
                      <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-bold leading-tight text-slate-800 sm:text-[16px]">
                        นศ: 089-123-4567
                      </p>
                      <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-slate-500 sm:text-xs">
                        ผู้ปกครอง: 081-999-9999
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-5 flex items-center gap-2.5 px-1 text-xl font-bold text-slate-900">
                  <div className="rounded-lg bg-blue-100 p-1.5 text-blue-700">
                    <History className="h-5 w-5" />
                  </div>
                  ประวัติการบันทึกดูแล / ส่งต่อ
                </h3>

                <div className="space-y-4">
                  {loadingHistory && (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600">
                      <Activity className="h-4 w-4 animate-spin text-blue-600" /> กำลังโหลดประวัติ...
                    </div>
                  )}

                  {!loadingHistory && historyItems.length > 0 ? (
                    historyItems.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
                      >
                        <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${record.kind === "CARE" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-700"}`}>
                              {record.type}
                            </span>
                            {record.isUrgent && (
                              <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                เร่งด่วน
                              </span>
                            )}
                            <span className="text-sm font-bold text-slate-700">{formatThaiDate(record.date)}</span>
                          </div>
                          <span className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            <User className="h-3.5 w-3.5" /> ผู้บันทึก: {record.advisorName}
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-700 sm:text-xs">
                              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> ปัญหา / เรื่องที่ปรึกษา
                            </p>
                            <p className="text-sm font-medium leading-relaxed text-slate-800">{record.topic}</p>
                          </div>

                          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 sm:text-xs">
                              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> การดูแลที่ให้ (Intervention)
                            </p>
                            <p className="text-sm font-medium leading-relaxed text-slate-800">{record.action}</p>
                          </div>

                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 sm:text-xs">
                              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> ผลลัพธ์เบื้องต้น
                            </p>
                            <p className="text-sm font-medium leading-relaxed text-slate-800">{record.outcome || "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                        <FileText className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="text-lg font-bold text-slate-500">ยังไม่มีประวัติการดูแล</p>
                      <p className="mt-1 text-sm text-slate-400">นักศึกษาคนนี้ยังไม่เคยได้รับการบันทึกข้อมูลเข้าระบบ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-4 text-center text-slate-400">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm">
                <Users className="h-10 w-10 text-slate-300" />
              </div>
              <p className="mb-2 text-xl font-bold text-slate-600">เลือกนักศึกษาจากรายชื่อด้านซ้าย</p>
              <p className="max-w-md text-sm leading-relaxed text-slate-500">
                เพื่อดูประวัติสุขภาพจิต ผลการประเมินความเสี่ยง และทำการบันทึกข้อมูลการให้คำปรึกษา
              </p>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="mt-6 flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white shadow-sm md:hidden"
              >
                <Menu className="h-4 w-4" /> เปิดดูรายชื่อนักศึกษา
              </button>
            </div>
          )}
        </div>
      </main>

      {isRecordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl md:max-h-[85vh]">
            <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50/80 p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-800 sm:text-xl">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-700">
                  <FileText className="h-5 w-5" />
                </div>
                บันทึกการดูแล
              </h3>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="care-record-form" onSubmit={handleSaveRecord} className="space-y-6 overflow-y-auto p-5 sm:p-6">
              <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-200 text-sm font-bold text-blue-800">
                  {selectedStudent?.image}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="break-words text-base font-bold text-blue-900">{selectedStudent?.name}</p>
                  <p className="text-sm font-medium text-blue-700/80">
                    รหัส: {formatStudentIdDisplay(selectedStudent?.studentId)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    วันที่ให้คำปรึกษา <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="careDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    รูปแบบการดูแล <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="careType"
                    required
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- เลือกรูปแบบ --</option>
                    <option value="1">ให้คำปรึกษาแบบตัวต่อตัว (In-person)</option>
                    <option value="2">พูดคุยผ่านช่องทางออนไลน์/โทรศัพท์</option>
                    <option value="3">ลงเยี่ยมหอพัก/หอผู้ป่วย</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  ปัญหา / ประเด็นหลักที่พูดคุย <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="topic"
                  required
                  rows={2}
                  placeholder="เช่น ปัญหาเรื่องการเรียน การปรับตัว หรือเรื่องครอบครัว..."
                  className="min-h-[80px] w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  การดูแลเบื้องต้นที่ให้ (Intervention) <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="action"
                  required
                  rows={3}
                  placeholder="ระบุสิ่งที่อาจารย์ได้แนะนำ หรือการช่วยเหลือที่ดำเนินการไปแล้ว..."
                  className="min-h-[100px] w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">ผลลัพธ์ / การประเมินหลังพูดคุย</label>
                <textarea
                  name="outcome"
                  rows={2}
                  placeholder="เช่น อาการดีขึ้น วางแผนติดตามผลในสัปดาห์หน้า..."
                  className="min-h-[80px] w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>

            <div className="flex shrink-0 flex-col justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-white p-5 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="w-full rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 sm:w-auto"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="care-record-form"
                className="w-full rounded-xl bg-blue-700 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-800 active:scale-[0.98] sm:w-auto"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {isReferralModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-red-100 bg-rose-50 p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 text-lg font-bold text-red-700 sm:text-xl">
                <div className="rounded-lg bg-red-100 p-1.5 text-red-600">
                  <Send className="h-5 w-5" />
                </div>
                ส่งต่อเคสนักศึกษา
              </h3>
              <button
                type="button"
                onClick={() => setIsReferralModalOpen(false)}
                className="rounded-full border border-red-200 bg-white p-1.5 text-red-400 shadow-sm hover:text-red-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="referral-form" onSubmit={handleReferral} className="space-y-6 overflow-y-auto p-5 sm:p-6">
              <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="mb-1 break-words font-bold leading-tight">ส่งต่อเคส: {selectedStudent?.name}</p>
                  <p className="text-xs font-medium text-red-600/80">
                    รหัสนักศึกษา: {formatStudentIdDisplay(selectedStudent?.studentId)}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-bold text-slate-700">
                  หน่วยงานที่ต้องการส่งต่อ <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
                    <input
                      type="radio"
                      name="target"
                      value="STUDENT_DEVELOPMENT"
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-[15px] font-bold leading-tight text-slate-800">ฝ่ายพัฒนานักศึกษา</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        ปัญหาด้านทุน ทั่วไป การปรับตัวในมหาวิทยาลัย หรือความช่วยเหลือด้านสวัสดิการ
                      </p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
                    <input
                      type="radio"
                      name="target"
                      value="COUNSELING_CENTER"
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-[15px] font-bold leading-tight text-slate-800">ศูนย์ให้คำปรึกษา / ทีมจิตแพทย์</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        ปัญหาความเครียดสะสม ภาวะซึมเศร้า หรือประเมินแล้วมีความเสี่ยงทำร้ายตนเอง
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  เหตุผลในการส่งต่อ (สรุปสั้นๆ) <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  placeholder="ระบุสาเหตุที่ต้องการส่งต่อ เพื่อให้ทีมรับไม้ต่อมีข้อมูลเบื้องต้น..."
                  className="min-h-[100px] w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3 transition-colors hover:bg-rose-50">
                <input
                  type="checkbox"
                  id="urgent"
                  name="urgent"
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-bold text-red-700">ทำเครื่องหมายเป็นเคสเร่งด่วน (Urgent Case)</span>
              </label>
            </form>

            <div className="flex shrink-0 flex-col justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-white p-5 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsReferralModalOpen(false)}
                className="w-full rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 sm:w-auto"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="referral-form"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-8 py-3 text-sm font-bold text-white shadow-md shadow-red-500/20 transition-colors hover:bg-red-700 active:scale-[0.98] sm:w-auto"
              >
                <Send className="h-4 w-4" /> ยืนยันการส่งต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
