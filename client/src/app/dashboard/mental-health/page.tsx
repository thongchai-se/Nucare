"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  HeartPulse,
  Loader2,
  LogOut,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";

type DashboardReferral = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  reason: string;
  isUrgent: boolean;
  createdAt: string;
  advisorName: string;
  student: {
    id: string;
    studentId: string | null;
    name: string;
    year: string;
    riskLevel: "high" | "medium" | "normal";
  };
};

type EmergencyCase = {
  id: string;
  summary: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  openedAt: string;
  student: {
    id: string;
    name: string;
    studentId: string | null;
  };
};

export default function MentalHealthDashboardPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [referrals, setReferrals] = useState<DashboardReferral[]>([]);
  const [emergencyCases, setEmergencyCases] = useState<EmergencyCase[]>([]);
  const [serverError, setServerError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

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
    if (!loading && user?.role === "INSTRUCTOR") {
      router.replace("/dashboard/instructor");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "STUDENT") {
      router.replace("/dashboard/student");
    }
  }, [loading, router, user?.role]);

  const loadDashboard = async () => {
    setLoadingData(true);
    setServerError("");
    try {
      const response = await api.get<{ referrals: DashboardReferral[]; emergencyCases: EmergencyCase[] }>(
        "/api/mental-health/dashboard"
      );
      setReferrals(response.data.referrals);
      setEmergencyCases(response.data.emergencyCases);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลทีมสุขภาพจิตได้");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (loading || user?.role !== "MENTAL_HEALTH") {
      return;
    }

    void loadDashboard();
  }, [loading, user?.role]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleUpdateReferral = async (referralId: string, status: "PENDING" | "ACCEPTED" | "CLOSED") => {
    try {
      await api.patch(`/api/mental-health/referrals/${referralId}/status`, { status });
      await loadDashboard();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "ไม่สามารถอัปเดต referral ได้");
    }
  };

  const handleResolveEmergency = async (caseId: string) => {
    try {
      await api.patch(`/api/mental-health/emergency-cases/${caseId}/resolve`);
      await loadDashboard();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "ไม่สามารถปิดเคสฉุกเฉินได้");
    }
  };

  const handleCreateCareRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await api.post("/api/mental-health/care-records", {
        studentId: String(formData.get("studentId") || ""),
        referralId: String(formData.get("referralId") || ""),
        sessionDate: String(formData.get("sessionDate") || ""),
        summary: String(formData.get("summary") || ""),
        interventionPlan: String(formData.get("interventionPlan") || ""),
        confidentialNotes: String(formData.get("confidentialNotes") || ""),
      });
      event.currentTarget.reset();
      await loadDashboard();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "ไม่สามารถบันทึกการดูแลเชิงลึกได้");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7  text-blue-600"></span>
      </main>
    );
  }

  if (!user || user.role !== "MENTAL_HEALTH") {
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
                <p className="text-xs text-slate-500">ทีมสุขภาพจิต / นักจิตวิทยา</p>
              </div>
              <button type="button" onClick={handleLogout} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-red-600">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900">ทีมสุขภาพจิตและเคสเฉพาะทาง</h1>
          <p className="mt-2 text-sm text-slate-600">รวม referral, เคสฉุกเฉิน และการบันทึกดูแลเชิงลึกสำหรับทีมเฉพาะทาง</p>
        </div>

        {serverError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>}

        {loadingData ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="loader h-4 w-4 "></span> กำลังโหลดข้อมูล...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
                  <ShieldAlert className="h-5 w-5 text-red-600" /> เคสฉุกเฉิน
                </h2>
                <div className="space-y-4">
                  {emergencyCases.map((item) => (
                    <div key={item.id} className="rounded-xl border border-red-100 bg-red-50 p-4">
                      <p className="font-bold text-red-800">{item.student.name} ({item.student.studentId || "-"})</p>
                      <p className="mt-1 text-sm text-red-700">{item.summary}</p>
                      <button type="button" onClick={() => handleResolveEmergency(item.id)} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
                        ปิดเคสฉุกเฉิน
                      </button>
                    </div>
                  ))}
                  {emergencyCases.length === 0 && <p className="text-sm text-slate-500">ไม่มีเคสฉุกเฉินที่เปิดอยู่</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
                  <AlertCircle className="h-5 w-5 text-amber-500" /> Referral Queue
                </h2>
                <div className="space-y-4">
                  {referrals.map((referral) => (
                    <div key={referral.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row">
                        <div>
                          <p className="font-bold text-slate-900">{referral.student.name} ({referral.student.studentId || "-"})</p>
                          <p className="mt-1 text-sm text-slate-600">{referral.reason}</p>
                          <p className="mt-1 text-xs text-slate-500">ส่งต่อโดย {referral.advisorName} | ชั้นปี {referral.student.year}</p>
                        </div>
                        <div className="text-sm font-semibold text-slate-700">{referral.status}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleUpdateReferral(referral.id, "ACCEPTED")} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">
                          รับเคส
                        </button>
                        <button type="button" onClick={() => handleUpdateReferral(referral.id, "CLOSED")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                          ปิด referral
                        </button>
                      </div>
                    </div>
                  ))}
                  {referrals.length === 0 && <p className="text-sm text-slate-500">ยังไม่มี referral เข้ามา</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <Stethoscope className="h-5 w-5 text-blue-600" /> บันทึกดูแลเชิงลึก
              </h2>
              <form className="space-y-4" onSubmit={handleCreateCareRecord}>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">นักศึกษา</label>
                  <select name="studentId" required className="w-full rounded-xl border border-slate-300 p-3 text-sm">
                    <option value="">-- เลือกจาก referral --</option>
                    {referrals.map((referral) => (
                      <option key={referral.id} value={referral.student.id}>
                        {referral.student.name} ({referral.student.studentId || "-"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Referral</label>
                  <select name="referralId" className="w-full rounded-xl border border-slate-300 p-3 text-sm">
                    <option value="">-- ไม่ระบุ --</option>
                    {referrals.map((referral) => (
                      <option key={referral.id} value={referral.id}>
                        {referral.student.name} - {referral.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">วันที่ให้บริการ</label>
                  <input name="sessionDate" type="date" required className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">สรุปอาการ/ประเด็น</label>
                  <textarea name="summary" required rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">แผนการดูแล</label>
                  <textarea name="interventionPlan" required rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">บันทึกลับทางคลินิก</label>
                  <textarea name="confidentialNotes" rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </div>
                <button type="submit" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white">
                  บันทึกการดูแล
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
