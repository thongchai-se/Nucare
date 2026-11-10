"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";

type ProgramCount = { name: string; students: number; staff: number };
type FacultyCatalog = { name: string; programs: ProgramCount[] };
type CatalogResponse = {
  faculties: FacultyCatalog[];
  defaults: { faculty: string; programs: string[] };
};

type DirectoryStudent = {
  id: string;
  studentId: string;
  name: string;
  studyYear: number;
  section: string;
  faculty: string;
  program: string;
  isActive: boolean;
};

type DirectoryStaff = {
  id: string;
  employeeId: string;
  name: string;
  email: string | null;
  faculty: string;
  program: string;
  isActive: boolean;
};

type PullResponse = {
  source: string;
  scope: { faculty: string; programs: string[] };
  students: DirectoryStudent[];
  staff: DirectoryStaff[];
  summary: { students: number; staff: number };
};

const errorMessage = (requestError: unknown): string => {
  if (
    typeof requestError === "object" &&
    requestError !== null &&
    "response" in requestError &&
    typeof (requestError as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (requestError as { response?: { data?: { message?: string } } }).response?.data?.message || "ดึงรายชื่อไม่สำเร็จ";
  }
  return "ดึงรายชื่อไม่สำเร็จ";
};

export default function ExternalDirectoryPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [catalog, setCatalog] = useState<FacultyCatalog[]>([]);
  const [faculty, setFaculty] = useState("");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [result, setResult] = useState<PullResponse | null>(null);
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState(false);
  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);
  const facultyOptions = catalog.find((item) => item.name === faculty);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(UNAUTHENTICATED_PATH);
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void api.get<CatalogResponse>("/api/admin/external-directory/catalog").then((response) => {
      setCatalog(response.data.faculties);
      setFaculty(response.data.defaults.faculty);
      setSelectedPrograms(response.data.defaults.programs);
    }).catch((requestError: unknown) => {
      setError(errorMessage(requestError));
    });
  }, [isAdmin]);

  const toggleProgram = (program: string) => {
    setSelectedPrograms((current) =>
      current.includes(program) ? current.filter((item) => item !== program) : [...current, program]
    );
  };

  const pullRoster = async () => {
    setPulling(true);
    setError("");
    try {
      const response = await api.get<PullResponse>("/api/admin/external-directory", {
        params: { faculty, programs: selectedPrograms.join(",") },
      });
      setResult(response.data);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPulling(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
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
          <Link href="/admin" className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium">
            กลับไป Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell activeNav="externalDirectory" onLogout={logout} title="รายชื่อจาก API" userName={user.name} userRoleLabel="ผู้ดูแลระบบ">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">รายชื่อจาก API จำลอง</h1>
          <p className="mt-1 text-sm text-slate-500">คลังมีหลายคณะหลายสาขา ระบบนี้ขอเฉพาะคณะและสาขาที่เลือก ไม่ได้เขียนลงบัญชีผู้ใช้</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            คณะที่ขอ
            <select
              value={faculty}
              onChange={(event) => {
                const nextFaculty = event.target.value;
                setFaculty(nextFaculty);
                const nextPrograms = catalog.find((item) => item.name === nextFaculty)?.programs.map((program) => program.name) || [];
                setSelectedPrograms(nextPrograms.slice(0, 1));
              }}
              className="rounded-xl border border-slate-200 px-3 py-2"
            >
              {catalog.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            {facultyOptions?.programs.map((program) => {
              const selected = selectedPrograms.includes(program.name);
              return (
                <button
                  key={program.name}
                  type="button"
                  onClick={() => toggleProgram(program.name)}
                  className={selected ? "rounded-full bg-[#0057A8] px-3 py-1.5 text-sm font-semibold text-white" : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"}
                >
                  {program.name} · นศ. {program.students} · อาจารย์ {program.staff}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void pullRoster()}
            disabled={pulling || selectedPrograms.length === 0}
            className="mt-4 rounded-xl bg-[#0057A8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pulling ? "กำลังดึง..." : "ดึงรายชื่อที่เลือก"}
          </button>
        </section>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {result && (
          <>
            <p className="text-sm text-slate-600">
              ขอ {result.scope.faculty} · {result.scope.programs.join(", ")} · ได้นักศึกษา {result.summary.students} คน และอาจารย์ {result.summary.staff} คน
            </p>
            <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">นักศึกษา</h2>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2">รหัส</th>
                    <th className="px-4 py-2">ชื่อ</th>
                    <th className="px-4 py-2">สาขา</th>
                    <th className="px-4 py-2">ชั้นปี</th>
                    <th className="px-4 py-2">กลุ่ม</th>
                    <th className="px-4 py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.students.map((student) => (
                    <tr key={student.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono">{student.studentId}</td>
                      <td className="px-4 py-2">{student.name}</td>
                      <td className="px-4 py-2">{student.program}</td>
                      <td className="px-4 py-2">{student.studyYear}</td>
                      <td className="px-4 py-2">{student.section}</td>
                      <td className="px-4 py-2">{student.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">อาจารย์</h2>
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2">รหัส</th>
                    <th className="px-4 py-2">ชื่อ</th>
                    <th className="px-4 py-2">สาขา</th>
                    <th className="px-4 py-2">อีเมล</th>
                    <th className="px-4 py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.staff.map((member) => (
                    <tr key={member.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono">{member.employeeId}</td>
                      <td className="px-4 py-2">{member.name}</td>
                      <td className="px-4 py-2">{member.program}</td>
                      <td className="px-4 py-2">{member.email || "-"}</td>
                      <td className="px-4 py-2">{member.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
