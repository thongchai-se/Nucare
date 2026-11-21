"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Building2,
  HardDrive,
  RefreshCw,
  Server,
  ShieldAlert,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { PageLoader } from "@/components/ui/page-loader";
import { useDashboardToast } from "@/context/dashboard-toast.context";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  UI_BUTTON_PRIMARY,
  UI_BUTTON_SECONDARY,
  UI_DIALOG_CANCEL,
  UI_DIALOG_DANGER,
} from "@/lib/ui-classes";
import api from "@/lib/axios";

const MAINTENANCE_CONFIRM_PHRASE = "ปิดปรับปรุง";

type SystemHealth = {
  ok: boolean;
  api: { ok: boolean };
  database: { ok: boolean; latencyMs: number | null };
  directory: { configured: boolean; host: string | null };
  timestamp: string;
};

type SiteSettingsAdmin = {
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  facultyNameTh: string;
  universityNameTh: string;
  facultyEnglishBanner: string;
  contactAddress: string;
  contactPhoneDisplay: string;
  contactPhoneTel: string;
  contactFaxDisplay: string;
  contactOfficeHoursLabel: string;
  contactOfficeHours: string;
  updatedAt: string;
};

type DirectoryStatus = {
  configured: boolean;
  host: string | null;
  faculty: string;
  programs: string[];
};

