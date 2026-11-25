"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Save,
  Printer,
  FileSpreadsheet,
  Eye,
  Edit3,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  GripVertical,
  RefreshCw,
  BookmarkCheck,
  FileText,
  Copy,
  Link2,
} from "lucide-react";
import {
  ChecklistCategory,
  ChecklistDocument,
  CheckStatus,
  WorkDayRow,
} from "@/types/checklist";
import {
  buildExportFileName,
  buildHardwareSerialsFromChecklist,
  COMPANY_HEADER,
  createId,
  groupItemsPreservingOrder,
  isNetworkHardware,
  parseGroupedName,
} from "@/lib/defaultTemplate";
import {
  saveAsMasterTemplate,
  saveChecklist,
  uploadChecklistPhoto,
} from "@/lib/supabase";
import PinConfirmModal from "@/components/PinConfirmModal";

const A4DocumentPreview = dynamic(
  () => import("@/components/A4DocumentPreview"),
  {
    loading: () => (
      <div className="flex w-full items-center justify-center py-16">
        <div className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
          กำลังสร้างตัวอย่างหน้ากระดาษ A4...
        </div>
      </div>
    ),
  }
);

interface ChecklistEditorProps {
  initialDoc: ChecklistDocument;
  initialMode?: "edit" | "preview";
  autoPrint?: boolean;
  onBack: () => void;
  onSaved: (savedDoc: ChecklistDocument) => void;
}

const toDateInputValue = (val: string): string => {
  const trimmed = (val || "").trim();
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
};

const fromDateInputValue = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

