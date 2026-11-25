"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Check,
  FileText,
  Printer,
  Link2,
  Loader2,
} from "lucide-react";
import { ChecklistDocument, ChecklistSummary } from "@/types/checklist";
import { COMPANY_HEADER } from "@/lib/defaultTemplate";
import {
  deleteChecklist,
  getChecklistById,
  getMasterTemplate,
  listChecklists,
} from "@/lib/supabase";
import PinConfirmModal from "@/components/PinConfirmModal";

const ChecklistEditor = dynamic(() => import("@/components/ChecklistEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="inline-flex items-center gap-2.5 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
        กำลังโหลดหน้าเอกสาร Check List...
      </div>
    </div>
  ),
});

function toSummary(doc: ChecklistDocument): ChecklistSummary {
  return {
    id: doc.id,
    store_id: doc.store_id,
    shop_name: doc.shop_name,
    engineer_in_charge: doc.engineer_in_charge,
    doc_datetime: doc.doc_datetime,
    address: doc.address,
    total_work_days: doc.total_work_days,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export default function HomePage() {
  const [docs, setDocs] = useState<ChecklistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeDoc, setActiveDoc] = useState<ChecklistDocument | null>(null);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [autoPrint, setAutoPrint] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ChecklistSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistSummary | null>(null);

  const loadDocs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listChecklists();
      setDocs(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "ไม่สามารถเชื่อมต่อ Supabase ได้";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get("id");

    loadDocs();

    if (docId) {
      getChecklistById(docId)
        .then((found) => {
          if (found) {
            setEditorMode("edit");
            setAutoPrint(false);
            setActiveDoc(found);
          }
        })
        .catch(() => {});
    }
  }, []);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.store_id.toLowerCase().includes(q) ||
        d.shop_name.toLowerCase().includes(q) ||
        d.engineer_in_charge.toLowerCase().includes(q)
    );
  }, [docs, search]);

  const handleOpenDoc = async (
    summary: ChecklistSummary,
    mode: "edit" | "preview",
    shouldPrint = false
  ) => {
    if (!summary.id || busyDocId) return;
    setBusyDocId(summary.id);
    try {
      const fullDoc = await getChecklistById(summary.id);
      if (fullDoc) {
        setEditorMode(mode);
        setAutoPrint(shouldPrint);
        setActiveDoc(fullDoc);
      }
    } finally {
      setBusyDocId(null);
    }
  };

  const handleExportRow = async (
    summary: ChecklistSummary,
    format: "excel" | "word"
  ) => {
    if (!summary.id || busyDocId) return;
    setBusyDocId(summary.id);
    try {
      const fullDoc = await getChecklistById(summary.id);
      if (!fullDoc) return;
      if (format === "excel") {
        const { exportChecklistToExcel } = await import("@/lib/exportExcel");
        await exportChecklistToExcel(fullDoc);
      } else {
        const { exportChecklistToWord } = await import("@/lib/exportWord");
        await exportChecklistToWord(fullDoc);
      }
    } finally {
      setBusyDocId(null);
    }
  };

  const handleCopyLink = async (id?: string) => {
    if (!id) return;
    const shareUrl = `${window.location.origin}/?id=${id}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  const handleConfirmCreate = async () => {
    const tpl = await getMasterTemplate();
    setShowCreateModal(false);
    setEditorMode("edit");
    setAutoPrint(false);
    setActiveDoc(tpl);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateTarget?.id) return;
    const fullDoc = await getChecklistById(duplicateTarget.id);
    if (!fullDoc) throw new Error("ไม่พบข้อมูลเอกสารต้นฉบับ");
    const cloned: ChecklistDocument = {
      ...fullDoc,
      id: undefined,
      shop_name: fullDoc.shop_name
        ? `${fullDoc.shop_name} (สำเนา)`
        : "สำเนาเอกสาร",
      created_at: undefined,
      updated_at: undefined,
    };
    setDuplicateTarget(null);
    setEditorMode("edit");
    setAutoPrint(false);
    setActiveDoc(cloned);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    await deleteChecklist(deleteTarget.id);
    setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (activeDoc) {
    return (
      <ChecklistEditor
        initialDoc={activeDoc}
        initialMode={editorMode}
        autoPrint={autoPrint}
        onBack={() => {
          setActiveDoc(null);
          setEditorMode("edit");
          setAutoPrint(false);
          if (window.location.search) {
            window.history.replaceState({}, "", window.location.pathname);
          }
          loadDocs();
        }}
        onSaved={(saved) => {
          const summary = toSummary(saved);
          setDocs((prev) => {
            const exists = prev.some((d) => d.id === summary.id);
            if (exists) return prev.map((d) => (d.id === summary.id ? summary : d));
            return [summary, ...prev];
          });
        }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Header Banner */}
      <div className="mb-4 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-5 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <img
            src={COMPANY_HEADER.logoPath}
            alt="VerticalTec Logo"
            className="h-10 w-auto shrink-0 object-contain sm:h-14"
          />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 sm:text-lg">
              {COMPANY_HEADER.fullName}
            </h1>
            <p className="text-xs text-slate-600">{COMPANY_HEADER.address}</p>
            <p className="mt-1 inline-block rounded-md bg-sky-50 px-2.5 py-1 text-sm font-extrabold text-sky-800 sm:text-base">
              {COMPANY_HEADER.documentTitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 sm:w-auto sm:py-3"
        >
          <Plus className="h-4 w-4" />
          สร้างเอกสาร Check List ใหม่
        </button>
      </div>

      {/* Supabase Setup Warning if table missing */}
      {errorMsg && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <div className="font-bold">ยังไม่ได้สร้างตารางใน Supabase หรือเชื่อมต่อไม่สำเร็จ</div>
              <p className="mt-1 text-xs text-amber-800">
                รายละเอียด: <span className="font-mono">{errorMsg}</span>
              </p>
              <p className="mt-2 text-xs text-amber-800">
                กรุณานำไฟล์ <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/schema.sql</code> ไปรันใน{" "}
                <a
                  href="https://supabase.com/dashboard/project/lveyqbqecgvzfqufxmwf/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  Supabase SQL Editor
                </a>{" "}
                แล้วกดรีเฟรชอีกครั้ง (ระหว่างนี้สามารถกด &ldquo;สร้างเอกสาร Check List ใหม่&rdquo; เพื่อทดลองกรอก, พิมพ์ A4 และ Export Excel ได้ทันที)
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "กรุณาเปิดไฟล์ supabase/schema.sql ในโปรเจกต์แล้วนำไปวางใน Supabase SQL Editor"
                    );
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  {copiedSql ? <Check className="h-3.5 w-3.5" /> : null}
                  {copiedSql ? "คัดลอกคำแนะนำแล้ว" : "เปิด Supabase SQL Editor"}
                </button>
                <button
                  type="button"
                  onClick={loadDocs}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> ลองเชื่อมต่อใหม่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Toolbar */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา Branch ID, Branch Name, หรือชื่อ Engineer..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={loadDocs}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          รีเฟรชรายการ
        </button>
      </div>

      {/* Document History Table (Desktop) & Card List (Mobile) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            กำลังโหลดรายการเอกสารจาก Supabase...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">
              ยังไม่มีเอกสาร Check List ที่บันทึกไว้
            </p>
            <p className="mt-1 text-xs text-slate-400">
              กดปุ่ม &ldquo;สร้างเอกสาร Check List ใหม่&rdquo; ด้านบนเพื่อเริ่มต้น
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="divide-y divide-slate-200 md:hidden">
              {filteredDocs.map((d) => {
                const isBusy = busyDocId === d.id;
                return (
                  <div key={d.id} className="space-y-2.5 p-4">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono font-semibold text-sky-700">
                        {d.store_id || "-"}
                      </span>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>{d.doc_datetime || "-"}</span>
                        <span>•</span>
                        <span>{d.total_work_days ?? 0} วัน</span>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => handleOpenDoc(d, "preview", false)}
                        className="inline-flex items-center gap-1.5 text-left text-base font-bold text-sky-700 hover:text-sky-900 hover:underline disabled:opacity-60"
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {d.shop_name || "(ไม่ระบุชื่อสาขา)"}
                      </button>
                      <div className="mt-0.5 text-xs text-slate-600">
                        Engineer: {d.engineer_in_charge || "-"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => handleOpenDoc(d, "edit", false)}
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => handleOpenDoc(d, "preview", true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Printer className="h-3.5 w-3.5" /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(d.id)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          copiedLinkId === d.id
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        {copiedLinkId === d.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Link2 className="h-3.5 w-3.5" /> Link
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => setDuplicateTarget(d)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        title="ทำสำเนา"
                      >
                        <Copy className="h-3.5 w-3.5" /> สำเนา
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => handleExportRow(d, "excel")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        title="Export Excel"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => handleExportRow(d, "word")}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                        title="Export Word (.docx)"
                      >
                        <FileText className="h-3.5 w-3.5" /> Word
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(d)}
                        className="ml-auto inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="ลบ (ต้องใส่รหัสยืนยัน)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Single-Line Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">Branch ID</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">Branch Name</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">Engineer In-Charge</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">วันที่เอกสาร</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center">วันทำงาน</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDocs.map((d) => {
                    const isBusy = busyDocId === d.id;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-sky-700">
                          {d.store_id || "-"}
                        </td>
                        <td className="max-w-[280px] truncate whitespace-nowrap px-4 py-2.5">
                          <button
                            type="button"
                            disabled={Boolean(busyDocId)}
                            onClick={() => handleOpenDoc(d, "preview", false)}
                            className="inline-flex max-w-full cursor-pointer items-center gap-1.5 truncate text-left font-medium text-sky-700 hover:text-sky-900 hover:underline disabled:opacity-60"
                            title="คลิกเพื่อดูตัวอย่าง A4"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : null}
                            <span className="truncate">
                              {d.shop_name || "(ไม่ระบุชื่อสาขา)"}
                            </span>
                          </button>
                        </td>
                        <td className="max-w-[220px] truncate whitespace-nowrap px-4 py-2.5 text-slate-700">
                          {d.engineer_in_charge || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                          {d.doc_datetime || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-center text-slate-600">
                          {d.total_work_days ?? 0} วัน
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={Boolean(busyDocId)}
                              onClick={() => handleOpenDoc(d, "edit", false)}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> แก้ไข
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyDocId)}
                              onClick={() => handleOpenDoc(d, "preview", true)}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                              title="พิมพ์ / Export PDF"
                            >
                              <Printer className="h-3.5 w-3.5" /> PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(d.id)}
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                copiedLinkId === d.id
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                              }`}
                              title="คัดลอก Link ส่งให้ Engineer"
                            >
                              {copiedLinkId === d.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> คัดลอกแล้ว
                                </>
                              ) : (
                                <>
                                  <Link2 className="h-3.5 w-3.5" /> Link
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyDocId)}
                              onClick={() => setDuplicateTarget(d)}
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                              title="ทำสำเนา"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyDocId)}
                              onClick={() => handleExportRow(d, "excel")}
                              className="inline-flex items-center rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              title="Export Excel"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyDocId)}
                              onClick={() => handleExportRow(d, "word")}
                              className="inline-flex items-center rounded-lg bg-indigo-50 p-1.5 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                              title="Export Word (.docx)"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(d)}
                              className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="ลบ (ต้องใส่รหัสยืนยัน)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <PinConfirmModal
        open={showCreateModal}
        title="ยืนยันการสร้างเอกสาร Check List ใหม่"
        description="กรุณากรอกรหัสยืนยันเพื่อสร้างเอกสารใหม่"
        confirmLabel="ยืนยันสร้างเอกสาร"
        onCancel={() => setShowCreateModal(false)}
        onConfirm={handleConfirmCreate}
      />

      <PinConfirmModal
        open={Boolean(duplicateTarget)}
        title="ยืนยันการทำสำเนาเอกสาร"
        subtitle={
          duplicateTarget
            ? `สาขา: ${duplicateTarget.store_id || "-"} ${duplicateTarget.shop_name || ""}`
            : undefined
        }
        description="กรุณากรอกรหัสยืนยันเพื่อทำสำเนาเอกสารนี้"
        confirmLabel="ยืนยันทำสำเนา"
        onCancel={() => setDuplicateTarget(null)}
        onConfirm={handleConfirmDuplicate}
      />

      <PinConfirmModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบเอกสาร Check List"
        subtitle={
          deleteTarget
            ? `สาขา: ${deleteTarget.store_id || "-"} ${deleteTarget.shop_name || ""}`
            : undefined
        }
        description="กรุณากรอกรหัสยืนยันเพื่อลบเอกสารนี้"
        confirmLabel="ยืนยันลบเอกสาร"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </main>
  );
}