type BrandFormState = {
  facultyNameTh: string;
  universityNameTh: string;
  facultyEnglishBanner: string;
  contactAddress: string;
  contactPhoneDisplay: string;
  contactPhoneTel: string;
  contactFaxDisplay: string;
  contactOfficeHoursLabel: string;
  contactOfficeHours: string;
};

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-[#0057A8] focus:outline-none focus:ring-2 focus:ring-[#0057A8]/30";

const labelClassName = "block text-xs font-semibold text-slate-600";

/** หน้าตั้งค่าระบบแอดมิน — สุขภาพระบบ โหมดปิดปรับปรุง directory และข้อมูลคณะ */
export function SettingsView() {
  const { pushToast } = useDashboardToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SiteSettingsAdmin | null>(null);
  const [directory, setDirectory] = useState<DirectoryStatus | null>(null);
  const [catalogTesting, setCatalogTesting] = useState(false);
  const [catalogResult, setCatalogResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState<BrandFormState | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [confirmCloseMaintenance, setConfirmCloseMaintenance] = useState(false);
  const [confirmOpenSystem, setConfirmOpenSystem] = useState(false);
  const [maintenanceConfirmText, setMaintenanceConfirmText] = useState("");

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await api.get<SystemHealth>("/api/admin/system/health");
      setHealth(response.data);
    } catch (err) {
      setHealthError(getApiErrorMessage(err, "โหลดสถานะระบบไม่สำเร็จ"));
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [settingsRes, directoryRes, healthRes] = await Promise.all([
        api.get<SiteSettingsAdmin>("/api/admin/system/settings"),
        api.get<DirectoryStatus>("/api/admin/external-directory/status"),
        api.get<SystemHealth>("/api/admin/system/health"),
      ]);

      const nextSettings = settingsRes.data;
      setSettings(nextSettings);
      setMaintenanceEnabled(nextSettings.maintenanceEnabled);
      setMaintenanceMessage(nextSettings.maintenanceMessage);
      setBrandForm({
        facultyNameTh: nextSettings.facultyNameTh,
        universityNameTh: nextSettings.universityNameTh,
        facultyEnglishBanner: nextSettings.facultyEnglishBanner,
        contactAddress: nextSettings.contactAddress,
        contactPhoneDisplay: nextSettings.contactPhoneDisplay,
        contactPhoneTel: nextSettings.contactPhoneTel,
        contactFaxDisplay: nextSettings.contactFaxDisplay,
        contactOfficeHoursLabel: nextSettings.contactOfficeHoursLabel,
        contactOfficeHours: nextSettings.contactOfficeHours,
      });
      setDirectory(directoryRes.data);
      setHealth(healthRes.data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, "โหลดการตั้งค่าระบบไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** สลับโหมดปิดปรับปรุงหลังยืนยันแล้ว */
  const applyMaintenanceToggle = async (nextEnabled: boolean) => {
    setSavingMaintenance(true);
    setMaintenanceError(null);
    try {
      const response = await api.patch<SiteSettingsAdmin>("/api/admin/system/settings", {
        maintenanceEnabled: nextEnabled,
        maintenanceMessage,
      });
      setSettings(response.data);
      setMaintenanceEnabled(response.data.maintenanceEnabled);
      setMaintenanceMessage(response.data.maintenanceMessage);
      setConfirmCloseMaintenance(false);
      setConfirmOpenSystem(false);
      setMaintenanceConfirmText("");
      pushToast({
        title: nextEnabled ? "ปิดปรับปรุงระบบแล้ว" : "เปิดระบบแล้ว",
        tone: "success",
      });
    } catch (err) {
      setMaintenanceError(
        getApiErrorMessage(
          err,
          nextEnabled ? "ปิดปรับปรุงไม่สำเร็จ" : "เปิดระบบไม่สำเร็จ"
        )
      );
    } finally {
      setSavingMaintenance(false);
    }
  };

  const requestMaintenanceToggle = () => {
    setMaintenanceError(null);
    if (maintenanceEnabled) {
      setConfirmOpenSystem(true);
      return;
    }
    setMaintenanceConfirmText("");
    setConfirmCloseMaintenance(true);
  };

  /** บันทึกเฉพาะข้อความแจ้ง โดยไม่สลับสถานะโหมด */
  const saveMaintenanceMessage = async () => {
    setSavingMaintenance(true);
    setMaintenanceError(null);
    try {
      const response = await api.patch<SiteSettingsAdmin>("/api/admin/system/settings", {
        maintenanceMessage,
      });
      setSettings(response.data);
      setMaintenanceMessage(response.data.maintenanceMessage);
      pushToast({ title: "บันทึกข้อความแจ้งแล้ว", tone: "success" });
    } catch (err) {
      setMaintenanceError(getApiErrorMessage(err, "บันทึกข้อความไม่สำเร็จ"));
    } finally {
      setSavingMaintenance(false);
    }
  };

  const saveBrand = async () => {
    if (!brandForm) return;
    setSavingBrand(true);
    setBrandError(null);
    try {
      const response = await api.patch<SiteSettingsAdmin>("/api/admin/system/settings", brandForm);
      setSettings(response.data);
      setBrandForm({
        facultyNameTh: response.data.facultyNameTh,
        universityNameTh: response.data.universityNameTh,
        facultyEnglishBanner: response.data.facultyEnglishBanner,
        contactAddress: response.data.contactAddress,
        contactPhoneDisplay: response.data.contactPhoneDisplay,
        contactPhoneTel: response.data.contactPhoneTel,
        contactFaxDisplay: response.data.contactFaxDisplay,
        contactOfficeHoursLabel: response.data.contactOfficeHoursLabel,
        contactOfficeHours: response.data.contactOfficeHours,
      });
      pushToast({ title: "บันทึกข้อมูลคณะแล้ว", tone: "success" });
    } catch (err) {
      setBrandError(getApiErrorMessage(err, "บันทึกข้อมูลคณะไม่สำเร็จ"));
    } finally {
      setSavingBrand(false);
    }
  };

  const testCatalog = async () => {
    setCatalogTesting(true);
    setCatalogResult(null);
    try {
      const response = await api.get<{ faculties: unknown[] }>("/api/admin/external-directory/catalog");
      const count = Array.isArray(response.data.faculties) ? response.data.faculties.length : 0;
      setCatalogResult({ ok: true, text: `เชื่อมต่อสำเร็จ · พบคณะ ${count} รายการ` });
    } catch (err) {
      setCatalogResult({
        ok: false,
        text: getApiErrorMessage(err, "ทดสอบ catalog ไม่สำเร็จ"),
      });
    } finally {
      setCatalogTesting(false);
    }
  };

  if (loading) {
    return <PageLoader label="กำลังโหลดการตั้งค่าระบบ" fullScreen={false} className="py-16" />;
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmOpenSystem}
        loading={savingMaintenance}
        title="ยืนยันเปิดระบบ"
        description="ผู้ใช้ทั่วไปจะเข้าใช้งานได้อีกครั้งหลังเปิดระบบ"
        confirmLabel="เปิดระบบ"
        cancelLabel="ยกเลิก"
        tone="primary"
        onCancel={() => {
          if (!savingMaintenance) {
            setConfirmOpenSystem(false);
          }
        }}
        onConfirm={() => {
          void applyMaintenanceToggle(false);
        }}
      />

      {confirmCloseMaintenance ? (
        <AppDialogShell
          labelledBy="maintenance-confirm-title"
          describedBy="maintenance-confirm-description"
          panelClassName="max-w-md"
          zIndexClassName="z-[10001]"
          onBackdropClick={
            savingMaintenance
              ? undefined
              : () => {
                  setConfirmCloseMaintenance(false);
                  setMaintenanceConfirmText("");
                }
          }
        >
          <div className="relative px-6 pb-6 pt-8 sm:px-8">
            <h2 id="maintenance-confirm-title" className="text-lg font-bold text-slate-900">
              ยืนยันปิดปรับปรุงระบบ
            </h2>
            <p id="maintenance-confirm-description" className="mt-3 text-sm leading-6 text-slate-600">
              ผู้ใช้ทั่วไปจะเข้าใช้งานไม่ได้จนกว่าจะเปิดระบบอีกครั้ง พิมพ์{" "}
              <span className="font-semibold text-slate-900">{MAINTENANCE_CONFIRM_PHRASE}</span>{" "}
              เพื่อยืนยัน
            </p>
            <input
              value={maintenanceConfirmText}
              onChange={(event) => setMaintenanceConfirmText(event.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0057A8] focus:ring-2 focus:ring-[#0057A8]/30"
              placeholder={`พิมพ์ ${MAINTENANCE_CONFIRM_PHRASE}`}
              autoComplete="off"
              disabled={savingMaintenance}
            />
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-center">
              <button
                type="button"
                className={UI_DIALOG_DANGER}
                disabled={
                  savingMaintenance ||
                  maintenanceConfirmText.trim() !== MAINTENANCE_CONFIRM_PHRASE
                }
                onClick={() => {
                  void applyMaintenanceToggle(true);
                }}
              >
                <ConfirmSubmitLabel busy={savingMaintenance}>ปิดปรับปรุง</ConfirmSubmitLabel>
              </button>
              <button
                type="button"
                className={UI_DIALOG_CANCEL}
                disabled={savingMaintenance}
                onClick={() => {
                  setConfirmCloseMaintenance(false);
                  setMaintenanceConfirmText("");
                }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </AppDialogShell>
      ) : null}

      <div>
        <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h2>
        <p className="mt-1 text-sm text-slate-500">
          สถานะระบบ โหมดปิดปรับปรุง การเชื่อมต่อคลังรายชื่อ และข้อมูลติดต่อคณะ
        </p>
      </div>

      {loadError ? (
        <p className="text-sm font-medium text-red-600">{loadError}</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#0057A8]" />
            <h3 className="font-bold text-slate-800">สถานะระบบ</h3>
          </div>
          <button
            type="button"
            className={UI_BUTTON_SECONDARY}
            onClick={() => void loadHealth()}
            disabled={healthLoading}
          >
            {healthLoading ? (
              <span className="loader h-4 w-4 text-blue-600" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            รีเฟรช
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatusCard
            icon={<Server className="h-4 w-4" />}
            label="API"
            value={health?.api.ok ? "ปกติ" : "ไม่พร้อม"}
            ok={Boolean(health?.api.ok)}
          />
          <StatusCard
            icon={<HardDrive className="h-4 w-4" />}
            label="ฐานข้อมูล"
            value={
              health?.database.ok
                ? health.database.latencyMs != null
                  ? `${health.database.latencyMs} ms`
                  : "ปกติ"
                : "เชื่อมต่อไม่ได้"
            }
            ok={Boolean(health?.database.ok)}
          />
          <StatusCard
            icon={<Building2 className="h-4 w-4" />}
            label="Directory"
            value={
              health?.directory.configured
                ? health.directory.host || "ตั้งค่าแล้ว"
                : "ยังไม่ตั้งค่า"
            }
            ok={Boolean(health?.directory.configured)}
          />
        </div>
        {health?.timestamp ? (
          <p className="mt-3 text-xs text-slate-500">
            ตรวจล่าสุด {new Date(health.timestamp).toLocaleString("th-TH")}
          </p>
        ) : null}
        {healthError ? <p className="mt-2 text-sm font-medium text-red-600">{healthError}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          <h3 className="font-bold text-slate-800">โหมดปิดปรับปรุง</h3>
        </div>
        <p className="text-sm text-slate-600">
          สถานะ:{" "}
          <span className={`font-semibold ${maintenanceEnabled ? "text-amber-700" : "text-emerald-700"}`}>
            {maintenanceEnabled ? "ปิดปรับปรุงอยู่" : "เปิดใช้งานปกติ"}
          </span>
          {" — "}ผู้ใช้ทั่วไปเข้าไม่ได้เมื่อปิดปรับปรุง
        </p>
        <label className={`mt-4 ${labelClassName}`} htmlFor="maintenance-message">
          ข้อความแจ้งผู้ใช้
        </label>
        <textarea
          id="maintenance-message"
          className={`${inputClassName} min-h-24`}
          value={maintenanceMessage}
          onChange={(event) => setMaintenanceMessage(event.target.value)}
          maxLength={500}
          placeholder="ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={UI_BUTTON_PRIMARY}
            onClick={requestMaintenanceToggle}
            disabled={savingMaintenance}
          >
            {savingMaintenance ? (
              <span className="loader h-4 w-4 text-white" aria-hidden="true" />
            ) : null}
            {maintenanceEnabled ? "เปิดระบบ" : "ปิดปรับปรุง"}
          </button>
          <button
            type="button"
            className={UI_BUTTON_SECONDARY}
            onClick={() => void saveMaintenanceMessage()}
            disabled={savingMaintenance}
          >
            บันทึกข้อความ
          </button>
        </div>
        {maintenanceError ? (
          <p className="mt-2 text-sm font-medium text-red-600">{maintenanceError}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            <h3 className="font-bold text-slate-800">คลังรายชื่อภายนอก (Directory)</h3>
          </div>
          <button
            type="button"
            className={UI_BUTTON_SECONDARY}
            onClick={() => void testCatalog()}
            disabled={catalogTesting || !directory?.configured}
          >
            {catalogTesting ? (
              <span className="loader h-4 w-4 text-blue-600" aria-hidden="true" />
            ) : null}
            ทดสอบ catalog
          </button>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoRow label="สถานะการตั้งค่า" value={directory?.configured ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้ง DIRECTORY_*"} />
          <InfoRow label="โฮสต์" value={directory?.host || "—"} />
          <InfoRow label="คณะ (env)" value={directory?.faculty || "—"} />
          <InfoRow label="สาขา (env)" value={directory?.programs?.join(", ") || "—"} />
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          API key เก็บใน env เท่านั้น ไม่แก้ผ่านหน้านี้
        </p>
        {catalogResult ? (
          <p className={`mt-2 text-sm font-medium ${catalogResult.ok ? "text-emerald-700" : "text-red-600"}`}>
            {catalogResult.text}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-600" />
          <h3 className="font-bold text-slate-800">ข้อมูลคณะ / ติดต่อ</h3>
        </div>
        {brandForm ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="ชื่อคณะ (ไทย)"
              value={brandForm.facultyNameTh}
              onChange={(value) => setBrandForm({ ...brandForm, facultyNameTh: value })}
            />
            <Field
              label="ชื่อมหาวิทยาลัย (ไทย)"
              value={brandForm.universityNameTh}
              onChange={(value) => setBrandForm({ ...brandForm, universityNameTh: value })}
            />
            <Field
              className="md:col-span-2"
              label="แบนเนอร์อังกฤษ"
              value={brandForm.facultyEnglishBanner}
              onChange={(value) => setBrandForm({ ...brandForm, facultyEnglishBanner: value })}
            />
            <Field
              className="md:col-span-2"
              label="ที่อยู่"
              value={brandForm.contactAddress}
              onChange={(value) => setBrandForm({ ...brandForm, contactAddress: value })}
              multiline
            />
            <Field
              label="โทรศัพท์ (แสดง)"
              value={brandForm.contactPhoneDisplay}
              onChange={(value) => setBrandForm({ ...brandForm, contactPhoneDisplay: value })}
            />
            <Field
              label="โทรศัพท์ (tel:)"
              value={brandForm.contactPhoneTel}
              onChange={(value) => setBrandForm({ ...brandForm, contactPhoneTel: value })}
            />
            <Field
              label="แฟกซ์"
              value={brandForm.contactFaxDisplay}
              onChange={(value) => setBrandForm({ ...brandForm, contactFaxDisplay: value })}
            />
            <Field
              label="ป้ายชั่วโมงทำงาน"
              value={brandForm.contactOfficeHoursLabel}
              onChange={(value) => setBrandForm({ ...brandForm, contactOfficeHoursLabel: value })}
            />
            <Field
              className="md:col-span-2"
              label="ชั่วโมงทำงาน"
              value={brandForm.contactOfficeHours}
              onChange={(value) => setBrandForm({ ...brandForm, contactOfficeHours: value })}
            />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={UI_BUTTON_PRIMARY}
            onClick={() => void saveBrand()}
            disabled={savingBrand || !brandForm}
          >
            {savingBrand ? (
              <span className="loader h-4 w-4 text-white" aria-hidden="true" />
            ) : null}
            บันทึกข้อมูลคณะ
          </button>
          {settings?.updatedAt ? (
            <p className="text-xs text-slate-500">
              อัปเดตล่าสุด {new Date(settings.updatedAt).toLocaleString("th-TH")}
            </p>
          ) : null}
        </div>
        {brandError ? <p className="mt-2 text-sm font-medium text-red-600">{brandError}</p> : null}
      </section>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  ok,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-sm font-bold ${ok ? "text-emerald-700" : "text-amber-700"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const id = `field-${label}`;
  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className={`${inputClassName} min-h-24`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className={inputClassName}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
