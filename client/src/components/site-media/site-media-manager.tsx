"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoleToast } from "@/components/role-toast";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  readFileAsDataUrl,
  type SiteMediaItemDto,
  type SiteMediaSlot,
} from "@/lib/site-media-api";

export type SiteMediaSlotOption = {
  value: SiteMediaSlot;
  label: string;
  hint: string;
};

type FormState = {
  slot: SiteMediaSlot;
  title: string;
  altText: string;
  href: string;
  ctaLabel: string;
  tag: string;
  summary: string;
  sortOrder: string;
  isActive: boolean;
  imageDataUrl: string;
  imagePreview: string;
};

const emptyForm = (slot: SiteMediaSlot): FormState => ({
  slot,
  title: "",
  altText: "",
  href: "",
  ctaLabel: "",
  tag: "",
  summary: "",
  sortOrder: "0",
  isActive: true,
  imageDataUrl: "",
  imagePreview: "",
});

type SiteMediaManagerProps = {
  apiBasePath: string;
  slots: SiteMediaSlotOption[];
  heading: string;
  description: string;
  /** บังคับช่องเดียว — ไม่แสดงตัวกรอง/ตัวเลือกช่อง */
  lockedSlot?: SiteMediaSlot;
  /** แสดงฟิลด์สรุป/แท็ก/CTA เสมอ (ใช้กับหน้านิสิต) */
  alwaysShowActivityFields?: boolean;
};

