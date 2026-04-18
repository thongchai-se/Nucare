"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Menu, Plus, Search, ShieldAlert, X } from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/auth.context";

type StudentStatus = "active" | "inactive";

type ManagedStudent = {
  id: string;
  studentId: string;
  name: string;
  email: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

type StudentsResponse = {
  students: ManagedStudent[];
  total: number;
};

type StudentMutationResponse = {
  message: string;
  student: ManagedStudent;
};

const normalizeStudentId = (raw: string): string => {
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length !== 10) {
    throw new Error("รหัสนักศึกษาต้องมี 10 หลัก");
  }

  return `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`;
};

const formatStudentIdInput = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
  if (digitsOnly.length <= 9) {
    return digitsOnly;
  }

  return `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`;
};

export default function ManageStudentsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [serverError, setServerError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const [formStudentId, setFormStudentId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<StudentStatus>("active");
  const [studentIdError, setStudentIdError] = useState("");

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successAnimationKey, setSuccessAnimationKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("บันทึกข้อมูลสำเร็จ");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/dashboard/admin/import-students");
  }, [router]);

  useEffect(() => {
    if (!showSuccessPopup) {
      return;
    }

    const timer = setTimeout(() => {
      setShowSuccessPopup(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [showSuccessPopup]);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") {
      void fetchStudents();
    }
  }, [loading, user?.role]);

  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);

  const filteredStudents = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return students;
    }

    return students.filter(
      (student) =>
        student.studentId.toLowerCase().includes(keyword) ||
        student.name.toLowerCase().includes(keyword)
    );
  }, [searchKeyword, students]);

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

  const resetForm = () => {
    setFormStudentId("");
    setFormName("");
    setFormEmail("");
    setFormStatus("active");
    setStudentIdError("");
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingStudentId(null);
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (student: ManagedStudent) => {
    setModalMode("edit");
    setEditingStudentId(student.id);
    setFormStudentId(student.studentId);
    setFormName(student.name);
    setFormEmail(student.email || "");
    setFormStatus(student.status);
    setStudentIdError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setModalOpen(false);
    setStudentIdError("");
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    setServerError("");

    try {
      const response = await api.get<StudentsResponse>("/api/admin/students");
      setStudents(response.data.students);
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError("ไม่สามารถโหลดข้อมูลนักศึกษาได้");
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setSuccessAnimationKey((current) => current + 1);
    setShowSuccessPopup(true);
  };

  const saveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let normalizedStudentId: string;
    try {
      normalizedStudentId = normalizeStudentId(formStudentId);
    } catch (error) {
      setStudentIdError(error instanceof Error ? error.message : "รหัสนักศึกษาไม่ถูกต้อง");
      return;
    }

    if (!formName.trim()) {
      setServerError("กรุณาระบุชื่อ-นามสกุล");
      return;
    }

    setSubmitting(true);
    setServerError("");
    setStudentIdError("");

    const payload = {
      studentId: normalizedStudentId,
      name: formName.trim(),
      email: formEmail.trim(),
      status: formStatus,
    };

    try {
      if (modalMode === "add") {
        const response = await api.post<StudentMutationResponse>("/api/admin/students", payload);
        showSuccess(response.data.message || "เพิ่มข้อมูลนักศึกษาสำเร็จ");
      } else {
        if (!editingStudentId) {
          setServerError("ไม่พบข้อมูลที่ต้องการแก้ไข");
          return;
        }

        const response = await api.put<StudentMutationResponse>(
          `/api/admin/students/${editingStudentId}`,
          payload
        );
        showSuccess(response.data.message || "อัปเดตข้อมูลสำเร็จ");
      }

      closeModal();
      await fetchStudents();
    } catch (error) {
      if (typeof error === "object" && error !== null && "response" in error) {
        const maybeMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (maybeMessage?.includes("มีในระบบแล้ว")) {
          setStudentIdError(maybeMessage);
        } else if (maybeMessage) {
          setServerError(maybeMessage);
        } else {
          setServerError("ไม่สามารถบันทึกข้อมูลได้");
        }
      } else if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError("ไม่สามารถบันทึกข้อมูลได้");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (student: ManagedStudent) => {
    const shouldDelete = window.confirm(
      `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักศึกษารหัส ${student.studentId}?`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(student.id);
    setServerError("");

    try {
      await api.delete(`/api/admin/students/${student.id}`);
      showSuccess("ลบข้อมูลสำเร็จ");
      await fetchStudents();
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError("ไม่สามารถลบข้อมูลได้");
      }
    } finally {
      setDeletingId(null);
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
          <p className="mt-2 text-sm">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
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

          <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
            <Link
              href="/dashboard"
              onClick={closeSidebar}
              className="block rounded-lg px-4 py-2.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              หน้าหลัก
            </Link>
            <span className="block rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white">
              จัดการข้อมูลนักศึกษา
            </span>
            <Link
              href="/dashboard/admin/import-students"
              onClick={closeSidebar}
              className="block rounded-lg px-4 py-2.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              นำเข้านักศึกษา (CSV)
            </Link>
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
            className={`absolute inset-0 z-[80] flex items-center justify-center px-4 transition-all duration-300 ease-out ${
              showSuccessPopup ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
            }`}
          >
            <div className="w-fit max-w-[90vw] rounded-[2rem] border border-gray-100 bg-white/95 px-8 py-8 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:px-10">
              <div className="flex flex-col items-center gap-4 sm:gap-5">
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
                <p className="text-base font-medium tracking-wide text-gray-800 sm:text-lg">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>

          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 md:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-gray-600 transition-colors hover:text-gray-900 lg:hidden"
                onClick={toggleSidebar}
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="truncate text-lg font-medium text-gray-800 sm:text-xl">จัดการข้อมูลนักศึกษา</h1>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
              AD
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6 md:p-8">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-80">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white p-2.5 pl-10 text-sm text-gray-900 outline-none transition-all focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                  placeholder="ค้นหารหัส หรือ ชื่อนักศึกษา..."
                />
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow sm:w-auto"
              >
                <Plus className="h-5 w-5" />
                เพิ่มนักศึกษา
              </button>
            </div>

            {serverError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex-1 overflow-x-auto">
                {loadingStudents && (
                  <div className="flex items-center justify-center border-b border-gray-100 px-4 py-4 text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังโหลดข้อมูลนักศึกษา...
                  </div>
                )}
                <table className="min-w-[700px] w-full whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                    <tr>
                      <th className="w-20 px-6 py-4 text-center font-medium">ลำดับ</th>
                      <th className="px-6 py-4 font-medium">รหัสนักศึกษา</th>
                      <th className="px-6 py-4 font-medium">ชื่อ-นามสกุล</th>
                      <th className="px-6 py-4 font-medium">อีเมล</th>
                      <th className="px-6 py-4 text-center font-medium">สถานะ</th>
                      <th className="px-6 py-4 text-right font-medium">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                          ไม่พบข้อมูลนักศึกษา
                        </td>
                      </tr>
                    )}

                    {filteredStudents.map((student, index) => {
                      const isDeleting = deletingId === student.id;

                      return (
                        <tr key={student.id} className="transition-colors hover:bg-gray-50">
                          <td className="px-6 py-4 text-center text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 font-mono text-sm text-gray-900">{student.studentId}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {student.email || <span className="italic text-gray-300">ไม่มีข้อมูล</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {student.status === "active" ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                                กำลังศึกษา
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-gray-400" />
                                พ้นสภาพ
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => openEditModal(student)}
                              className="mr-3 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
                            >
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => {
                                void handleDeleteStudent(student);
                              }}
                              className="text-sm font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-60"
                            >
                              {isDeleting ? "กำลังลบ..." : "ลบ"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-6 py-4">
                <span className="text-sm text-gray-500">
                  แสดง <span className="font-medium text-gray-800">{filteredStudents.length}</span> รายการ
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="cursor-not-allowed rounded border border-gray-200 bg-white px-3 py-1 text-gray-400"
                  >
                    ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-200 bg-gray-900 px-3 py-1 font-medium text-white"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-200 bg-white px-3 py-1 text-gray-600 hover:bg-gray-50"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-[60] bg-gray-900/40 transition-opacity duration-200 ${
          modalOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeModal}
      />
      <div
        className={`fixed inset-0 z-[70] flex items-center justify-center p-4 ${
          modalOpen ? "" : "pointer-events-none"
        }`}
      >
        <div
          className={`w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-all duration-200 ${
            modalOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {modalMode === "add" ? "เพิ่มข้อมูลนักศึกษา" : "แก้ไขข้อมูลนักศึกษา"}
            </h3>
            <button
              type="button"
              onClick={closeModal}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form className="space-y-4 p-6" onSubmit={saveStudent}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                รหัสนักศึกษา <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formStudentId}
                onChange={(event) => {
                  setFormStudentId(formatStudentIdInput(event.target.value));
                  setStudentIdError("");
                }}
                required
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${
                  studentIdError
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                    : "border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                }`}
                placeholder="เช่น 663380595-6"
              />
              {studentIdError && <p className="mt-1 text-xs text-red-500">{studentIdError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                placeholder="เช่น สมชาย ใจดี"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล (ไม่บังคับ)</label>
              <input
                type="email"
                value={formEmail}
                onChange={(event) => setFormEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                placeholder="example@university.ac.th"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
              <select
                value={formStatus}
                onChange={(event) => setFormStatus(event.target.value as StudentStatus)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
              >
                <option value="active">กำลังศึกษา</option>
                <option value="inactive">พ้นสภาพ/พักการเรียน</option>
              </select>
            </div>

            <div className="mt-2 flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .checkmark {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: block;
          stroke-width: 2.5;
          stroke: #10b981;
          stroke-miterlimit: 10;
        }

        @media (min-width: 640px) {
          .checkmark {
            width: 56px;
            height: 56px;
          }
        }

        .checkmark-circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 2.5;
          stroke-miterlimit: 10;
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

        @keyframes stroke {
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </main>
  );
}
