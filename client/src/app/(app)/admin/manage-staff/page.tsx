"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, ShieldAlert, X } from "lucide-react";
import api from "@/lib/axios";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { useAuth } from "@/context/auth.context";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoleToast } from "@/components/role-toast";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { Role } from "@/types/auth";

type UserStatus = "active" | "inactive";
type StaffRole = Exclude<Role, "STUDENT">;
type RoleFilter = "ALL" | StaffRole;

type ManagedUser = {
  id: string;
  name: string;
  email: string | null;
  studentId: string | null;
  employeeId: string | null;
  role: Role;
  roles: StaffRole[];
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

type UsersResponse = {
  users: ManagedUser[];
  total: number;
};

type UserMutationResponse = {
  message: string;
  user: ManagedUser;
  temporaryPassword?: string;
};

type UserFormSnapshot = {
  roles: StaffRole[];
  employeeId: string;
  name: string;
  email: string;
  status: UserStatus;
};

type FormErrors = {
  email: string;
  employeeId: string;
  name: string;
  roles: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleOptions: Array<{ label: string; value: StaffRole }> = [
  { value: "STUDENT_DEVELOPMENT", label: "ฝ่ายพัฒนานักศึกษา" },
  { value: "ADVISOR", label: "อาจารย์ที่ปรึกษา" },
  { value: "MENTAL_HEALTH", label: "ผู้เชี่ยวชาญ" },
  { value: "EXECUTIVE", label: "ผู้บริหาร" },
  { value: "ADMIN", label: "ผู้ดูแลระบบ" },
];

const roleBadgeMap: Record<StaffRole, string> = {
  STUDENT_DEVELOPMENT: "bg-rose-100 text-rose-700",
  ADMIN: "bg-violet-100 text-violet-700",
  ADVISOR: "bg-amber-100 text-amber-700",
  EXECUTIVE: "bg-cyan-100 text-cyan-700",
  INSTRUCTOR: "bg-slate-100 text-slate-700",
  MENTAL_HEALTH: "bg-blue-100 text-blue-700",
};

const roleLabelMap: Record<StaffRole, string> = {
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  ADMIN: "ผู้ดูแลระบบ",
  ADVISOR: "อาจารย์ที่ปรึกษา",
  EXECUTIVE: "ผู้บริหาร",
  INSTRUCTOR: "อาจารย์ที่ปรึกษา",
  MENTAL_HEALTH: "ผู้เชี่ยวชาญ",
};

const roleEmployeeIdPrefixMap: Record<StaffRole, string> = {
  STUDENT_DEVELOPMENT: "SDV",
  ADMIN: "ADM",
  ADVISOR: "ADV",
  EXECUTIVE: "EXE",
  INSTRUCTOR: "INS",
  MENTAL_HEALTH: "MHT",
};

const EMPLOYEE_ID_SEQUENCE_PAD_LENGTH = 3;

const buildPreviewEmployeeId = (prefix: string, sequence: number): string =>
  `${prefix}${String(sequence).padStart(EMPLOYEE_ID_SEQUENCE_PAD_LENGTH, "0")}`;

const emptyErrors: FormErrors = {
  email: "",
  employeeId: "",
  name: "",
  roles: "",
};

const staffRolePriorityOrder: StaffRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "STUDENT_DEVELOPMENT",
  "MENTAL_HEALTH",
  "ADVISOR",
];

const normalizeStaffRoles = (roles: StaffRole[]): StaffRole[] =>
  Array.from(new Set(roles)).sort(
    (left, right) => staffRolePriorityOrder.indexOf(left) - staffRolePriorityOrder.indexOf(right)
  );

const areSameStaffRoles = (left: StaffRole[], right: StaffRole[]): boolean => {
  const normalizedLeft = normalizeStaffRoles(left);
  const normalizedRight = normalizeStaffRoles(right);

  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((role, index) => normalizedRight[index] === role);
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

export default function ManageStaffPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [formRoles, setFormRoles] = useState<StaffRole[]>(["ADVISOR"]);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<UserStatus>("active");
  const [formErrors, setFormErrors] = useState<FormErrors>(emptyErrors);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<UserFormSnapshot | null>(null);

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("บันทึกข้อมูลสำเร็จ");
  const [successTemporaryPassword, setSuccessTemporaryPassword] = useState("");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<ManagedUser | null>(null);

  const primaryFormRole = useMemo<StaffRole>(() => normalizeStaffRoles(formRoles)[0] || "ADVISOR", [formRoles]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(UNAUTHENTICATED_PATH);
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/admin");
    router.prefetch("/admin/manage-students");
    router.prefetch("/admin/import-students");
    router.prefetch("/admin/import-staff");
  }, [router]);

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

  const usersForEmployeeIdPreview = useMemo(() => {
    if (!user || user.role === "STUDENT") {
      return users;
    }

    const alreadyIncluded = users.some((managedUser) => managedUser.id === user.id);
    if (alreadyIncluded) {
      return users;
    }

    return [
      ...users,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        employeeId: user.employeeId,
        role: user.role,
        roles: (user.roles || [user.role]).filter((role): role is StaffRole => role !== "STUDENT"),
        status: "active" as const,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    ];
  }, [user, users]);

  const generatedEmployeeId = useMemo(() => {
    const prefix = roleEmployeeIdPrefixMap[primaryFormRole];
    let maxSequence = 0;

    for (const managedUser of usersForEmployeeIdPreview) {
      if (managedUser.role !== primaryFormRole) {
        continue;
      }

      const normalizedEmployeeId = managedUser.employeeId?.trim().toUpperCase() || "";
      const match = new RegExp(`^${prefix}(\\d+)$`).exec(normalizedEmployeeId);
      if (!match) {
        continue;
      }

      const sequence = Number.parseInt(match[1], 10);
      if (Number.isFinite(sequence)) {
        maxSequence = Math.max(maxSequence, sequence);
      }
    }

    return buildPreviewEmployeeId(prefix, maxSequence + 1);
  }, [primaryFormRole, usersForEmployeeIdPreview]);

  const filteredUsers = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return users.filter((managedUser) => {
      if (managedUser.role === "STUDENT") {
        return false;
      }

      const matchesRole = roleFilter === "ALL" || managedUser.roles.includes(roleFilter);
      if (!matchesRole) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const roleKeywords = managedUser.roles.map((role) => roleLabelMap[role]).join(" ");

      return [managedUser.name, managedUser.email || "", managedUser.employeeId || "", roleKeywords]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [roleFilter, searchKeyword, users]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage)), [filteredUsers.length, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, searchKeyword]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (modalMode !== "add") {
      return;
    }

    setFormEmployeeId(generatedEmployeeId);
    setFormErrors((current) => ({ ...current, employeeId: "" }));
  }, [generatedEmployeeId, modalMode]);

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
    const trimmedEmployeeId = formEmployeeId.trim();
    const normalizedRoles = normalizeStaffRoles(formRoles);

    if (!trimmedName || !trimmedEmployeeId || !trimmedEmail || normalizedRoles.length === 0) {
      return false;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return false;
    }

    if (modalMode === "add") {
      return true;
    }

    if (!initialFormSnapshot) {
      return false;
    }

    return (
      !areSameStaffRoles(initialFormSnapshot.roles, formRoles) ||
      initialFormSnapshot.employeeId !== trimmedEmployeeId ||
      initialFormSnapshot.name !== trimmedName ||
      initialFormSnapshot.email !== trimmedEmail.toLowerCase() ||
      initialFormSnapshot.status !== formStatus
    );
  }, [formEmail, formEmployeeId, formName, formRoles, formStatus, initialFormSnapshot, modalMode]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setServerError("");

    try {
      const response = await api.get<UsersResponse>("/api/admin/users");
      setUsers(response.data.users);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace(UNAUTHENTICATED_PATH);
  };

  const resetForm = (roles: StaffRole[] = ["ADVISOR"]) => {
    setFormRoles(normalizeStaffRoles(roles));
    setFormEmployeeId("");
    setFormName("");
    setFormEmail("");
    setFormStatus("active");
    setFormErrors(emptyErrors);
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingUserId(null);
    setInitialFormSnapshot(null);
    resetForm(["ADVISOR"]);
    setModalOpen(true);
  };

  const openEditModal = (managedUser: ManagedUser) => {
    if (managedUser.role === "STUDENT") {
      return;
    }

    setModalMode("edit");
    setEditingUserId(managedUser.id);
    setFormRoles(normalizeStaffRoles(managedUser.roles));
    setFormEmployeeId(managedUser.employeeId || "");
    setFormName(managedUser.name);
    setFormEmail(managedUser.email || "");
    setFormStatus(managedUser.status);
    setFormErrors(emptyErrors);
    setInitialFormSnapshot({
      roles: normalizeStaffRoles(managedUser.roles),
      employeeId: managedUser.employeeId || "",
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
    setShowSuccessPopup(true);
  };

  const validateForm = (): { email: string; employeeId: string } | null => {
    const nextErrors: FormErrors = { ...emptyErrors };
    const trimmedName = formName.trim();
    const trimmedEmail = formEmail.trim();
    const trimmedEmployeeId = formEmployeeId.trim();
    const normalizedRoles = normalizeStaffRoles(formRoles);

    if (!trimmedName) {
      nextErrors.name = "กรุณาระบุชื่อ-นามสกุล";
    }

    if (normalizedRoles.length === 0) {
      nextErrors.roles = "กรุณาเลือกอย่างน้อย 1 role";
    }

    if (!trimmedEmployeeId) {
      nextErrors.employeeId = "กรุณาระบุรหัสพนักงาน/บุคลากร";
    }

    if (!trimmedEmail) {
      nextErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }

    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Email format is invalid";
    }

    setFormErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return null;
    }

    return {
      email: trimmedEmail.toLowerCase(),
      employeeId: trimmedEmployeeId,
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
      employeeId: modalMode === "add" ? undefined : validated.employeeId,
      name: formName.trim(),
      email: validated.email,
      roles: normalizeStaffRoles(formRoles),
      status: formStatus,
    };

    try {
      if (modalMode === "add") {
        const response = await api.post<UserMutationResponse>("/api/admin/users", payload);
        showSuccess(response.data.message || "เพิ่มผู้ใช้งานสำเร็จ", response.data.temporaryPassword || "");
      } else {
        if (!editingUserId) {
          setServerError("ไม่พบข้อมูลที่ต้องการแก้ไข");
          return;
        }

        const response = await api.put<UserMutationResponse>(`/api/admin/users/${editingUserId}`, payload);
        showSuccess(response.data.message || "อัปเดตข้อมูลสำเร็จ");
      }

      closeModal();
      await fetchUsers();
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.toLowerCase().includes("employee id")) {
        setFormErrors((current) => ({ ...current, employeeId: "รหัสพนักงานซ้ำในระบบ" }));
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

  const editingManagedUser = useMemo(
    () => users.find((managedUser) => managedUser.id === editingUserId) ?? null,
    [editingUserId, users]
  );

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
            <span className="text-xs font-semibold">เฉพาะผู้ดูแลระบบ</span>
          </div>
          <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium">
            กลับไป Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      activeNav="staff"
      onLogout={handleLogout}
      title="จัดการบุคลากร"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ (System Admin)"
    >
      <RoleToast
        open={showSuccessPopup}
        title={successMessage}
        description={
          successTemporaryPassword
            ? `รหัสผ่านชั่วคราว: ${successTemporaryPassword}`
            : "ระบบบันทึกการเปลี่ยนแปลงข้อมูลบุคลากรเรียบร้อยแล้ว"
        }
        tone="success"
        onClose={() => {
          setShowSuccessPopup(false);
          setSuccessTemporaryPassword("");
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteUser)}
        loading={Boolean(pendingDeleteUser && deletingId === pendingDeleteUser.id)}
        placement="admin-content"
        title="ยืนยันการลบผู้ใช้งาน"
        description={
          pendingDeleteUser
            ? `คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ ${pendingDeleteUser.name} (${pendingDeleteUser.employeeId || pendingDeleteUser.email || pendingDeleteUser.id})`
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-slate-800">จัดการบุคลากร</h2>
            <p className="mt-1 text-sm text-slate-500">ดูแลบัญชีอาจารย์ ผู้เชี่ยวชาญ ผู้บริหาร และผู้ดูแลระบบ แยกจากบัญชีนักศึกษาอย่างชัดเจน</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            <Link
              href="/admin/import-staff"
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              นำเข้าบุคลากร
            </Link>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              เพิ่มบุคลากรใหม่
            </button>
          </div>
        </div>

        {serverError ? <InlineAlert className="p-4">{serverError}</InlineAlert> : null}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="ค้นหาชื่อ, อีเมล, หรือรหัสพนักงาน..."
                className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 pl-10 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 outline-none transition focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">ทุกบทบาทบุคลากร</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden">
            <div className="divide-y divide-slate-100 md:hidden">
              {paginatedUsers.length === 0 && (
                <div className="flex items-center justify-center gap-2 px-5 py-10 text-center text-sm text-slate-500">
                  {loadingUsers ? (
                    <>
                      <span className="loader h-4 w-4 text-blue-600" aria-hidden />
                      กำลังโหลดข้อมูลบุคลากร...
                    </>
                  ) : (
                    "ไม่พบบุคลากร"
                  )}
                </div>
              )}
              {!loadingUsers && paginatedUsers.map((managedUser, index) => {
                const isDeleting = deletingId === managedUser.id;
                return (
                  <div key={managedUser.id} className="min-h-[152px] space-y-3 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">ลำดับที่ {startItemIndex + index + 1}</p>
                        <p className="mt-0.5 font-medium text-slate-900">{managedUser.name}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {managedUser.roles.map((role) => (
                          <span key={role} className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${roleBadgeMap[role]}`}>
                            {roleLabelMap[role]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">รหัสพนักงาน</p>
                        <p className="mt-0.5 font-mono text-sm text-slate-700">{managedUser.employeeId || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">อีเมล</p>
                        <p className="mt-0.5 truncate text-slate-700">{managedUser.email || "-"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${managedUser.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${managedUser.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {managedUser.status === "active" ? "ใช้งาน" : "ระงับ"}
                      </span>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => openEditModal(managedUser)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteUser(managedUser)}
                          className="hidden text-sm font-medium text-red-500 disabled:opacity-60"
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
              <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[20%]" />
                  <col className="w-[12%]" />
                  <col className="w-44" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-4 text-center font-medium">ลำดับ</th>
                    <th className="px-6 py-4 font-medium">ชื่อ-นามสกุล</th>
                    <th className="px-6 py-4 font-medium">บทบาท</th>
                    <th className="px-6 py-4 font-medium">รหัสพนักงาน</th>
                    <th className="px-6 py-4 font-medium">อีเมล</th>
                    <th className="px-6 py-4 text-center font-medium">สถานะ</th>
                    <th className="px-6 py-4 text-right font-medium">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                        {loadingUsers ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <span className="loader h-4 w-4 text-blue-600" aria-hidden />
                            กำลังโหลดข้อมูลบุคลากร...
                          </span>
                        ) : (
                          "ไม่พบบุคลากร"
                        )}
                      </td>
                    </tr>
                  )}

                  {!loadingUsers &&
                    paginatedUsers.map((managedUser, index) => {
                    const isDeleting = deletingId === managedUser.id;
                    return (
                      <tr key={managedUser.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4 text-center text-slate-500">{startItemIndex + index + 1}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          <p className="truncate">{managedUser.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {managedUser.roles.map((role) => (
                              <span key={role} className={`inline-flex max-w-full truncate rounded-md px-2.5 py-1 text-[10px] font-bold ${roleBadgeMap[role]}`}>
                                {roleLabelMap[role]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-700 whitespace-nowrap">{managedUser.employeeId || "-"}</td>
                        <td className="px-6 py-4 text-slate-500">
                          <p className="truncate">{managedUser.email || "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${managedUser.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${managedUser.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {managedUser.status === "active" ? "ใช้งาน" : "ระงับ"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(managedUser)}
                            className="mr-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteUser(managedUser)}
                            className="hidden text-sm font-medium text-red-500 disabled:opacity-60"
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
        className={`fixed inset-0 z-[220] bg-slate-900/40 transition-opacity duration-200 ${
          modalOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeModal}
      />
      <div className={`fixed inset-0 z-[230] flex items-center justify-center overflow-hidden p-3 sm:p-4 ${modalOpen ? "" : "pointer-events-none"}`}>
        <div
          className={`flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-all duration-200 sm:max-h-[calc(100dvh-2rem)] ${
            modalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">{modalMode === "add" ? "เพิ่มบุคลากรใหม่" : "แก้ไขข้อมูลบุคลากร"}</h3>
            <button type="button" onClick={closeModal} className="text-gray-400 transition-colors hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:p-6 lg:grid-cols-2" onSubmit={saveUser}>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                บทบาท (Role) <span className="text-red-500">*</span>
              </label>
              <select
                value={primaryFormRole}
                onChange={() => undefined}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Role เริ่มต้นหลัง login จะอิงจาก role ที่มีลำดับสูงสุดโดยอัตโนมัติ</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {roleOptions.map((option) => {
                  const checked = formRoles.includes(option.value);

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        checked ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setFormRoles((current) => {
                            const nextRoles = event.target.checked
                              ? [...current, option.value]
                              : current.filter((role) => role !== option.value);

                            return normalizeStaffRoles(nextRoles);
                          });
                          setFormErrors((current) => ({ ...current, roles: "" }));
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm text-slate-700">{option.label}</span>
                    </label>
                  );
                })}
              </div>
              {formErrors.roles && <p className="mt-1 text-xs text-red-500">{formErrors.roles}</p>}
              {modalMode === "edit" && <p className="mt-1 text-xs text-slate-500">ล็อก role ไว้เพื่อไม่ให้กระทบสิทธิ์และความสัมพันธ์ของข้อมูลเดิม</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                รหัสพนักงาน / บุคลากร <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formEmployeeId}
                onChange={(event) => {
                  setFormEmployeeId(event.target.value);
                  setFormErrors((current) => ({ ...current, employeeId: "" }));
                }}
                required
                readOnly={modalMode === "add"}
                disabled={modalMode === "add"}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${
                  formErrors.employeeId
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                    : "border-gray-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                } ${modalMode === "add" ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
                placeholder="ระบบจะสร้างให้อัตโนมัติ"
              />
              {modalMode === "add" ? (
                <p className="mt-1 text-xs text-slate-500">
                  ระบบจะสร้างรหัสอัตโนมัติตาม role ที่เลือก เช่น <span className="font-mono text-slate-700">{generatedEmployeeId}</span>
                </p>
              ) : null}
              {formErrors.employeeId && <p className="mt-1 text-xs text-red-500">{formErrors.employeeId}</p>}
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
                required
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${
                  formErrors.email
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                    : "border-gray-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                }`}
                placeholder="example@nucare.local"
              />
              <p className="mt-1 text-xs text-slate-500">Default password: `Nu` + lowercase email</p>
              {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
              <select
                value={formStatus}
                onChange={(event) => setFormStatus(event.target.value as UserStatus)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
              >
                <option value="active">ใช้งาน</option>
                <option value="inactive">ระงับ</option>
              </select>
            </div>

            {modalMode === "edit" && editingManagedUser ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 lg:col-span-2">
                <p className="text-sm font-semibold text-red-800">Danger Zone</p>
                <p className="mt-1 text-xs leading-5 text-red-700">
                  ปุ่มลบถูกย้ายมาไว้ท้ายฟอร์ม เพื่อให้ตรวจข้อมูลให้ครบก่อนตัดสินใจลบบัญชีบุคลากร
                </p>
                <button
                  type="button"
                  disabled={deletingId === editingManagedUser.id}
                  onClick={() => handleDeleteUser(editingManagedUser)}
                  className="mt-4 inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === editingManagedUser.id ? "กำลังลบ..." : "ลบบัญชีบุคลากร"}
                </button>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2 lg:col-span-2">
              <button type="button" onClick={closeModal} className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="inline-flex min-w-[124px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                <ConfirmSubmitLabel busy={submitting}>
                  {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </ConfirmSubmitLabel>
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
