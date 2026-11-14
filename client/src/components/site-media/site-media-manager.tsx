"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, ImagePlus, Pencil, Trash2, Video } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoleToast } from "@/components/role-toast";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InlineLoader } from "@/components/ui/page-loader";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { getYoutubeEmbedId } from "@/lib/home-media";
import { invalidatePublicSiteMediaCache } from "@/hooks/use-public-site-media";
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
  /** แสดงฟิลด์ลิงก์เมื่อกดภาพเสมอ (ใช้กับคารูเซลหน้านิสิต) */
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
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const itemsRef = useRef<SiteMediaItemDto[]>(items);
  const itemsBeforeDragRef = useRef<SiteMediaItemDto[] | null>(null);
  const dropCommittedRef = useRef(false);
  itemsRef.current = items;

  const activeSlotForReorder: SiteMediaSlot | null = lockedSlot ?? (slotFilter === "ALL" ? null : slotFilter);

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

  useEffect(() => {
    if (!activeSlotForReorder) {
      setReorderMode(false);
    }
  }, [activeSlotForReorder]);

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

  const isVideoSlot =
    form.slot === "HOME_VIDEO" ||
    Boolean(editingId && items.find((entry) => entry.id === editingId)?.slot === "HOME_VIDEO");

  const youtubePreviewId = isVideoSlot ? getYoutubeEmbedId(form.href) : null;
  const youtubePreviewPoster = youtubePreviewId
    ? `https://i.ytimg.com/vi/${youtubePreviewId}/hqdefault.jpg`
    : null;

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
      setToast({
        tone: "error",
        title: "ข้อมูลไม่ครบ",
        description: isVideoSlot ? "กรุณาระบุชื่อคลิปก่อนบันทึก" : "กรุณาระบุชื่อภาพก่อนบันทึก",
      });
      return;
    }
    if (isVideoSlot) {
      if (!form.href.trim() || !getYoutubeEmbedId(form.href)) {
        setToast({
          tone: "error",
          title: "ลิงก์คลิปไม่ถูกต้อง",
          description: "กรุณาแปะลิงก์ YouTube เช่น https://www.youtube.com/watch?v=... หรือ https://youtu.be/...",
        });
        return;
      }
    } else if (!editingId && !form.imageDataUrl) {
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
        isActive: form.isActive,
        ...(!isVideoSlot && form.imageDataUrl ? { imageDataUrl: form.imageDataUrl } : {}),
      };

      if (editingId) {
        await api.put(`${apiBasePath}/${editingId}`, payload);
        invalidatePublicSiteMediaCache(slot);
        setToast({
          tone: "success",
          title: isVideoSlot ? "บันทึกคลิปสำเร็จ" : "บันทึกภาพสำเร็จ",
          description: "บันทึกการแก้ไขสื่อประชาสัมพันธ์เรียบร้อยแล้ว",
        });
      } else {
        await api.post(apiBasePath, { slot, ...payload });
        invalidatePublicSiteMediaCache(slot);
        setToast({
          tone: "success",
          title: isVideoSlot ? "เพิ่มคลิปสำเร็จ" : "เพิ่มภาพสำเร็จ",
          description: isVideoSlot
            ? "คลิปใหม่ถูกเพิ่มต่อท้ายตามลำดับอัตโนมัติ"
            : "ภาพใหม่ถูกเพิ่มต่อท้ายตามลำดับอัตโนมัติ",
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
      invalidatePublicSiteMediaCache(deleteTarget.slot);
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

  const persistReorder = async (nextItems: SiteMediaItemDto[], previousItems: SiteMediaItemDto[]) => {
    if (!activeSlotForReorder) {
      return;
    }
    const sameOrder =
      nextItems.length === previousItems.length &&
      nextItems.every((entry, index) => entry.id === previousItems[index]?.id);
    if (sameOrder) {
      return;
    }

    setReordering(true);
    try {
      const { data } = await api.put<{ items: SiteMediaItemDto[] }>(`${apiBasePath}/reorder`, {
        slot: activeSlotForReorder,
        orderedIds: nextItems.map((entry) => entry.id),
      });
      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
      invalidatePublicSiteMediaCache(activeSlotForReorder);
      setToast({
        tone: "success",
        title: "จัดเรียงแล้ว",
        description: "บันทึกลำดับการแสดงเรียบร้อย",
      });
    } catch (err) {
      setItems(previousItems);
      setToast({
        tone: "error",
        title: "จัดเรียงไม่สำเร็จ",
        description: getApiErrorMessage(err, "ไม่สามารถบันทึกลำดับได้ ลองอีกครั้ง"),
      });
    } finally {
      setReordering(false);
      setDraggingId(null);
      itemsBeforeDragRef.current = null;
      dropCommittedRef.current = false;
    }
  };

  /** เลื่อนการ์ดตามนิ้วตอนลาก (ฝั่ง UI อย่างเดียว ยังไม่ยิง API) */
  const previewMoveToIndex = (toIndex: number) => {
    if (!draggingId || reordering) {
      return;
    }
    setItems((current) => {
      const fromIndex = current.findIndex((entry) => entry.id === draggingId);
      if (fromIndex < 0 || fromIndex === toIndex) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{heading}</h2>
          <p className="mt-1 text-sm text-slate-500">{groupedHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!activeSlotForReorder || items.length < 2 || reordering}
            onClick={() => setReorderMode((value) => !value)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              reorderMode
                ? "border-rose-300 bg-rose-600 text-white hover:bg-rose-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
            title={
              activeSlotForReorder
                ? "เปิดโหมดลากจัดเรียงในช่องที่เลือก"
                : "เลือกช่องสื่อก่อน แล้วค่อยเปิดโหมดจัดเรียง"
            }
          >
            <GripVertical className="h-4 w-4" />
            {reorderMode ? "ปิดโหมดลาก" : "โหมดลากจัดเรียง"}
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={reorderMode}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(lockedSlot ?? slotFilter) === "HOME_VIDEO" ? (
              <Video className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {(lockedSlot ?? slotFilter) === "HOME_VIDEO" ? "เพิ่มคลิป" : "เพิ่มภาพ"}
          </button>
        </div>
      </div>

      {reorderMode ? (
        <InlineAlert tone="warning">
          โหมดลากจัดเรียงเปิดอยู่ — ลากการ์ดในช่องนี้เพื่อเปลี่ยนลำดับ ระบบจะบันทึกเมื่อวางเท่านั้น
        </InlineAlert>
      ) : null}

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

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {loading ? (
        <InlineLoader label="กำลังโหลดรายการ..." />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-bold text-slate-700">
            {(lockedSlot ?? slotFilter) === "HOME_VIDEO" ? "ยังไม่มีคลิปในช่องนี้" : "ยังไม่มีภาพในช่องนี้"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {(lockedSlot ?? slotFilter) === "HOME_VIDEO"
              ? "กดเพิ่มคลิปแล้วแปะลิงก์ YouTube เพื่อแสดงบนหน้าแรก"
              : "กดเพิ่มภาพเพื่อแสดงบนหน้าเว็บ — ถ้ายังว่าง ระบบจะใช้ช่องว่างเดิม"}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              draggable={reorderMode && !reordering}
              onDragStart={(event) => {
                if (!reorderMode) return;
                dropCommittedRef.current = false;
                itemsBeforeDragRef.current = items;
                setDraggingId(item.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
              }}
              onDragOver={(event) => {
                if (!reorderMode || !draggingId || reordering) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                previewMoveToIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!reorderMode || reordering) return;
                dropCommittedRef.current = true;
                const previous = itemsBeforeDragRef.current ?? itemsRef.current;
                void persistReorder(itemsRef.current, previous);
              }}
              onDragEnd={() => {
                if (!dropCommittedRef.current && itemsBeforeDragRef.current) {
                  setItems(itemsBeforeDragRef.current);
                }
                setDraggingId(null);
                itemsBeforeDragRef.current = null;
                dropCommittedRef.current = false;
              }}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-transform duration-150 ${
                reorderMode
                  ? "cursor-grab border-amber-300 ring-1 ring-amber-200 active:cursor-grabbing"
                  : "border-slate-200"
              } ${
                draggingId === item.id
                  ? "z-10 scale-[1.02] opacity-80 shadow-lg ring-2 ring-amber-400"
                  : ""
              }`}
            >
              <div className="relative aspect-[16/10] bg-slate-100">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.altText || item.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <Video className="h-10 w-10" />
                  </div>
                )}
                {reorderMode ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">
                    <GripVertical className="h-3.5 w-3.5" />
                    ลากได้
                  </span>
                ) : null}
                {item.slot === "HOME_VIDEO" ? (
                  <span className="absolute right-3 top-3 rounded-full bg-blue-700/90 px-2.5 py-1 text-[11px] font-bold text-white">
                    คลิป
                  </span>
                ) : null}
                {!item.isActive ? (
                  <span
                    className={`absolute top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white ${
                      reorderMode ? "left-24" : "left-3"
                    }`}
                  >
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
                  <p className="mt-1 text-xs text-slate-500">ลำดับแสดง {index + 1}</p>
                  {item.href ? (
                    <p className="mt-1 truncate text-xs font-medium text-blue-700" title={item.href}>
                      ลิงก์: {item.href}
                    </p>
                  ) : null}
                </div>
                {!reorderMode ? (
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
                ) : null}
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
            <h3 className="text-lg font-bold text-slate-900">
              {editingId
                ? isVideoSlot
                  ? "แก้ไขคลิป"
                  : "แก้ไขภาพ"
                : isVideoSlot
                  ? "เพิ่มคลิป"
                  : "เพิ่มภาพ"}
            </h3>
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
                        href: event.target.value === "HOME_VIDEO" ? current.href : current.href,
                        imageDataUrl: event.target.value === "HOME_VIDEO" ? "" : current.imageDataUrl,
                        imagePreview: event.target.value === "HOME_VIDEO" ? "" : current.imagePreview,
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
                <span className="mb-1 block font-bold text-slate-700">
                  {isVideoSlot ? "ชื่อคลิป" : "ชื่อภาพ"}
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  maxLength={120}
                  required
                />
              </label>

              {!isVideoSlot ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-slate-700">คำอธิบายภาพ (alt)</span>
                  <input
                    value={form.altText}
                    onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    maxLength={200}
                  />
                </label>
              ) : null}

              {isVideoSlot ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-slate-700">ลิงก์ YouTube</span>
                  <input
                    value={form.href}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, href: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    placeholder="https://www.youtube.com/watch?v=... หรือ https://youtu.be/..."
                    maxLength={500}
                    inputMode="url"
                    autoComplete="url"
                    required
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    แปะลิงก์คลิปแล้วระบบจะแสดงบนหน้าแรกอัตโนมัติ
                  </span>
                </label>
              ) : (
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
              )}

              {isVideoSlot && youtubePreviewPoster ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youtubePreviewPoster}
                    alt="ตัวอย่างปกคลิป"
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              ) : null}

              {!isVideoSlot && form.imagePreview ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imagePreview} alt="ตัวอย่าง" className="max-h-48 w-full object-contain" />
                </div>
              ) : null}

              {!isVideoSlot && showActivityFields ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-slate-700">ลิงก์เมื่อกดภาพ</span>
                  <input
                    value={form.href}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, href: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    placeholder="https://... หรือ /student/advisor"
                    maxLength={500}
                    inputMode="url"
                    autoComplete="url"
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    นิสิตกดภาพแล้วจะเปิดลิงก์นี้ — ว่างไว้ได้ถ้าไม่ต้องการให้กดได้
                  </span>
                </label>
              ) : null}

              <div className="space-y-3">
                {!editingId ? (
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    ลำดับแสดงจะถูกกำหนดอัตโนมัติต่อท้ายรายการในช่องนี้ — จัดใหม่ได้ด้วยปุ่ม「โหมดลากจัดเรียง」
                  </p>
                ) : null}
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
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
        title={deleteTarget?.slot === "HOME_VIDEO" ? "ลบคลิปนี้?" : "ลบภาพนี้?"}
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