/** UI เพิ่ม/แก้ไข/ลบสื่อประชาสัมพันธ์ — ใช้ร่วมแอดมินและงานพัฒนานิสิต */
export function SiteMediaManager({
  apiBasePath,
  slots,
  heading,
  description,
  lockedSlot,
  alwaysShowActivityFields = false,
}: SiteMediaManagerProps) {
  const defaultSlot = lockedSlot ?? slots[0]?.value ?? "STUDENT_ACTIVITY";
  const [slotFilter, setSlotFilter] = useState<SiteMediaSlot | "ALL">(lockedSlot ?? "ALL");
  const [items, setItems] = useState<SiteMediaItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{
    tone: "success" | "error";
    title: string;
    description: string;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(defaultSlot));
  const [deleteTarget, setDeleteTarget] = useState<SiteMediaItemDto | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const effectiveSlot = lockedSlot ?? (slotFilter === "ALL" ? null : slotFilter);
      const query = effectiveSlot
        ? `${apiBasePath}?includeInactive=1&slot=${effectiveSlot}`
        : `${apiBasePath}?includeInactive=1`;
      const { data } = await api.get<{ items: SiteMediaItemDto[] }>(query);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(getApiErrorMessage(err, "โหลดรายการสื่อไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, lockedSlot, slotFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const groupedHint = useMemo(() => {
    if (lockedSlot) {
      return slots.find((entry) => entry.value === lockedSlot)?.hint ?? description;
    }
    const option = slots.find((entry) => entry.value === slotFilter);
    return option?.hint ?? description;
  }, [description, lockedSlot, slotFilter, slots]);

  const showActivityFields =
    alwaysShowActivityFields ||
    form.slot === "STUDENT_ACTIVITY" ||
    Boolean(editingId && items.find((entry) => entry.id === editingId)?.slot === "STUDENT_ACTIVITY");

  const openCreate = () => {
    const slot = lockedSlot ?? (slotFilter === "ALL" ? defaultSlot : slotFilter);
    setEditingId(null);
    setForm(emptyForm(slot));
    setEditorOpen(true);
  };

  const openEdit = (item: SiteMediaItemDto) => {
    setEditingId(item.id);
    setForm({
      slot: item.slot,
      title: item.title,
      altText: item.altText,
      href: item.href ?? "",
      ctaLabel: item.ctaLabel ?? "",
      tag: item.tag ?? "",
      summary: item.summary ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
      imageDataUrl: "",
      imagePreview: item.imageUrl,
    });
    setEditorOpen(true);
  };

  const onPickImage = async (file: File | null) => {
    if (!file) {
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setToast({
        tone: "error",
        title: "ชนิดไฟล์ไม่รองรับ",
        description: "รองรับเฉพาะ JPEG / PNG / WebP ขนาดไม่เกิน 2 MB",
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({
        tone: "error",
        title: "ไฟล์ใหญ่เกินไป",
        description: "กรุณาเลือกรูปที่มีขนาดไม่เกิน 2 MB แล้วลองอีกครั้ง",
      });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((current) => ({
        ...current,
        imageDataUrl: dataUrl,
        imagePreview: dataUrl,
      }));
    } catch {
      setToast({
        tone: "error",
        title: "อ่านไฟล์ไม่สำเร็จ",
        description: "ไม่สามารถอ่านไฟล์ที่เลือกได้ ลองเลือกไฟล์ใหม่",
      });
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setToast({ tone: "error", title: "ข้อมูลไม่ครบ", description: "กรุณาระบุชื่อภาพก่อนบันทึก" });
      return;
    }
    if (!editingId && !form.imageDataUrl) {
      setToast({
        tone: "error",
        title: "ยังไม่ได้เลือกรูป",
        description: "กรุณาเลือกไฟล์รูปภาพก่อนเพิ่มรายการ",
      });
      return;
    }

    setSaving(true);
    try {
      const slot = lockedSlot ?? form.slot;
      const payload = {
        title: form.title.trim(),
        altText: form.altText.trim() || form.title.trim(),
        href: form.href.trim() || null,
        ctaLabel: form.ctaLabel.trim() || null,
        tag: form.tag.trim() || null,
        summary: form.summary.trim() || null,
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
        ...(form.imageDataUrl ? { imageDataUrl: form.imageDataUrl } : {}),
      };

      if (editingId) {
        await api.put(`${apiBasePath}/${editingId}`, payload);
        setToast({
          tone: "success",
          title: "บันทึกภาพแล้ว",
          description: "บันทึกการแก้ไขสื่อประชาสัมพันธ์เรียบร้อยแล้ว",
        });
      } else {
        await api.post(apiBasePath, { slot, ...payload });
        setToast({
          tone: "success",
          title: "เพิ่มภาพแล้ว",
          description: "ภาพใหม่จะแสดงบนหน้าเว็บตามช่องที่เลือก",
        });
      }
      setEditorOpen(false);
      await loadItems();
    } catch (err) {
      setToast({
        tone: "error",
        title: "บันทึกไม่สำเร็จ",
        description: getApiErrorMessage(err, "ไม่สามารถบันทึกสื่อได้ ลองอีกครั้ง"),
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await api.delete(`${apiBasePath}/${deleteTarget.id}`);
      setToast({
        tone: "success",
        title: "ลบภาพแล้ว",
        description: "นำรายการออกจากหน้าเว็บเรียบร้อยแล้ว",
      });
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      setToast({
        tone: "error",
        title: "ลบไม่สำเร็จ",
        description: getApiErrorMessage(err, "ไม่สามารถลบรายการได้ ลองอีกครั้ง"),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{heading}</h2>
          <p className="mt-1 text-sm text-slate-500">{groupedHint}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800"
        >
          <ImagePlus className="h-4 w-4" />
          เพิ่มภาพ
        </button>
      </div>

      {!lockedSlot && slots.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={slotFilter === "ALL"} label="ทั้งหมด" onClick={() => setSlotFilter("ALL")} />
          {slots.map((option) => (
            <FilterChip
              key={option.value}
              active={slotFilter === option.value}
              label={option.label}
              onClick={() => setSlotFilter(option.value)}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลดรายการ...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-bold text-slate-700">ยังไม่มีภาพในช่องนี้</p>
          <p className="mt-1 text-sm text-slate-500">
            กดเพิ่มภาพเพื่อแสดงบนหน้าเว็บ — ถ้ายังว่าง ระบบจะใช้ช่องว่างเดิม
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[16/10] bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.altText || item.title}
                  className="h-full w-full object-cover"
                />
                {!item.isActive ? (
                  <span className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white">
                    ปิดแสดง
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    {slots.find((entry) => entry.value === item.slot)?.label ?? item.slot}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">ลำดับ {item.sortOrder}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ลบ
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="ปิดฟอร์ม"
            onClick={() => !saving && setEditorOpen(false)}
          />
          <form
            onSubmit={onSubmit}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h3 className="text-lg font-bold text-slate-900">{editingId ? "แก้ไขภาพ" : "เพิ่มภาพ"}</h3>
            <div className="mt-4 space-y-3">
              {!editingId && !lockedSlot && slots.length > 1 ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-slate-700">ช่องแสดง</span>
                  <select
                    value={form.slot}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        slot: event.target.value as SiteMediaSlot,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {slots.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="mb-1 block font-bold text-slate-700">ชื่อภาพ</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  maxLength={120}
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-bold text-slate-700">คำอธิบายภาพ (alt)</span>
                <input
                  value={form.altText}
                  onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  maxLength={200}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-bold text-slate-700">
                  ไฟล์รูป {editingId ? "(เว้นว่างถ้าไม่เปลี่ยน)" : ""}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void onPickImage(event.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </label>

              {form.imagePreview ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imagePreview} alt="ตัวอย่าง" className="max-h-48 w-full object-contain" />
                </div>
              ) : null}

              {showActivityFields ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-bold text-slate-700">สรุปสั้น</span>
                    <textarea
                      value={form.summary}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, summary: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      rows={2}
                      maxLength={280}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-bold text-slate-700">แท็ก</span>
                      <input
                        value={form.tag}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, tag: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        maxLength={40}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-bold text-slate-700">ปุ่ม CTA</span>
                      <input
                        value={form.ctaLabel}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, ctaLabel: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        maxLength={40}
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    <span className="mb-1 block font-bold text-slate-700">ลิงก์ (ถ้ามี)</span>
                    <input
                      value={form.href}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, href: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      placeholder="/student/chat"
                      maxLength={500}
                    />
                  </label>
                </>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-slate-700">ลำดับแสดง</span>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 pt-7 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                  เปิดแสดงบนเว็บ
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditorOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <ConfirmSubmitLabel busy={saving}>
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </ConfirmSubmitLabel>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ลบภาพนี้?"
        description={
          deleteTarget
            ? `ลบ “${deleteTarget.title}” ออกจาก${slots.find((entry) => entry.value === deleteTarget.slot)?.label ?? "เว็บ"}`
            : ""
        }
        confirmLabel="ลบ"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <RoleToast
        open={Boolean(toast)}
        title={toast?.title ?? ""}
        description={toast?.description}
        tone={toast?.tone ?? "success"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-blue-700 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
      }`}
    >
      {label}
    </button>
  );
}