export default function ChecklistEditor({
  initialDoc,
  initialMode = "edit",
  autoPrint = false,
  onBack,
  onSaved,
}: ChecklistEditorProps) {
  const [doc, setDoc] = useState<ChecklistDocument>(initialDoc);
  const [mode, setMode] = useState<"edit" | "preview">(initialMode);
  const hasAutoPrintedRef = useRef(false);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = buildExportFileName(doc);
    return () => {
      document.title = prevTitle;
    };
  }, [doc.shop_name, doc.store_id]);

  useEffect(() => {
    if (autoPrint && !hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      document.title = buildExportFileName(doc);
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, doc]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    label: string;
    onConfirm: () => void;
  } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const requestDeleteWithPin = (label: string, onConfirm: () => void) => {
    setDeleteConfirm({ label, onConfirm });
  };
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ catId: string; itemId: string } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ catId: string; itemId: string } | null>(null);
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<{ section: string; id: string } | null>(null);
  const [dragOverRow, setDragOverRow] = useState<{ section: string; id: string } | null>(null);
  const [dragGroup, setDragGroup] = useState<{ section: string; group: string } | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<{ section: string; group: string } | null>(null);

  const reorderRows = <T extends { id: string }>(
    list: T[],
    fromId: string,
    toId: string
  ): T[] => {
    const next = [...list];
    const fromIdx = next.findIndex((r) => r.id === fromId);
    const toIdx = next.findIndex((r) => r.id === toId);
    if (fromIdx === -1 || toIdx === -1) return list;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    return next;
  };

  const reorderGroupedRows = <T extends { id: string }>(
    list: T[],
    fromId: string,
    toId: string,
    getName: (item: T) => string,
    setName: (item: T, name: string) => T
  ): T[] => {
    const targetItem = list.find((r) => r.id === toId);
    const sourceItem = list.find((r) => r.id === fromId);
    if (!targetItem || !sourceItem) return list;
    const targetRaw = getName(targetItem);
    const targetGroup = parseGroupedName(targetRaw).group;
    const targetHasPrefix = targetRaw.startsWith("[");
    const sourceLabel = parseGroupedName(getName(sourceItem)).label;
    const updatedSource = targetHasPrefix
      ? setName(sourceItem, `[${targetGroup}] ${sourceLabel}`)
      : setName(sourceItem, sourceLabel);
    const replaced = list.map((r) => (r.id === fromId ? updatedSource : r));
    return reorderRows(replaced, fromId, toId);
  };

  const renameGroup = <T,>(
    list: T[],
    oldGroup: string,
    newGroupRaw: string,
    getName: (item: T) => string,
    setName: (item: T, name: string) => T
  ): T[] => {
    const newGroup = newGroupRaw.trim();
    if (!newGroup || newGroup === oldGroup) return list;
    return list.map((item) => {
      const { group, label } = parseGroupedName(getName(item));
      if (group !== oldGroup) return item;
      return setName(item, `[${newGroup}] ${label}`);
    });
  };

  const reorderGroups = <T,>(
    list: T[],
    fromGroup: string,
    toGroup: string,
    getName: (item: T) => string
  ): T[] => {
    if (fromGroup === toGroup) return list;
    const grouped = groupItemsPreservingOrder(list, getName);
    const fromIdx = grouped.findIndex((g) => g.group === fromGroup);
    const toIdx = grouped.findIndex((g) => g.group === toGroup);
    if (fromIdx === -1 || toIdx === -1) return list;
    const [moved] = grouped.splice(fromIdx, 1);
    grouped.splice(toIdx, 0, moved);
    return grouped.flatMap((g) => g.entries.map((e) => e.item));
  };

  const renumberCategories = (categories: ChecklistCategory[]): ChecklistCategory[] =>
    categories.map((cat, catIdx) => {
      const num = catIdx + 1;
      const strippedTitle = cat.title.replace(/^\d+\.\s*/, "");
      return {
        ...cat,
        title: `${num}. ${strippedTitle}`,
        items: cat.items.map((item, itemIdx) => ({
          ...item,
          code: `${num}.${itemIdx + 1}`,
        })),
      };
    });

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveChecklist(doc);
      setDoc(saved);
      onSaved(saved);
      showToast("ok", "บันทึกข้อมูลลง Supabase เรียบร้อยแล้ว");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก";
      showToast("err", `บันทึกไม่สำเร็จ: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    document.title = buildExportFileName(doc);
    setMode("preview");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { exportChecklistToExcel } = await import("@/lib/exportExcel");
      await exportChecklistToExcel(doc);
      showToast("ok", "Export ไฟล์ Excel (.xlsx) เรียบร้อยแล้ว");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการ Export";
      showToast("err", `Export ไม่สำเร็จ: ${message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportWord = async () => {
    setExportingWord(true);
    try {
      const { exportChecklistToWord } = await import("@/lib/exportWord");
      await exportChecklistToWord(doc);
      showToast("ok", "Export ไฟล์ Word (.docx) เรียบร้อยแล้ว");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการ Export";
      showToast("err", `Export Word ไม่สำเร็จ: ${message}`);
    } finally {
      setExportingWord(false);
    }
  };

  const updatePayload = <K extends keyof ChecklistDocument["payload"]>(
    key: K,
    value: ChecklistDocument["payload"][K]
  ) => {
    setDoc((prev) => ({
      ...prev,
      payload: {
        ...prev.payload,
        [key]: value,
      },
    }));
  };

  const getTiming = (timingKey: string) =>
    doc.payload.sectionTimings?.[timingKey] ?? { startTime: "", endTime: "" };

  const setTiming = (timingKey: string, field: "startTime" | "endTime", value: string) => {
    const current = getTiming(timingKey);
    updatePayload("sectionTimings", {
      ...(doc.payload.sectionTimings ?? {}),
      [timingKey]: {
        ...current,
        [field]: value,
      },
    });
  };

  const renderTimingInputs = (timingKey: string) => {
    const t = getTiming(timingKey);
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="inline-flex items-center gap-1 text-slate-600">
          <span>เวลาเริ่ม:</span>
          <input
            type="time"
            value={t.startTime}
            onChange={(e) => setTiming(timingKey, "startTime", e.target.value)}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-slate-600">
          <span>เวลาเสร็จ:</span>
          <input
            type="time"
            value={t.endTime}
            onChange={(e) => setTiming(timingKey, "endTime", e.target.value)}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </label>
      </div>
    );
  };

  const handlePhotoUpload = async (photoId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingId(photoId);
    try {
      const publicUrl = await uploadChecklistPhoto(file, doc.store_id);
      updatePayload(
        "photos",
        doc.payload.photos.map((p) =>
          p.id === photoId ? { ...p, imageUrl: publicUrl } : p
        )
      );
      showToast("ok", "อัปโหลดรูปภาพเรียบร้อยแล้ว");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
      showToast("err", `อัปโหลดรูปไม่สำเร็จ: ${msg}`);
    } finally {
      setUploadingId(null);
    }
  };

  const setCheckStatus = (catId: string, itemId: string, status: CheckStatus) => {
    updatePayload(
      "checklistCategories",
      doc.payload.checklistCategories.map((cat) =>
        cat.id === catId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId
                  ? { ...item, status: item.status === status ? null : status }
                  : item
              ),
            }
          : cat
      )
    );
  };

  const renderWorkDaySection = (
    title: string,
    key: "plannedWorkDays" | "extraWorkDays",
    rows: WorkDayRow[]
  ) => (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() =>
            updatePayload(key, [
              ...rows,
              { id: createId("wd"), date: "", detail: "", staff: "", jobNo: "" },
            ])
          }
          className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
        >
          <Plus className="h-3.5 w-3.5" /> เพิ่มแถว
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="w-8 px-1 py-2"></th>
              <th className="w-40 px-3 py-2 text-left">วันที่</th>
              <th className="px-3 py-2 text-left">รายละเอียด</th>
              <th className="px-3 py-2 text-left w-44">เจ้าหน้าที่</th>
              <th className="px-3 py-2 text-left w-36">เลขที่ใบงาน</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const isOver = dragOverRow?.section === key && dragOverRow?.id === row.id;
              return (
                <tr
                  key={row.id}
                  draggable
                  onDragStart={(e) => {
                    setDragRow({ section: key, id: row.id });
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (dragRow?.section === key && dragRow.id !== row.id) {
                      e.preventDefault();
                      setDragOverRow({ section: key, id: row.id });
                    }
                  }}
                  onDrop={(e) => {
                    if (dragRow?.section === key && dragRow.id !== row.id) {
                      e.preventDefault();
                      updatePayload(key, reorderRows(rows, dragRow.id, row.id));
                    }
                    setDragRow(null);
                    setDragOverRow(null);
                  }}
                  onDragEnd={() => {
                    setDragRow(null);
                    setDragOverRow(null);
                  }}
                  className={isOver ? "bg-sky-50" : ""}
                >
                  <td className="px-1.5 text-center">
                    <span className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing">
                      <GripVertical className="inline h-4 w-4" />
                    </span>
                  </td>
                  <td className="p-1.5">
                  <input
                    type="date"
                    value={toDateInputValue(row.date)}
                    onChange={(e) =>
                      updatePayload(
                        key,
                        rows.map((r) =>
                          r.id === row.id
                            ? { ...r, date: fromDateInputValue(e.target.value) }
                            : r
                        )
                      )
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={row.detail}
                    placeholder="รายละเอียดงาน"
                    onChange={(e) =>
                      updatePayload(
                        key,
                        rows.map((r) => (r.id === row.id ? { ...r, detail: e.target.value } : r))
                      )
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={row.staff}
                    placeholder="ชื่อเจ้าหน้าที่"
                    onChange={(e) =>
                      updatePayload(
                        key,
                        rows.map((r) => (r.id === row.id ? { ...r, staff: e.target.value } : r))
                      )
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={row.jobNo}
                    placeholder="เลขที่ใบงาน"
                    onChange={(e) =>
                      updatePayload(
                        key,
                        rows.map((r) => (r.id === row.id ? { ...r, jobNo: e.target.value } : r))
                      )
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </td>
                <td className="p-1.5 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      requestDeleteWithPin(row.detail || "แถวรายการนี้", () =>
                        updatePayload(key, rows.filter((r) => r.id !== row.id))
                      )
                    }
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="ลบแถว (ต้องใส่รหัสยืนยัน)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Top Action Bar */}
      <div className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-xs backdrop-blur">
        <div className="mx-auto max-w-7xl space-y-2.5 px-3 py-2.5 sm:px-4 sm:py-3">
          {/* Row 1: Back (Left) | Branch Name (Center, Large & Bold) | Mode Toggle (Right) */}
          <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>กลับหน้ารายการ</span>
              </button>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 sm:hidden">
                {doc.id ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
              </span>
            </div>

            <div className="min-w-0 text-center">
              <div className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                {doc.shop_name || "เอกสาร Check List ใหม่"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs font-medium text-slate-500">
                <span className="font-mono font-semibold text-sky-700">
                  Branch ID: {doc.store_id || "-"}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  {doc.id ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
                </span>
              </div>
            </div>

            <div className="flex w-full rounded-xl border-2 border-sky-200 bg-sky-50/70 p-1 shadow-sm sm:inline-flex sm:w-auto">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:flex-initial sm:px-4 sm:text-sm ${
                  mode === "edit"
                    ? "bg-white text-sky-700 shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Edit3 className="h-4 w-4" /> แก้ไขฟอร์ม
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:flex-initial sm:px-4 sm:text-sm ${
                  mode === "preview"
                    ? "bg-sky-600 text-white shadow"
                    : "text-sky-800 hover:bg-white/70"
                }`}
              >
                <Eye className="h-4 w-4" /> ตัวอย่าง A4
              </button>
            </div>
          </div>

          {/* Row 2: Centered Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 pt-2.5 sm:gap-2">
            {doc.id && (
              <button
                type="button"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/?id=${doc.id}`;
                  await navigator.clipboard.writeText(shareUrl);
                  showToast("ok", "คัดลอก Link สำหรับส่งให้ Engineer แล้ว");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 sm:text-sm"
                title="คัดลอก Link ส่งให้ Engineer"
              >
                <Link2 className="h-4 w-4" />
                Copy Link
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMasterModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 sm:text-sm"
              title="บันทึกโครงสร้างนี้เป็นค่าเริ่มต้นเมื่อกดสร้างเอกสารใหม่ (ต้องใส่รหัสยืนยัน)"
            >
              <BookmarkCheck className="h-4 w-4" />
              ตั้งเป็น Template ตั้งต้น
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 sm:text-sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึก
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-900 sm:text-sm"
            >
              <Printer className="h-4 w-4" />
              พิมพ์ A4 / PDF
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 sm:text-sm"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Export Excel
            </button>

            <button
              type="button"
              onClick={handleExportWord}
              disabled={exportingWord}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 sm:text-sm"
            >
              {exportingWord ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Export Word
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50">
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.type === "ok" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <PinConfirmModal
        open={showMasterModal}
        title="ยืนยันการตั้งเป็น Template ตั้งต้น"
        description="กรุณากรอกรหัสยืนยันเพื่อบันทึกโครงสร้างเอกสารนี้เป็น Master Template"
        confirmLabel="ยืนยันบันทึก"
        onCancel={() => setShowMasterModal(false)}
        onConfirm={async () => {
          await saveAsMasterTemplate(doc);
          setShowMasterModal(false);
          showToast("ok", "บันทึกเป็น Master Template เรียบร้อยแล้ว");
        }}
      />

      <PinConfirmModal
        open={Boolean(deleteConfirm)}
        title="ยืนยันการลบหัวข้อ / รายการ"
        subtitle={deleteConfirm ? `รายการ: ${deleteConfirm.label}` : undefined}
        description="กรุณากรอกรหัสยืนยันเพื่อลบรายการนี้"
        confirmLabel="ยืนยันลบ"
        tone="danger"
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => {
          deleteConfirm?.onConfirm();
          setDeleteConfirm(null);
        }}
      />

      {/* Preview Mode OR Print Target */}
      {mode === "preview" ? (
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start overflow-x-auto px-2 py-4 sm:items-center sm:px-4 sm:py-6 print:block print:max-w-none print:overflow-visible print:p-0">
          <A4DocumentPreview doc={doc} />
        </div>
      ) : (
        <div className="no-print mx-auto max-w-5xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
          {/* Company Header Card */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <img
              src={COMPANY_HEADER.logoPath}
              alt="VerticalTec"
              className="h-12 w-auto shrink-0 object-contain"
            />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {COMPANY_HEADER.fullName}
              </h2>
              <p className="text-sm text-slate-600">{COMPANY_HEADER.address}</p>
              <p className="mt-1 inline-block rounded-md bg-sky-50 px-2.5 py-1 text-base font-extrabold text-sky-800 sm:text-lg">
                {COMPANY_HEADER.documentTitle}
              </p>
            </div>
          </div>

          {/* 1. General Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-b border-slate-100 pb-2 text-base font-bold text-slate-900">
              ข้อมูลทั่วไป (สาขา & ผู้รับผิดชอบ)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Date time
                </label>
                <input
                  type="date"
                  value={toDateInputValue(doc.doc_datetime)}
                  onChange={(e) => setDoc({ ...doc, doc_datetime: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Engineer In-Charge
                </label>
                <input
                  type="text"
                  value={doc.engineer_in_charge}
                  onChange={(e) => setDoc({ ...doc, engineer_in_charge: e.target.value })}
                  placeholder="ชื่อวิศวกรผู้รับผิดชอบ"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Branch ID
                </label>
                <input
                  type="text"
                  value={doc.store_id}
                  onChange={(e) => setDoc({ ...doc, store_id: e.target.value })}
                  placeholder="รหัสสาขา"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={doc.shop_name}
                  onChange={(e) => setDoc({ ...doc, shop_name: e.target.value })}
                  placeholder="ชื่อสาขา"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={doc.address}
                  onChange={(e) => setDoc({ ...doc, address: e.target.value })}
                  placeholder="ที่อยู่สาขา"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  เวลาเริ่มงาน
                </label>
                <input
                  type="time"
                  value={doc.payload.workStartTime || ""}
                  onChange={(e) => updatePayload("workStartTime", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  เวลาปิดงาน
                </label>
                <input
                  type="time"
                  value={doc.payload.workEndTime || ""}
                  onChange={(e) => updatePayload("workEndTime", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* 2. Hardware Serial and IP Address Report */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-base font-bold text-slate-900">
                  Hardware Serial and IP Address Report
                </h2>
                {renderTimingInputs("sec:hardware")}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updatePayload(
                      "hardwareSerials",
                      buildHardwareSerialsFromChecklist(
                        doc.payload.checklistCategories,
                        doc.payload.hardwareSerials
                      )
                    );
                    showToast("ok", "ดึงรายการอุปกรณ์จาก Check List เรียบร้อยแล้ว");
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> ดึงรายการจาก Check List
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePayload("hardwareSerials", [
                      ...doc.payload.hardwareSerials,
                      { id: createId("hw"), itemName: "", serialNumber: "", ipAddress: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                >
                  <Plus className="h-3.5 w-3.5" /> เพิ่มอุปกรณ์
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {groupItemsPreservingOrder(doc.payload.hardwareSerials, (hw) => hw.itemName).map(
                (grp) => {
                  const isGroupOver =
                    dragOverGroup?.section === "hw" && dragOverGroup?.group === grp.group;
                  return (
                  <div
                    key={grp.group}
                    onDragOver={(e) => {
                      if (dragGroup?.section === "hw" && dragGroup.group !== grp.group) {
                        e.preventDefault();
                        setDragOverGroup({ section: "hw", group: grp.group });
                      }
                    }}
                    onDrop={(e) => {
                      if (dragGroup?.section === "hw" && dragGroup.group !== grp.group) {
                        e.preventDefault();
                        updatePayload(
                          "hardwareSerials",
                          reorderGroups(
                            doc.payload.hardwareSerials,
                            dragGroup.group,
                            grp.group,
                            (hw) => hw.itemName
                          )
                        );
                      }
                      setDragGroup(null);
                      setDragOverGroup(null);
                    }}
                    className={`overflow-hidden rounded-lg border transition ${
                      isGroupOver ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
                    }`}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDragGroup({ section: "hw", group: grp.group });
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragGroup(null);
                        setDragOverGroup(null);
                      }}
                      className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-3 py-2"
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <span
                          className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing"
                          title="ลากเพื่อสลับลำดับกลุ่ม"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          defaultValue={grp.group}
                          key={`hw-grp-${grp.group}`}
                          onBlur={(e) =>
                            updatePayload(
                              "hardwareSerials",
                              renameGroup(
                                doc.payload.hardwareSerials,
                                grp.group,
                                e.target.value,
                                (r) => r.itemName,
                                (r, name) => ({ ...r, itemName: name })
                              )
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-800 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none sm:w-64 sm:flex-none"
                        />
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">
                          ({grp.entries.length} รายการ)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const cloned = grp.entries.map(({ item, label }) => ({
                              id: createId("hw"),
                              itemName: `[${grp.group} (สำเนา)] ${label}`,
                              serialNumber: "",
                              ipAddress: "",
                            }));
                            updatePayload("hardwareSerials", [
                              ...doc.payload.hardwareSerials,
                              ...cloned,
                            ]);
                          }}
                          className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          title="คัดลอกกลุ่มนี้"
                        >
                          <Copy className="h-3 w-3" /> คัดลอกกลุ่ม
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updatePayload("hardwareSerials", [
                              ...doc.payload.hardwareSerials,
                              {
                                id: createId("hw"),
                                itemName:
                                  grp.group === "อื่นๆ / เพิ่มเติม"
                                    ? ""
                                    : `[${grp.group}] `,
                                serialNumber: "",
                                ipAddress: "",
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-sky-700 shadow-sm hover:bg-sky-50"
                        >
                          <Plus className="h-3 w-3" /> เพิ่มในกลุ่มนี้
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-600">
                        <tr>
                          <th className="w-8 px-1 py-1.5"></th>
                          <th className="px-2 py-1.5 text-center w-12">ลำดับ</th>
                          <th className="px-3 py-1.5 text-left">รายการอุปกรณ์ (Hardware)</th>
                          <th className="px-3 py-1.5 text-left w-52">Serial Number (S/N)</th>
                          <th className="px-3 py-1.5 text-left w-44">IP Address</th>
                          <th className="px-2 py-1.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {grp.entries.map(({ item: hw, index: idx, label }) => {
                          const { group } = parseGroupedName(hw.itemName);
                          const hasPrefix = hw.itemName.startsWith("[");
                          const isOver = dragOverRow?.section === "hw" && dragOverRow?.id === hw.id;
                          return (
                            <tr
                              key={hw.id}
                              draggable
                              onDragStart={(e) => {
                                setDragRow({ section: "hw", id: hw.id });
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => {
                                if (dragRow?.section === "hw" && dragRow.id !== hw.id) {
                                  e.preventDefault();
                                  setDragOverRow({ section: "hw", id: hw.id });
                                }
                              }}
                              onDrop={(e) => {
                                if (dragRow?.section === "hw" && dragRow.id !== hw.id) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updatePayload(
                                    "hardwareSerials",
                                    reorderGroupedRows(
                                      doc.payload.hardwareSerials,
                                      dragRow.id,
                                      hw.id,
                                      (r) => r.itemName,
                                      (r, name) => ({ ...r, itemName: name })
                                    )
                                  );
                                }
                                setDragRow(null);
                                setDragOverRow(null);
                              }}
                              onDragEnd={() => {
                                setDragRow(null);
                                setDragOverRow(null);
                              }}
                              className={`hover:bg-slate-50/50 ${isOver ? "bg-sky-50" : ""}`}
                            >
                              <td className="px-1.5 text-center">
                                <span className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing">
                                  <GripVertical className="inline h-4 w-4" />
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center text-xs text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={label}
                                  placeholder="เช่น POS Cashier 1, Slip Printer"
                                  onChange={(e) => {
                                    const nextVal = hasPrefix
                                      ? `[${group}] ${e.target.value}`
                                      : e.target.value;
                                    updatePayload(
                                      "hardwareSerials",
                                      doc.payload.hardwareSerials.map((r) =>
                                        r.id === hw.id ? { ...r, itemName: nextVal } : r
                                      )
                                    );
                                  }}
                                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={hw.serialNumber}
                                  placeholder="S/N"
                                  onChange={(e) =>
                                    updatePayload(
                                      "hardwareSerials",
                                      doc.payload.hardwareSerials.map((r) =>
                                        r.id === hw.id
                                          ? { ...r, serialNumber: e.target.value }
                                          : r
                                      )
                                    )
                                  }
                                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-sm focus:border-sky-500 focus:outline-none"
                                />
                              </td>
                              <td className="p-1.5">
                                {isNetworkHardware(label) ? (
                                  <input
                                    type="text"
                                    value={hw.ipAddress || ""}
                                    placeholder="192.168.1.x"
                                    onChange={(e) =>
                                      updatePayload(
                                        "hardwareSerials",
                                        doc.payload.hardwareSerials.map((r) =>
                                          r.id === hw.id
                                            ? { ...r, ipAddress: e.target.value }
                                            : r
                                        )
                                      )
                                    }
                                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-sm focus:border-sky-500 focus:outline-none"
                                  />
                                ) : (
                                  <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center text-xs text-slate-400">
                                    — ไม่ใช่อุปกรณ์ Network
                                  </div>
                                )}
                              </td>
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestDeleteWithPin(label || "อุปกรณ์ Hardware", () =>
                                      updatePayload(
                                        "hardwareSerials",
                                        doc.payload.hardwareSerials.filter((r) => r.id !== hw.id)
                                      )
                                    )
                                  }
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title="ลบรายการ (ต้องใส่รหัสยืนยัน)"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      </table>
                    </div>
                  </div>
                  );
                }
              )}
            </div>
          </section>

          {/* 3. Work Days Summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-base font-bold text-slate-900">เอกสารสรุปวันทำงาน</h2>
                {renderTimingInputs("sec:workdays")}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  สรุปรวมวันที่ทำงานทั้งหมด (วัน):
                </label>
                <input
                  type="number"
                  min={0}
                  value={doc.total_work_days}
                  onChange={(e) =>
                    setDoc({ ...doc, total_work_days: Number(e.target.value) || 0 })
                  }
                  className="w-20 rounded-lg border border-slate-300 px-2.5 py-1 text-center text-sm font-semibold focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
            {renderWorkDaySection(
              "วันทำงานตามแผนที่กำหนด",
              "plannedWorkDays",
              doc.payload.plannedWorkDays
            )}
            {renderWorkDaySection(
              "วันทำงานเพิ่มเติมจากแผนที่กำหนดไว้",
              "extraWorkDays",
              doc.payload.extraWorkDays
            )}
          </section>

          {/* 4. Software Version */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-base font-bold text-slate-900">Software Version</h2>
                {renderTimingInputs("sec:software")}
              </div>
              <button
                type="button"
                onClick={() =>
                  updatePayload("softwareVersions", [
                    ...doc.payload.softwareVersions,
                    { id: createId("sw"), name: "", version: "" },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่มโปรแกรม
              </button>
            </div>
            <div className="space-y-4">
              {groupItemsPreservingOrder(doc.payload.softwareVersions, (sw) => sw.name).map(
                (grp) => {
                  const isGroupOver =
                    dragOverGroup?.section === "sw" && dragOverGroup?.group === grp.group;
                  return (
                  <div
                    key={grp.group}
                    onDragOver={(e) => {
                      if (dragGroup?.section === "sw" && dragGroup.group !== grp.group) {
                        e.preventDefault();
                        setDragOverGroup({ section: "sw", group: grp.group });
                      }
                    }}
                    onDrop={(e) => {
                      if (dragGroup?.section === "sw" && dragGroup.group !== grp.group) {
                        e.preventDefault();
                        updatePayload(
                          "softwareVersions",
                          reorderGroups(
                            doc.payload.softwareVersions,
                            dragGroup.group,
                            grp.group,
                            (sw) => sw.name
                          )
                        );
                      }
                      setDragGroup(null);
                      setDragOverGroup(null);
                    }}
                    className={`overflow-hidden rounded-lg border transition ${
                      isGroupOver ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
                    }`}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDragGroup({ section: "sw", group: grp.group });
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragGroup(null);
                        setDragOverGroup(null);
                      }}
                      className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-3 py-2"
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <span
                          className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing"
                          title="ลากเพื่อสลับลำดับกลุ่ม"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          defaultValue={grp.group}
                          key={`sw-grp-${grp.group}`}
                          onBlur={(e) =>
                            updatePayload(
                              "softwareVersions",
                              renameGroup(
                                doc.payload.softwareVersions,
                                grp.group,
                                e.target.value,
                                (r) => r.name,
                                (r, name) => ({ ...r, name })
                              )
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-800 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none sm:w-64 sm:flex-none"
                        />
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">
                          ({grp.entries.length} รายการ)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updatePayload("softwareVersions", [
                            ...doc.payload.softwareVersions,
                            {
                              id: createId("sw"),
                              name:
                                grp.group === "อื่นๆ / เพิ่มเติม"
                                  ? ""
                                  : `[${grp.group}] `,
                              version: "",
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-sky-700 shadow-sm hover:bg-sky-50"
                      >
                        <Plus className="h-3 w-3" /> เพิ่มในกลุ่มนี้
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                      {grp.entries.map(({ item: sw, label }) => {
                        const { group } = parseGroupedName(sw.name);
                        const hasPrefix = sw.name.startsWith("[");
                        const isOver = dragOverRow?.section === "sw" && dragOverRow?.id === sw.id;
                        return (
                          <div
                            key={sw.id}
                            draggable
                            onDragStart={(e) => {
                              setDragRow({ section: "sw", id: sw.id });
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => {
                              if (dragRow?.section === "sw" && dragRow.id !== sw.id) {
                                e.preventDefault();
                                setDragOverRow({ section: "sw", id: sw.id });
                              }
                            }}
                            onDrop={(e) => {
                              if (dragRow?.section === "sw" && dragRow.id !== sw.id) {
                                e.preventDefault();
                                updatePayload(
                                  "softwareVersions",
                                  reorderRows(doc.payload.softwareVersions, dragRow.id, sw.id)
                                );
                              }
                              setDragRow(null);
                              setDragOverRow(null);
                            }}
                            onDragEnd={() => {
                              setDragRow(null);
                              setDragOverRow(null);
                            }}
                            className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2 ${
                              isOver ? "ring-2 ring-sky-400" : ""
                            }`}
                          >
                            <span className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing">
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <input
                              type="text"
                              value={label}
                              placeholder="ชื่อโปรแกรม"
                              onChange={(e) => {
                                const nextVal = hasPrefix
                                  ? `[${group}] ${e.target.value}`
                                  : e.target.value;
                                updatePayload(
                                  "softwareVersions",
                                  doc.payload.softwareVersions.map((r) =>
                                    r.id === sw.id ? { ...r, name: nextVal } : r
                                  )
                                );
                              }}
                              className="w-44 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-sky-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={sw.version}
                              placeholder="Version เช่น v2.4.1"
                              onChange={(e) =>
                                updatePayload(
                                  "softwareVersions",
                                  doc.payload.softwareVersions.map((r) =>
                                    r.id === sw.id ? { ...r, version: e.target.value } : r
                                  )
                                )
                              }
                              className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm focus:border-sky-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                requestDeleteWithPin(label || "รายการ Software", () =>
                                  updatePayload(
                                    "softwareVersions",
                                    doc.payload.softwareVersions.filter((r) => r.id !== sw.id)
                                  )
                                )
                              }
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="ลบรายการ (ต้องใส่รหัสยืนยัน)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                }
              )}
            </div>
          </section>

          {/* 5. Check List Categories (Drag & Drop + Auto Renumber) */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  รายการตรวจสอบ (Check List)
                </h2>
                <p className="text-xs text-slate-500">
                  ลากไอคอน ⋮⋮ เพื่อสลับลำดับหัวข้อหรือ Section (ระบบจะเรียงเลขให้อัตโนมัติ)
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updatePayload(
                    "checklistCategories",
                    renumberCategories([
                      ...doc.payload.checklistCategories,
                      {
                        id: createId("cat"),
                        title: `${doc.payload.checklistCategories.length + 1}. Section ใหม่`,
                        items: [
                          {
                            id: createId("item"),
                            code: `${doc.payload.checklistCategories.length + 1}.1`,
                            label: "รายการใหม่",
                            status: null,
                            remark: "",
                          },
                        ],
                      },
                    ])
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่ม Section
              </button>
            </div>
            <div className="space-y-6">
              {doc.payload.checklistCategories.map((cat) => (
                <div
                  key={cat.id}
                  onDragOver={(e) => {
                    if (draggedCatId && draggedCatId !== cat.id) {
                      e.preventDefault();
                      setDragOverCatId(cat.id);
                    }
                  }}
                  onDrop={(e) => {
                    if (draggedCatId && draggedCatId !== cat.id) {
                      e.preventDefault();
                      const list = [...doc.payload.checklistCategories];
                      const fromIdx = list.findIndex((c) => c.id === draggedCatId);
                      const toIdx = list.findIndex((c) => c.id === cat.id);
                      if (fromIdx !== -1 && toIdx !== -1) {
                        const [moved] = list.splice(fromIdx, 1);
                        list.splice(toIdx, 0, moved);
                        updatePayload("checklistCategories", renumberCategories(list));
                      }
                      setDraggedCatId(null);
                      setDragOverCatId(null);
                    }
                  }}
                  className={`rounded-lg border transition ${
                    dragOverCatId === cat.id
                      ? "border-sky-500 ring-2 ring-sky-200"
                      : "border-slate-200"
                  }`}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDraggedCatId(cat.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedCatId(null);
                      setDragOverCatId(null);
                    }}
                    className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-3 py-2"
                  >
                    <div className="flex flex-1 items-center gap-2">
                      <span
                        className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing"
                        title="ลากเพื่อสลับลำดับ Section"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={cat.title}
                        onChange={(e) =>
                          updatePayload(
                            "checklistCategories",
                            doc.payload.checklistCategories.map((c) =>
                              c.id === cat.id ? { ...c, title: e.target.value } : c
                            )
                          )
                        }
                        className="flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-bold text-slate-900 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {renderTimingInputs(`cl:${cat.id}`)}
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...doc.payload.checklistCategories];
                          const idx = list.findIndex((c) => c.id === cat.id);
                          const clonedCat: ChecklistCategory = {
                            id: createId("cat"),
                            title: `${cat.title} (สำเนา)`,
                            items: cat.items.map((it) => ({
                              id: createId("item"),
                              code: it.code,
                              label: it.label,
                              status: null,
                              remark: "",
                            })),
                          };
                          list.splice(idx + 1, 0, clonedCat);
                          updatePayload("checklistCategories", renumberCategories(list));
                        }}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        title="คัดลอก Section นี้"
                      >
                        <Copy className="h-3 w-3" /> Copy Section
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePayload(
                            "checklistCategories",
                            renumberCategories(
                              doc.payload.checklistCategories.map((c) =>
                                c.id === cat.id
                                  ? {
                                      ...c,
                                      items: [
                                        ...c.items,
                                        {
                                          id: createId("item"),
                                          code: "",
                                          label: "หัวข้อเพิ่มเติม",
                                          status: null,
                                          remark: "",
                                        },
                                      ],
                                    }
                                  : c
                              )
                            )
                          )
                        }
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-sky-700 shadow-sm hover:bg-sky-50"
                      >
                        <Plus className="h-3 w-3" /> เพิ่มหัวข้อ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (doc.payload.checklistCategories.length <= 1) return;
                          requestDeleteWithPin(cat.title || "Section นี้", () =>
                            updatePayload(
                              "checklistCategories",
                              renumberCategories(
                                doc.payload.checklistCategories.filter((c) => c.id !== cat.id)
                              )
                            )
                          );
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="ลบ Section (ต้องใส่รหัสยืนยัน)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {(() => {
                      let lastGroup = "";
                      return cat.items.map((item) => {
                        const isDragOver =
                          dragOverItem?.catId === cat.id && dragOverItem?.itemId === item.id;
                        const hasPrefix = item.label.startsWith("[");
                        const { group, label: cleanLabel } = parseGroupedName(item.label);
                        const showGroupBanner = hasPrefix && group !== lastGroup;
                        if (hasPrefix) lastGroup = group;
                        return (
                          <React.Fragment key={item.id}>
                            {showGroupBanner && (
                              <div className="bg-sky-50/70 px-3 py-1.5 text-xs font-bold text-sky-900">
                                {group}
                              </div>
                            )}
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDraggedItem({ catId: cat.id, itemId: item.id });
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => {
                                if (!draggedItem || draggedItem.itemId === item.id) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverItem({ catId: cat.id, itemId: item.id });
                              }}
                              onDrop={(e) => {
                                if (!draggedItem || draggedItem.itemId === item.id) return;
                                e.preventDefault();
                                e.stopPropagation();

                                let movedItemObj: ChecklistCategory["items"][number] | null = null;
                                const withoutSource = doc.payload.checklistCategories.map((c) => {
                                  if (c.id !== draggedItem.catId) return c;
                                  const found = c.items.find((it) => it.id === draggedItem.itemId);
                                  if (found) movedItemObj = found;
                                  return {
                                    ...c,
                                    items: c.items.filter((it) => it.id !== draggedItem.itemId),
                                  };
                                });

                                if (movedItemObj) {
                                  const inserted = withoutSource.map((c) => {
                                    if (c.id !== cat.id) return c;
                                    const targetIdx = c.items.findIndex((it) => it.id === item.id);
                                    const nextItems = [...c.items];
                                    nextItems.splice(
                                      targetIdx === -1 ? nextItems.length : targetIdx,
                                      0,
                                      movedItemObj!
                                    );
                                    return { ...c, items: nextItems };
                                  });
                                  updatePayload("checklistCategories", renumberCategories(inserted));
                                }

                                setDraggedItem(null);
                                setDragOverItem(null);
                              }}
                              onDragEnd={() => {
                                setDraggedItem(null);
                                setDragOverItem(null);
                              }}
                              className={`flex flex-col gap-2 p-3 transition sm:flex-row sm:items-center sm:justify-between ${
                                isDragOver ? "bg-sky-50 ring-1 ring-inset ring-sky-400" : ""
                              } ${draggedItem?.itemId === item.id ? "opacity-50" : ""}`}
                            >
                              <div className="flex flex-1 items-center gap-2">
                                <span
                                  className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing"
                                  title="ลากเพื่อจัดลำดับ"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <span className="w-12 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-center text-xs font-semibold text-slate-700">
                                  {item.code}
                                </span>
                                <input
                                  type="text"
                                  value={hasPrefix ? cleanLabel : item.label}
                                  onChange={(e) => {
                                    const nextLabel = hasPrefix
                                      ? `[${group}] ${e.target.value}`
                                      : e.target.value;
                                    updatePayload(
                                      "checklistCategories",
                                      doc.payload.checklistCategories.map((c) =>
                                        c.id === cat.id
                                          ? {
                                              ...c,
                                              items: c.items.map((it) =>
                                                it.id === item.id ? { ...it, label: nextLabel } : it
                                              ),
                                            }
                                          : c
                                      )
                                    );
                                  }}
                                  className="flex-1 rounded border border-transparent px-1.5 py-1 text-sm text-slate-800 hover:border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none"
                                />
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setCheckStatus(cat.id, item.id, "pass")}
                                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                      item.status === "pass"
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-white"
                                    }`}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> ผ่าน
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCheckStatus(cat.id, item.id, "fail")}
                                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                      item.status === "fail"
                                        ? "bg-rose-600 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-white"
                                    }`}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> ไม่ผ่าน
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCheckStatus(cat.id, item.id, "na")}
                                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                      item.status === "na"
                                        ? "bg-slate-600 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-white"
                                    }`}
                                  >
                                    <MinusCircle className="h-3.5 w-3.5" /> N/A
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  value={item.remark}
                                  placeholder="หมายเหตุ"
                                  onChange={(e) =>
                                    updatePayload(
                                      "checklistCategories",
                                      doc.payload.checklistCategories.map((c) =>
                                        c.id === cat.id
                                          ? {
                                              ...c,
                                              items: c.items.map((it) =>
                                                it.id === item.id
                                                  ? { ...it, remark: e.target.value }
                                                  : it
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none sm:w-36"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    requestDeleteWithPin(`${item.code} ${item.label}`.trim(), () =>
                                      updatePayload(
                                        "checklistCategories",
                                        renumberCategories(
                                          doc.payload.checklistCategories.map((c) =>
                                            c.id === cat.id
                                              ? {
                                                  ...c,
                                                  items: c.items.filter((it) => it.id !== item.id),
                                                }
                                              : c
                                          )
                                        )
                                      )
                                    )
                                  }
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title="ลบหัวข้อ (ต้องใส่รหัสยืนยัน)"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Photos (Grouped by Machine) */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    เอกสารแนบรูปรายละเอียดเครื่องและใบเสร็จ (แยกตามเครื่อง)
                  </h2>
                  <p className="text-xs text-slate-500">
                    อัปโหลดรูปภาพในฟอร์มเพื่อแสดงในหน้า A4 และ Excel (หากยังไม่อัปโหลด ระบบจะเว้นช่องว่างบน A4 ไว้ให้)
                  </p>
                </div>
                {renderTimingInputs("sec:photos")}
              </div>
              <button
                type="button"
                onClick={() =>
                  updatePayload("photos", [
                    ...doc.payload.photos,
                    { id: createId("ph"), detail: "", imageUrl: "" },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่มรูปภาพ
              </button>
            </div>
            <div className="space-y-4">
              {groupItemsPreservingOrder(doc.payload.photos, (ph) => ph.detail).map((grp) => {
                const isGroupOver =
                  dragOverGroup?.section === "ph" && dragOverGroup?.group === grp.group;
                return (
                <div
                  key={grp.group}
                  onDragOver={(e) => {
                    if (dragGroup?.section === "ph" && dragGroup.group !== grp.group) {
                      e.preventDefault();
                      setDragOverGroup({ section: "ph", group: grp.group });
                    }
                  }}
                  onDrop={(e) => {
                    if (dragGroup?.section === "ph" && dragGroup.group !== grp.group) {
                      e.preventDefault();
                      updatePayload(
                        "photos",
                        reorderGroups(
                          doc.payload.photos,
                          dragGroup.group,
                          grp.group,
                          (ph) => ph.detail
                        )
                      );
                    }
                    setDragGroup(null);
                    setDragOverGroup(null);
                  }}
                  className={`overflow-hidden rounded-lg border transition ${
                    isGroupOver ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
                  }`}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDragGroup({ section: "ph", group: grp.group });
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragGroup(null);
                      setDragOverGroup(null);
                    }}
                    className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-3 py-2"
                  >
                    <div className="flex flex-1 items-center gap-2">
                      <span
                        className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing"
                        title="ลากเพื่อสลับลำดับกลุ่ม"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        defaultValue={grp.group}
                        key={`ph-grp-${grp.group}`}
                        onBlur={(e) =>
                          updatePayload(
                            "photos",
                            renameGroup(
                              doc.payload.photos,
                              grp.group,
                              e.target.value,
                              (r) => r.detail,
                              (r, detail) => ({ ...r, detail })
                            )
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-64 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-800 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none"
                      />
                      <span className="text-[11px] font-medium text-slate-500">
                        ({grp.entries.length} รูป)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updatePayload("photos", [
                          ...doc.payload.photos,
                          {
                            id: createId("ph"),
                            detail:
                              grp.group === "อื่นๆ / เพิ่มเติม"
                                ? ""
                                : `[${grp.group}] `,
                            imageUrl: "",
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-sky-700 shadow-sm hover:bg-sky-50"
                    >
                      <Plus className="h-3 w-3" /> เพิ่มในกลุ่มนี้
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2">
                    {grp.entries.map(({ item: ph, index: idx, label }) => {
                      const { group } = parseGroupedName(ph.detail);
                      const hasPrefix = ph.detail.startsWith("[");
                      const isOver = dragOverRow?.section === "ph" && dragOverRow?.id === ph.id;
                      return (
                        <div
                          key={ph.id}
                          draggable
                          onDragStart={(e) => {
                            setDragRow({ section: "ph", id: ph.id });
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            if (dragRow?.section === "ph" && dragRow.id !== ph.id) {
                              e.preventDefault();
                              setDragOverRow({ section: "ph", id: ph.id });
                            }
                          }}
                          onDrop={(e) => {
                            if (dragRow?.section === "ph" && dragRow.id !== ph.id) {
                              e.preventDefault();
                              updatePayload(
                                "photos",
                                reorderRows(doc.payload.photos, dragRow.id, ph.id)
                              );
                            }
                            setDragRow(null);
                            setDragOverRow(null);
                          }}
                          onDragEnd={() => {
                            setDragRow(null);
                            setDragOverRow(null);
                          }}
                          className={`flex flex-col gap-3 rounded-lg border border-slate-200 p-3 ${
                            isOver ? "ring-2 ring-sky-400" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing">
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={label}
                              placeholder="รายละเอียดรูปภาพ"
                              onChange={(e) => {
                                const nextVal = hasPrefix
                                  ? `[${group}] ${e.target.value}`
                                  : e.target.value;
                                updatePayload(
                                  "photos",
                                  doc.payload.photos.map((r) =>
                                    r.id === ph.id ? { ...r, detail: nextVal } : r
                                  )
                                );
                              }}
                              className="flex-1 rounded border border-slate-300 px-2.5 py-1 text-sm font-medium focus:border-sky-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                requestDeleteWithPin(label || "ช่องรูปภาพ", () =>
                                  updatePayload(
                                    "photos",
                                    doc.payload.photos.filter((r) => r.id !== ph.id)
                                  )
                                )
                              }
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="ลบช่องรูปภาพ (ต้องใส่รหัสยืนยัน)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {ph.imageUrl ? (
                            <div className="relative flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <img
                                src={ph.imageUrl}
                                alt={label}
                                className="max-h-48 w-auto rounded object-contain"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updatePayload(
                                    "photos",
                                    doc.payload.photos.map((r) =>
                                      r.id === ph.id ? { ...r, imageUrl: "" } : r
                                    )
                                  )
                                }
                                className="mt-2 text-xs text-rose-600 hover:underline"
                              >
                                ลบรูปภาพนี้
                              </button>
                            </div>
                          ) : (
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-6 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50/40">
                              {uploadingId === ph.id ? (
                                <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                              ) : (
                                <Upload className="h-6 w-6 text-slate-400" />
                              )}
                              <span className="mt-1 text-xs font-medium">
                                {uploadingId === ph.id
                                  ? "กำลังอัปโหลด..."
                                  : "คลิกเพื่อเลือกรูปภาพ"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handlePhotoUpload(ph.id, e.target.files?.[0])
                                }
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </section>

          {/* 8. Signatures */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-b border-slate-100 pb-2 text-base font-bold text-slate-900">
              ส่วนลงนามท้ายเอกสาร
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {doc.payload.signatures.map((sig, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-800">{sig.role}</div>
                  <input
                    type="text"
                    value={sig.name}
                    placeholder="ชื่อ-นามสกุล (ตัวบรรจง)"
                    onChange={(e) =>
                      updatePayload(
                        "signatures",
                        doc.payload.signatures.map((s, i) =>
                          i === idx ? { ...s, name: e.target.value } : s
                        )
                      )
                    }
                    className="mb-2 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={toDateInputValue(sig.date)}
                    onChange={(e) =>
                      updatePayload(
                        "signatures",
                        doc.payload.signatures.map((s, i) =>
                          i === idx
                            ? { ...s, date: fromDateInputValue(e.target.value) }
                            : s
                        )
                      )
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
