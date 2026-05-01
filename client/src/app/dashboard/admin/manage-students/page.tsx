"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, ShieldAlert, X } from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/auth.context";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";

type UserStatus = "active" | "inactive";

type ApiUser = {
  id: string;
  name: string;
  email: string | null;
  studentId: string | null;
  employeeId: string | null;
  role: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

type ManagedUser = Omit<ApiUser, "role"> & {
  role: "STUDENT";
};

type UsersResponse = {
  users: ApiUser[];
  total: number;
};

type UserMutationResponse = {
  message: string;
  user: ManagedUser;
  temporaryPassword?: string;
};

type UserFormSnapshot = {
  studentId: string;
  name: string;
  email: string;
  status: UserStatus;
};

type FormErrors = {
  email: string;
  name: string;
  studentId: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_PATTERN = /^\d{9}-\d$/;
const STUDENT_ID_FORMAT_MESSAGE = "รหัสนักศึกษาต้องอยู่ในรูปแบบ 663380696-6";

const emptyErrors: FormErrors = {
  email: "",
  name: "",
  studentId: "",
};

const normalizeStudentId = (raw: string): string => {
  const normalized = raw.trim();
  if (!STUDENT_ID_PATTERN.test(normalized)) {
    throw new Error(STUDENT_ID_FORMAT_MESSAGE);
  }

  return normalized;
};

const formatStudentIdInput = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
  if (digitsOnly.length <= 9) {
    return digitsOnly;
  }

  return `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`;
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

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
};

export default function ManageStudentsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [formStudentId, setFormStudentId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<UserStatus>("active");
  const [formErrors, setFormErrors] = useState<FormErrors>(emptyErrors);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<UserFormSnapshot | null>(null);

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successAnimationKey, setSuccessAnimationKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("บันทึกข้อมูลสำเร็จ");
  const [successTemporaryPassword, setSuccessTemporaryPassword] = useState("");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<ManagedUser | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/dashboard/admin");
    router.prefetch("/dashboard/admin/manage-staff");
    router.prefetch("/dashboard/admin/import-students");
  }, [router]);

  useEffect(() => {
    if (!showSuccessPopup) {
      return;
    }

    const timer = setTimeout(() => {
      setShowSuccessPopup(false);
      setSuccessTemporaryPassword("");
    }, 2600);

    return () => clearTimeout(timer);
  }, [showSuccessPopup]);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") {
      void fetchUsers();
    }
  }, [loading, user?.role]);

  useEffect(() => {
    const updateRowsPerPage = () => {
      const viewportHeight = window.innerHeight;
      const isMobileViewport = window.innerWidth < 768;
      const reservedHeight = isMobileViewport ? 520 : 340;
      const estimatedRowHeight = isMobileViewport ? 152 : 56;
      const minRows = isMobileViewport ? 3 : 8;
      const maxRows = isMobileViewport ? 8 : 16;
      const computedRows = Math.max(minRows, Math.floor((viewportHeight - reservedHeight) / estimatedRowHeight));
      setRowsPerPage(Math.min(maxRows, computedRows));
    };

    updateRowsPerPage();
    window.addEventListener("resize", updateRowsPerPage);
    return () => window.removeEventListener("resize", updateRowsPerPage);
  }, []);

  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);

  const filteredUsers = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return users.filter((managedUser) => {
      if (!keyword) {
        return true;
      }

      return [managedUser.name, managedUser.email || "", managedUser.studentId || ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [searchKeyword, users]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage)), [filteredUsers.length, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [currentPage, filteredUsers, rowsPerPage]);

  const startItemIndex = filteredUsers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage;
  const endItemIndex = filteredUsers.length === 0 ? 0 : Math.min(startItemIndex + paginatedUsers.length, filteredUsers.length);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const canSubmit = useMemo(() => {
    const trimmedName = formName.trim();
    const trimmedEmail = formEmail.trim();
    const trimmedStudentId = formStudentId.trim();

    if (!trimmedName || !trimmedStudentId) {
      return false;
    }

    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      return false;
    }

    try {
      normalizeStudentId(trimmedStudentId);
    } catch {
      return false;
    }

    if (modalMode === "add") {
      return true;
    }

    if (!initialFormSnapshot) {
      return false;
    }

    return (
      initialFormSnapshot.studentId !== trimmedStudentId ||
      initialFormSnapshot.name !== trimmedName ||
      initialFormSnapshot.email !== trimmedEmail.toLowerCase() ||
      initialFormSnapshot.status !== formStatus
    );
  }, [formEmail, formName, formStatus, formStudentId, initialFormSnapshot, modalMode]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setServerError("");

    try {
      const response = await api.get<UsersResponse>("/api/admin/users");
      setUsers(response.data.users.filter((managedUser): managedUser is ManagedUser => managedUser.role === "STUDENT"));
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingUsers(false);
    }
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
    setFormErrors(emptyErrors);
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingUserId(null);
    setInitialFormSnapshot(null);
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (managedUser: ManagedUser) => {
    setModalMode("edit");
    setEditingUserId(managedUser.id);
    setFormStudentId(managedUser.studentId || "");
    setFormName(managedUser.name);
    setFormEmail(managedUser.email || "");
    setFormStatus(managedUser.status);
    setFormErrors(emptyErrors);
    setInitialFormSnapshot({
      studentId: managedUser.studentId || "",
      name: managedUser.name.trim(),
      email: (managedUser.email || "").trim().toLowerCase(),
      status: managedUser.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setModalOpen(false);
    setInitialFormSnapshot(null);
    setFormErrors(emptyErrors);
  };

  const showSuccess = (message: string, temporaryPassword = "") => {
    setSuccessMessage(message);
    setSuccessTemporaryPassword(temporaryPassword);
    setSuccessAnimationKey((current) => current + 1);
    setShowSuccessPopup(true);
  };

  const validateForm = (): { email: string | null; studentId: string } | null => {
    const nextErrors: FormErrors = { ...emptyErrors };
    const trimmedName = formName.trim();
    const trimmedEmail = formEmail.trim();
    const trimmedStudentId = formStudentId.trim();
    let normalizedStudentId = "";

    if (!trimmedName) {
      nextErrors.name = "กรุณาระบุชื่อ-นามสกุล";
    }

    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }

    if (!trimmedStudentId) {
      nextErrors.studentId = "กรุณาระบุรหัสนักศึกษา";
    } else {
      try {
        normalizedStudentId = normalizeStudentId(trimmedStudentId);
      } catch (error) {
        nextErrors.studentId = error instanceof Error ? error.message : "รหัสนักศึกษาไม่ถูกต้อง";
      }
    }

    setFormErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return null;
    }

    return {
      email: trimmedEmail || null,
      studentId: normalizedStudentId,
    };
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");

    const validated = validateForm();
    if (!validated) {
      return;
    }

    setSubmitting(true);

    const payload = {
      role: "STUDENT" as const,
      studentId: validated.studentId,
      name: formName.trim(),
      email: validated.email || undefined,
      status: formStatus,
    };

    try {
      if (modalMode === "add") {
        const response = await api.post<UserMutationResponse>("/api/admin/users", payload);
        showSuccess(response.data.message || "เพิ่มนักศึกษาสำเร็จ", response.data.temporaryPassword || "");
      } else {
        if (!editingUserId) {
          setServerError("ไม่พบข้อมูลที่ต้องการแก้ไข");
          return;
        }

        const response = await api.put<UserMutationResponse>(`/api/admin/users/${editingUserId}`, payload);
        showSuccess(response.data.message || "อัปเดตข้อมูลนักศึกษาสำเร็จ");
      }

      closeModal();
      await fetchUsers();
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.toLowerCase().includes("student id")) {
        setFormErrors((current) => ({ ...current, studentId: "รหัสนักศึกษาซ้ำในระบบ" }));
      } else if (message.toLowerCase().includes("email")) {
        setFormErrors((current) => ({ ...current, email: "อีเมลซ้ำในระบบ" }));
      } else {
        setServerError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (managedUser: ManagedUser) => {
    if (deletingId) {
      return;
    }

    setPendingDeleteUser(managedUser);
  };

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) {
      return;
    }

    setDeletingId(pendingDeleteUser.id);
    setServerError("");

    try {
      await api.delete(`/api/admin/users/${pendingDeleteUser.id}`);
      showSuccess("ลบข้อมูลสำเร็จ");
      await fetchUsers();
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
      setPendingDeleteUser(null);
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
            <span className="text-xs font-semibold uppercase tracking-wide">Admin Only</span>
          </div>
          <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link href="/dashboard/admin" className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium">
            กลับไป Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      activeNav="students"
      onLogout={handleLogout}
      title="จัดการนักศึกษา"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ (System Admin)"
    >
      <div
        className={`fixed inset-0 z-[80] flex items-center justify-center px-4 transition-all duration-300 ease-out ${
          showSuccessPopup ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="w-fit max-w-[92vw] rounded-[2rem] border border-gray-100 bg-white/95 px-8 py-8 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:px-10">
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <svg key={successAnimationKey} className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
            <div>
              <p className="text-base font-medium tracking-wide text-gray-800 sm:text-lg">{successMessage}</p>
              {successTemporaryPassword && (
                <p className="mt-2 text-sm text-slate-500">
                  รหัสผ่านชั่วคราว: <span className="font-mono font-bold text-slate-700">{successTemporaryPassword}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteUser)}
        loading={Boolean(pendingDeleteUser && deletingId === pendingDeleteUser.id)}
        title="ยืนยันการลบนักศึกษา"
        description={
          pendingDeleteUser
            ? `คุณแน่ใจหรือไม่ว่าต้องการลบนักศึกษา ${pendingDeleteUser.name} (${pendingDeleteUser.studentId || pendingDeleteUser.email || pendingDeleteUser.id})`
            : ""
        }
        confirmLabel="ลบข้อมูล"
        cancelLabel="ยกเลิก"
        onCancel={() => {
          if (!deletingId) {
            setPendingDeleteUser(null);
          }
        }}
        onConfirm={() => {
          void confirmDeleteUser();
        }}
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">จัดการนักศึกษา</h2>
            <p className="mt-1 text-sm text-slate-500">ดูแลบัญชีนักศึกษาโดยเฉพาะ แยกออกจากบุคลากรเพื่อให้ค้นหา แก้ไข และตรวจสอบได้ง่ายขึ้น</p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            เพิ่มนักศึกษาใหม่
          </button>
        </div>

        {serverError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="ค้นหาชื่อ, อีเมล, หรือรหัสนักศึกษา..."
                className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 pl-10 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-hidden">
            {loadingUsers && (
              <div className="flex items-center justify-center border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                <span className="loader mr-2 h-4 w-4 text-blue-600"></span>
                กำลังโหลดข้อมูลนักศึกษา...
              </div>
            )}

            <div className="divide-y divide-slate-100 md:hidden">
              {paginatedUsers.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">ไม่พบนักศึกษา</div>}
              {paginatedUsers.map((managedUser, index) => {
                const isDeleting = deletingId === managedUser.id;
                return (
                  <div key={managedUser.id} className="min-h-[152px] space-y-3 px-4 py-4">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">ลำดับที่ {startItemIndex + index + 1}</p>
                      <p className="mt-0.5 font-medium text-slate-900">{managedUser.name}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">รหัสนักศึกษา</p>
                        <p className="mt-0.5 font-mono text-sm text-slate-700">{managedUser.studentId || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">อีเมล</p>
                        <p className="mt-0.5 truncate text-slate-700">{managedUser.email || "-"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${managedUser.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${managedUser.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {managedUser.status === "active" ? "Active" : "Inactive"}
                      </span>
                      <div className="flex gap-4">
                        <button type="button" onClick={() => openEditModal(managedUser)} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteUser(managedUser)}
                          className="text-sm font-medium text-red-500 disabled:opacity-60"
                        >
                          {isDeleting ? "กำลังลบ..." : "ลบ"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[26%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-4 text-center font-medium">ลำดับ</th>
                    <th className="px-6 py-4 font-medium">ชื่อ-นามสกุล</th>
                    <th className="px-6 py-4 font-medium">รหัสนักศึกษา</th>
                    <th className="px-6 py-4 font-medium">อีเมล</th>
                    <th className="px-6 py-4 text-center font-medium">สถานะ</th>
                    <th className="px-6 py-4 text-right font-medium">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                        ไม่พบนักศึกษา
                      </td>
                    </tr>
                  )}

                  {paginatedUsers.map((managedUser, index) => {
                    const isDeleting = deletingId === managedUser.id;

                    return (
                      <tr key={managedUser.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4 text-center text-slate-500">{startItemIndex + index + 1}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          <p className="truncate">{managedUser.name}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-700 whitespace-nowrap">{managedUser.studentId || "-"}</td>
                        <td className="px-6 py-4 text-slate-500">
                          <p className="truncate">{managedUser.email || "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${managedUser.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${managedUser.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {managedUser.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button type="button" onClick={() => openEditModal(managedUser)} className="mr-3 text-sm font-medium text-blue-600 hover:text-blue-800">
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteUser(managedUser)}
                            className="text-sm font-medium text-red-500 disabled:opacity-60"
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
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="text-sm tabular-nums text-slate-500">
              แสดง <span className="font-medium text-slate-800">{filteredUsers.length === 0 ? 0 : startItemIndex + 1}</span>-
              <span className="font-medium text-slate-800">{endItemIndex}</span> จาก
              <span className="font-medium text-slate-800"> {filteredUsers.length}</span> รายการ
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                ก่อนหน้า
              </button>
              <button type="button" className="min-w-[42px] rounded border border-slate-200 bg-slate-900 px-3 py-1 text-center font-medium tabular-nums text-white">
                {currentPage}
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[60] bg-slate-900/40 transition-opacity duration-200 ${
          modalOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeModal}
      />
      <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 ${modalOpen ? "" : "pointer-events-none"}`}>
        <div
          className={`w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-all duration-200 ${
            modalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">{modalMode === "add" ? "เพิ่มบัญชีนักศึกษาใหม่" : "แก้ไขข้อมูลนักศึกษา"}</h3>
            <button type="button" onClick={closeModal} className="text-gray-400 transition-colors hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form className="space-y-4 p-6" onSubmit={saveUser}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ประเภทผู้ใช้</label>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">นักศึกษา</div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                รหัสนักศึกษา <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formStudentId}
                onChange={(event) => {
                  setFormStudentId(formatStudentIdInput(event.target.value));
                  setFormErrors((current) => ({ ...current, studentId: "" }));
                }}
                required
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${
                  formErrors.studentId
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                    : "border-gray-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                }`}
                placeholder="เช่น 663380595-6"
              />
              {formErrors.studentId && <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(event) => {
                  setFormName(event.target.value);
                  setFormErrors((current) => ({ ...current, name: "" }));
                }}
                required
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${
                  formErrors.name
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                    : "border-gray-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                }`}
                placeholder="เช่น สมศรี มั่นคง"
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล</label>
              <input
                type="email"
                value={formEmail}
                onChange={(event) => {
                  setFormEmail(event.target.value);
                  setFormErrors((current) => ({ ...current, email: "" }));
                }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${
                  formErrors.email
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                    : "border-gray-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                }`}
                placeholder="example@nucare.local"
              />
              {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
              <select
                value={formStatus}
                onChange={(event) => setFormStatus(event.target.value as UserStatus)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
                disabled={submitting || !canSubmit}
                className="inline-flex min-w-[124px] items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? <span className="loader h-4 w-4"></span> : "บันทึกข้อมูล"}
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
    </AdminShell>
  );
}
