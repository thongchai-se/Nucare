"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, HeartPulse, Loader2, LogOut, Save, Search } from "lucide-react";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";

type InstructorStudent = {
  id: string;
  name: string;
  studentId: string | null;
};

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [students, setStudents] = useState<InstructorStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
    if (!loading && user?.role === "ADVISOR") {
      router.replace("/dashboard/advisor");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "MENTAL_HEALTH") {
      router.replace("/dashboard/mental-health");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "STUDENT") {
      router.replace("/dashboard/student");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (loading || user?.role !== "INSTRUCTOR") {
      return;
    }

    const loadStudents = async () => {
      setLoadingStudents(true);
      setServerError("");
      try {
        const response = await api.get<{ students: InstructorStudent[] }>("/api/instructor/students");
        setStudents(response.data.students);
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "ไม่สามารถโหลดรายชื่อนักศึกษาได้");
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [loading, user?.role]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleCreateBehaviorRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await api.post("/api/instructor/behavior-records", {
        studentId: String(formData.get("studentId") || ""),
        observedAt: String(formData.get("observedAt") || ""),
        category: String(formData.get("category") || ""),
        details: String(formData.get("details") || ""),
        severity: String(formData.get("severity") || "MEDIUM"),
      });

      event.currentTarget.reset();
      setSuccessMessage("บันทึกพฤติกรรมและส่งแจ้งเตือนไปยังอาจารย์ที่ปรึกษาแล้ว");
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "ไม่สามารถบันทึกพฤติกรรมได้");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7  text-blue-600"></span>
      </main>
    );
  }

  if (!user || user.role !== "INSTRUCTOR") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="fixed z-50 w-full border-b border-slate-100 bg-white shadow-sm transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-1.5 sm:px-2 lg:px-3">
          <div className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-1 block text-xl font-bold leading-none text-blue-900">
                  Nucare<span className="text-2xl leading-none text-cyan-500">.</span>
                </span>
                <span className="block text-[11px] font-medium leading-none text-slate-500">คณะพยาบาลศาสตร์</span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <div className="hidden text-right md:block">
                <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                <p className="text-xs text-slate-500">อาจารย์ผู้สอน</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-red-600"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-blue-900">การเฝ้าระวังในชั้นเรียน</h1>
          <p className="text-sm text-slate-600">บทบาทนี้ไม่แสดงคะแนน 9Q/8Q เพื่อคุ้มครองข้อมูลส่วนบุคคลของนักศึกษา</p>
        </div>

        {serverError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>}
        {successMessage && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> บันทึกพฤติกรรมผิดปกติ
            </h2>
            <form className="space-y-4" onSubmit={handleCreateBehaviorRecord}>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">นักศึกษา</label>
                <select name="studentId" required className="w-full rounded-xl border border-slate-300 p-3 text-sm">
                  <option value="">-- เลือกนักศึกษา --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.studentId || "-"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">วันที่สังเกต</label>
                  <input name="observedAt" type="date" required className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">ระดับความรุนแรง</label>
                  <select name="severity" className="w-full rounded-xl border border-slate-300 p-3 text-sm">
                    <option value="LOW">ต่ำ</option>
                    <option value="MEDIUM">ปานกลาง</option>
                    <option value="HIGH">สูง</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">หมวดพฤติกรรม</label>
                <input name="category" required placeholder="เช่น ขาดเรียนบ่อย / ดูเศร้าหมอง / หลับในห้อง" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">รายละเอียด</label>
                <textarea name="details" required rows={4} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white">
                <Save className="h-4 w-4" /> บันทึกและแจ้งอาจารย์ที่ปรึกษา
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
              <BookOpen className="h-5 w-5 text-blue-600" /> รายชื่อนักศึกษาที่เลือกได้
            </h2>
            {loadingStudents ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="loader h-4 w-4 "></span> กำลังโหลดรายชื่อ...
              </div>
            ) : (
              <ul className="space-y-3">
                {students.map((student) => (
                  <li key={student.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-800">{student.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{student.studentId || "-"}</p>
                  </li>
                ))}
                {students.length === 0 && (
                  <li className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    <Search className="mb-2 h-4 w-4" />
                    ยังไม่มีข้อมูลรายชื่อนักศึกษา
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
