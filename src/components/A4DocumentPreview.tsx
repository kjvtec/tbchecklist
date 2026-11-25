"use client";

import React from "react";
import { ChecklistCategory, ChecklistDocument, CheckStatus } from "@/types/checklist";
import {
  COMPANY_HEADER,
  groupItemsPreservingOrder,
  isNetworkHardware,
} from "@/lib/defaultTemplate";

interface A4DocumentPreviewProps {
  doc: ChecklistDocument;
}

function StatusPrintCell({ status }: { status: CheckStatus }) {
  return (
    <div className="flex items-center justify-center gap-2.5 whitespace-nowrap text-[10.5px]">
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-slate-700 text-[9.5px] leading-none">
          {status === "pass" ? "✓" : ""}
        </span>
        <span>ผ่าน</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-slate-700 text-[9.5px] leading-none">
          {status === "fail" ? "✓" : ""}
        </span>
        <span>ไม่ผ่าน</span>
      </span>
      {status === "na" && (
        <span className="rounded bg-slate-200 px-1 text-[9.5px] font-semibold text-slate-700">
          N/A
        </span>
      )}
    </div>
  );
}

function CompanyPageHeader({
  storeId,
  shopName,
  pageLabel,
}: {
  storeId: string;
  shopName?: string;
  pageLabel: string;
}) {
  return (
    <header className="mb-3 border-b-2 border-sky-600 pb-2">
      <div className="flex items-center gap-4">
        <img
          src={COMPANY_HEADER.logoPath}
          alt="VerticalTec Logo"
          className="h-11 w-auto shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-bold leading-snug text-slate-900">
            {COMPANY_HEADER.fullName}
          </h1>
          <p className="text-[10.5px] leading-snug text-slate-700">
            {COMPANY_HEADER.address}
          </p>
        </div>
        <div className="max-w-[210px] shrink-0 text-right">
          <div className="text-[13px] font-extrabold leading-tight text-sky-800">
            {shopName || "สาขา"}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-slate-600">
            {storeId ? `Branch ID: ${storeId} • ` : ""}
            {pageLabel}
          </div>
        </div>
      </div>
      <div className="mt-1.5 border-t border-sky-100 pt-1 text-center">
        <p className="whitespace-nowrap text-[15px] font-extrabold leading-tight text-sky-800">
          {COMPANY_HEADER.documentTitle}
        </p>
      </div>
    </header>
  );
}

function CompanyPageFooter({
  docDate,
  pageLabel,
}: {
  docDate: string;
  pageLabel: string;
}) {
  return (
    <footer className="mt-auto flex items-center justify-between border-t border-slate-300 pt-1.5 text-[9.5px] text-slate-600">
      <span>Branch Install Check List • v1.0</span>
      <span>วันที่: {docDate || "-"}</span>
      <span className="font-semibold text-slate-700">{pageLabel}</span>
    </footer>
  );
}

function A4DocumentPreview({ doc }: A4DocumentPreviewProps) {
  const { payload } = doc;
  const formatTiming = (key: string) => {
    const t = payload.sectionTimings?.[key];
    const start = t?.startTime || "_____:_____";
    const end = t?.endTime || "_____:_____";
    return `เริ่ม ${start}   เสร็จ ${end}`;
  };

  // Split Hardware groups cleanly: first 4 groups on Page 1, remaining groups on Page 2
  const hwGroups = groupItemsPreservingOrder(
    payload.hardwareSerials,
    (hw) => hw.itemName
  );
  const hwPage1Groups = hwGroups.slice(0, 4);
  const hwPage2Groups = hwGroups.slice(4);

  // Split Check List into 3 balanced pages (~20-25 rows each, comfortable spacing)
  const clPage1Categories = payload.checklistCategories.slice(0, 5);
  const clPage2Categories = payload.checklistCategories.slice(5, 8);
  const clPage3Categories = payload.checklistCategories.slice(8);

  // Chunk photos into pages of 2 (2 large full-width photo panels per A4 page)
  const photoChunks: { group: string; detail: string; imageUrl: string; idx: number }[][] = [];
  const flatPhotos: { group: string; detail: string; imageUrl: string; idx: number }[] = [];
  groupItemsPreservingOrder(payload.photos, (ph) => ph.detail).forEach((grp) => {
    grp.entries.forEach(({ item, index, label }) => {
      flatPhotos.push({
        group: grp.group,
        detail: label || "-",
        imageUrl: item.imageUrl,
        idx: index + 1,
      });
    });
  });
  for (let i = 0; i < flatPhotos.length; i += 2) {
    photoChunks.push(flatPhotos.slice(i, i + 2));
  }
  if (photoChunks.length === 0) {
    photoChunks.push([]);
  }

  const hasHwPage2 = hwPage2Groups.length > 0;
  const clPagesCount =
    (clPage1Categories.length > 0 ? 1 : 0) +
    (clPage2Categories.length > 0 ? 1 : 0) +
    (clPage3Categories.length > 0 ? 1 : 0);
  // Main document pages: Page 1 (Info + HW1) + Page 2 (HW2 + SW) + Page 3 (WorkDays) + CL pages
  const mainTotalPages = 3 + clPagesCount;
  const totalPages = mainTotalPages;
  const attachmentTotalPages = photoChunks.length;

  const pageClass =
    "a4-page mx-auto mb-6 flex w-full min-w-[740px] max-w-[210mm] min-h-[282mm] flex-col bg-white p-6 text-[11px] leading-snug text-slate-900 shadow-lg ring-1 ring-slate-200 sm:min-w-0 print:mb-0 print:min-w-0";

  const renderHardwareTable = (
    groups: typeof hwGroups,
    isContinuation: boolean
  ) => (
    <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
      <thead>
        <tr className="bg-sky-50">
          <th
            colSpan={4}
            className="border border-slate-400 px-2.5 py-1.5 text-left font-bold text-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                Hardware Serial and IP Address Report
                {isContinuation ? " (ต่อ)" : ""}
              </span>
              {!isContinuation && (
                <span className="text-[10px] font-medium text-slate-600">
                  {formatTiming("sec:hardware")}
                </span>
              )}
            </div>
          </th>
        </tr>
        <tr className="bg-slate-100">
          <th className="border border-slate-400 px-2 py-1 text-center font-semibold w-12">
            ลำดับ
          </th>
          <th className="border border-slate-400 px-2.5 py-1 text-left font-semibold w-[42%]">
            รายการอุปกรณ์ (Hardware)
          </th>
          <th className="border border-slate-400 px-2.5 py-1 text-left font-semibold w-[26%]">
            Serial Number (S/N)
          </th>
          <th className="border border-slate-400 px-2.5 py-1 text-left font-semibold">
            IP Address
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((grp) => (
          <React.Fragment key={grp.group}>
            <tr className="bg-slate-100/80">
              <td
                colSpan={4}
                className="border border-slate-400 px-2.5 py-1 font-bold text-slate-800"
              >
                {grp.group}
              </td>
            </tr>
            {grp.entries.map(({ item: hw, index: idx, label }) => {
              const isNet = isNetworkHardware(label);
              return (
                <tr key={hw.id}>
                  <td className="border border-slate-400 px-2 py-1 text-center">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-1">
                    {label || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-1 font-mono text-[10px]">
                    {hw.serialNumber || "\u00A0"}
                  </td>
                  <td
                    className={`border border-slate-400 px-2.5 py-1 font-mono text-[10px] ${
                      isNet ? "" : "bg-slate-50 text-center text-slate-400"
                    }`}
                  >
                    {isNet ? hw.ipAddress || "\u00A0" : "—"}
                  </td>
                </tr>
              );
            })}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );

  const renderChecklistTable = (categories: ChecklistCategory[]) => (
    <table className="w-full border-collapse border border-slate-400 text-[10.5px] leading-snug">
      <thead>
        <tr className="bg-sky-50">
          <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold w-[56%]">
            รายการตรวจสอบ (Check List)
          </th>
          <th className="border border-slate-400 px-2 py-1.5 text-center font-bold w-[21%]">
            สถานะ
          </th>
          <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold w-[23%]">
            หมายเหตุ
          </th>
        </tr>
      </thead>
      <tbody>
        {categories.map((cat) => {
          const hasSubGroups = cat.items.some((it) => it.label.startsWith("["));
          return (
            <React.Fragment key={cat.id}>
              <tr className="bg-slate-100">
                <td
                  colSpan={3}
                  className="border border-slate-400 px-2.5 py-1 font-bold text-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{cat.title}</span>
                    <span className="text-[10px] font-medium text-slate-600">
                      {formatTiming(`cl:${cat.id}`)}
                    </span>
                  </div>
                </td>
              </tr>
              {hasSubGroups
                ? groupItemsPreservingOrder(cat.items, (it) => it.label).map((grp) => (
                    <React.Fragment key={grp.group}>
                      <tr className="bg-sky-50/60">
                        <td
                          colSpan={3}
                          className="border border-slate-400 px-2.5 py-0.5 text-[10px] font-bold text-sky-900"
                        >
                          {grp.group}
                        </td>
                      </tr>
                      {grp.entries.map(({ item, label }) => (
                        <tr key={item.id}>
                          <td className="border border-slate-400 px-2.5 py-1">
                            <span className="font-medium">{item.code}</span> {label}
                          </td>
                          <td className="border border-slate-400 px-1.5 py-1 text-center">
                            <StatusPrintCell status={item.status} />
                          </td>
                          <td className="border border-slate-400 px-2.5 py-1">
                            {item.remark || "\u00A0"}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                : cat.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-slate-400 px-2.5 py-1">
                        <span className="font-medium">{item.code}</span> {item.label}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-1 text-center">
                        <StatusPrintCell status={item.status} />
                      </td>
                      <td className="border border-slate-400 px-2.5 py-1">
                        {item.remark || "\u00A0"}
                      </td>
                    </tr>
                  ))}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  let currentPage = 1;

  return (
    <div className="print-container">
      {/* ==================== PAGE 1: Info + Hardware (Part 1) ==================== */}
      <div className={pageClass}>
        <CompanyPageHeader
          storeId={doc.store_id}
          shopName={doc.shop_name}
          pageLabel={`แผ่นที่ ${currentPage++} / ${totalPages}`}
        />

        {/* General Information */}
        <section className="mb-4">
          <table className="w-full border-collapse border border-slate-400 text-[11px]">
            <tbody>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold w-[16%]">
                  Date time:
                </td>
                <td className="border border-slate-400 px-2.5 py-1.5 w-[34%]">
                  {doc.doc_datetime || "-"}
                </td>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold w-[18%]">
                  Engineer In-Charge:
                </td>
                <td className="border border-slate-400 px-2.5 py-1.5 w-[32%]">
                  {doc.engineer_in_charge || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold">
                  Branch ID:
                </td>
                <td className="border border-slate-400 px-2.5 py-1.5">
                  {doc.store_id || "-"}
                </td>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold">
                  Branch Name:
                </td>
                <td className="border border-slate-400 px-2.5 py-1.5">
                  {doc.shop_name || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold">
                  Address:
                </td>
                <td colSpan={3} className="border border-slate-400 px-2.5 py-1.5">
                  {doc.address || "-"}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold">
                  เวลาเริ่มงาน:
                </td>
                <td className="border border-slate-400 px-2.5 py-1.5">
                  {payload.workStartTime || "-"}
                </td>
                <td className="border border-slate-400 bg-slate-50 px-2.5 py-1.5 font-semibold">
                  เวลาปิดงาน:
                </td>
                <td className="border border-slate-400 px-2.5 py-1.5">
                  {payload.workEndTime || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Hardware Part 1 */}
        <section className="mb-2">{renderHardwareTable(hwPage1Groups, false)}</section>
        <CompanyPageFooter
          docDate={doc.doc_datetime}
          pageLabel={`แผ่นที่ ${currentPage - 1} / ${totalPages}`}
        />
      </div>

      {/* ==================== PAGE 2: Hardware (Part 2) + Software Version ==================== */}
      <div className={pageClass}>
        <CompanyPageHeader
          storeId={doc.store_id}
          shopName={doc.shop_name}
          pageLabel={`แผ่นที่ ${currentPage++} / ${totalPages}`}
        />
        {hasHwPage2 && (
          <section className="mb-5">
            {renderHardwareTable(hwPage2Groups, true)}
          </section>
        )}

        {/* Software Version (Distinct 3-Column Machine Table) */}
        <section className="mb-3 print-avoid-break">
          <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-slate-300 pb-1">
            <h2 className="text-[12.5px] font-bold text-slate-900">
              Software Version
            </h2>
            <span className="text-[10px] font-medium text-slate-600">
              {formatTiming("sec:software")}
            </span>
          </div>
          <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
            <thead>
              <tr className="bg-sky-50">
                <th className="border border-slate-400 px-2.5 py-1 text-left font-bold w-[34%]">
                  จุดติดตั้ง / เครื่อง
                </th>
                <th className="border border-slate-400 px-2.5 py-1 text-left font-bold w-[32%]">
                  โปรแกรม (Software)
                </th>
                <th className="border border-slate-400 px-2.5 py-1 text-left font-bold">
                  Version
                </th>
              </tr>
            </thead>
            <tbody>
              {groupItemsPreservingOrder(payload.softwareVersions, (sw) => sw.name).map(
                (grp, gIdx) =>
                  grp.entries.map(({ item: sw, label }, eIdx) => (
                    <tr
                      key={sw.id}
                      className={gIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                    >
                      {eIdx === 0 && (
                        <td
                          rowSpan={grp.entries.length}
                          className="border border-slate-400 bg-slate-100/70 px-2.5 py-1.5 align-middle font-bold text-slate-900"
                        >
                          {grp.group}
                        </td>
                      )}
                      <td className="border border-slate-400 px-2.5 py-1 font-medium text-slate-800">
                        {label || "\u00A0"}
                      </td>
                      <td className="border border-slate-400 px-2.5 py-1 font-mono text-[10px]">
                        {sw.version || "\u00A0"}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </section>
        <CompanyPageFooter
          docDate={doc.doc_datetime}
          pageLabel={`แผ่นที่ ${currentPage - 1} / ${totalPages}`}
        />
      </div>

      {/* ==================== PAGE 3: Work Days Summary ==================== */}
      <div className={pageClass}>
        <CompanyPageHeader
          storeId={doc.store_id}
          shopName={doc.shop_name}
          pageLabel={`แผ่นที่ ${currentPage++} / ${totalPages}`}
        />

        {/* Work Days Summary */}
        <section className="mb-5 print-avoid-break">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-1">
            <h2 className="text-[12.5px] font-bold text-slate-900">
              เอกสารสรุปวันทำงาน
            </h2>
            <span className="text-[11px] font-semibold">
              สรุปรวมวันที่ทำงานทั้งหมด :{" "}
              <span className="underline decoration-dotted underline-offset-4 px-2">
                {doc.total_work_days ?? 0}
              </span>{" "}
              วัน
            </span>
          </div>

          <p className="mb-1.5 text-[11px] font-semibold text-slate-800">
            วันทำงานตามแผนที่กำหนด
          </p>
          <table className="mb-5 w-full border-collapse border border-slate-400 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[18%]">
                  วันที่
                </th>
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[42%]">
                  รายละเอียด
                </th>
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[22%]">
                  เจ้าหน้าที่
                </th>
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[18%]">
                  เลขที่ใบงาน
                </th>
              </tr>
            </thead>
            <tbody>
              {payload.plannedWorkDays.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.date || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.detail || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.staff || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.jobNo || "\u00A0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mb-1.5 text-[11px] font-semibold text-slate-800">
            วันทำงานเพิ่มเติมจากแผนที่กำหนดไว้
          </p>
          <table className="w-full border-collapse border border-slate-400 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[18%]">
                  วันที่
                </th>
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[42%]">
                  รายละเอียด
                </th>
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[22%]">
                  เจ้าหน้าที่
                </th>
                <th className="border border-slate-400 px-2.5 py-1.5 text-left w-[18%]">
                  เลขที่ใบงาน
                </th>
              </tr>
            </thead>
            <tbody>
              {payload.extraWorkDays.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.date || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.detail || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.staff || "\u00A0"}
                  </td>
                  <td className="border border-slate-400 px-2.5 py-2">
                    {row.jobNo || "\u00A0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <CompanyPageFooter
          docDate={doc.doc_datetime}
          pageLabel={`แผ่นที่ ${currentPage - 1} / ${totalPages}`}
        />
      </div>

      {/* ==================== PAGE 4: Check List Part 1 (Categories 1-5) ==================== */}
      {clPage1Categories.length > 0 && (
        <div className={pageClass}>
          <CompanyPageHeader
            storeId={doc.store_id}
          shopName={doc.shop_name}
            pageLabel={`แผ่นที่ ${currentPage++} / ${totalPages}`}
          />
          {renderChecklistTable(clPage1Categories)}
          <CompanyPageFooter
            docDate={doc.doc_datetime}
            pageLabel={`แผ่นที่ ${currentPage - 1} / ${totalPages}`}
          />
        </div>
      )}

      {/* ==================== PAGE 5: Check List Part 2 (Categories 6-8) ==================== */}
      {clPage2Categories.length > 0 && (
        <div className={pageClass}>
          <CompanyPageHeader
            storeId={doc.store_id}
          shopName={doc.shop_name}
            pageLabel={`แผ่นที่ ${currentPage++} / ${totalPages}`}
          />
          {renderChecklistTable(clPage2Categories)}
          <CompanyPageFooter
            docDate={doc.doc_datetime}
            pageLabel={`แผ่นที่ ${currentPage - 1} / ${totalPages}`}
          />
        </div>
      )}

      {/* ==================== PAGE 6: Check List Part 3 (Categories 9-11) + Signatures ==================== */}
      {clPage3Categories.length > 0 && (
        <div className={pageClass}>
          <CompanyPageHeader
            storeId={doc.store_id}
          shopName={doc.shop_name}
            pageLabel={`แผ่นที่ ${currentPage++} / ${totalPages}`}
          />
          {renderChecklistTable(clPage3Categories)}

          {/* Signature Footer under Section 11 */}
          <footer className="mt-8 grid grid-cols-3 gap-6 pt-4 text-center text-[11px] print-avoid-break">
            {payload.signatures.map((sig, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="mb-1 w-full border-b border-dotted border-slate-500 pt-6" />
                <div className="text-slate-700">
                  ({sig.name ? sig.name : "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"})
                </div>
                <div className="mt-0.5 font-semibold text-slate-900">
                  {sig.role}
                </div>
                <div className="mt-1 text-slate-700">
                  วันที่ {sig.date ? sig.date : "......./......../........"}
                </div>
              </div>
            ))}
          </footer>
          <CompanyPageFooter
            docDate={doc.doc_datetime}
            pageLabel={`แผ่นที่ ${currentPage - 1} / ${totalPages}`}
          />
        </div>
      )}

      {/* ==================== ATTACHMENT PAGES: Large Photos (2 per page, 1/X) ==================== */}
      {photoChunks.map((chunk, chunkIdx) => {
        const attachPageNum = chunkIdx + 1;
        const isLastAttachmentPage = chunkIdx === photoChunks.length - 1;
        return (
          <div key={chunkIdx} className={pageClass}>
            <CompanyPageHeader
              storeId={doc.store_id}
          shopName={doc.shop_name}
              pageLabel={`เอกสารแนบ ${attachPageNum} / ${attachmentTotalPages}`}
            />

            <div className="mb-3 flex items-center justify-between border-b border-slate-300 pb-1.5">
              <h2 className="text-[12.5px] font-bold text-slate-900">
                เอกสารแนบรูปรายละเอียดเครื่องและใบเสร็จ ({attachPageNum} / {attachmentTotalPages})
              </h2>
              <span className="text-[10px] font-medium text-slate-600">
                {formatTiming("sec:photos")}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {chunk.map((ph) => (
                <div
                  key={ph.idx}
                  className="print-avoid-break flex flex-col overflow-hidden rounded border border-slate-400"
                >
                  <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5">
                    <span className="text-[11px] font-bold text-sky-900">
                      {ph.idx}. {ph.group}
                    </span>
                    <span className="text-[11px] font-medium text-slate-700">
                      {ph.detail}
                    </span>
                  </div>
                  <div
                    className={`flex items-center justify-center bg-white p-2.5 ${
                      isLastAttachmentPage ? "h-[78mm]" : "h-[104mm]"
                    }`}
                  >
                    {ph.imageUrl ? (
                      <img
                        src={ph.imageUrl}
                        alt={ph.detail}
                        className="max-h-full max-w-full rounded object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50/40 text-[12px] text-slate-400">
                        (พื้นที่ติดรูปภาพ: {ph.detail})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isLastAttachmentPage && (
              <footer className="mt-3 grid grid-cols-3 gap-6 pt-1 text-center text-[11px] print-avoid-break">
                {payload.signatures.map((sig, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="mb-1 w-full border-b border-dotted border-slate-500 pt-6" />
                    <div className="text-slate-700">
                      ({sig.name ? sig.name : "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"})
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900">
                      {sig.role}
                    </div>
                    <div className="mt-1 text-slate-700">
                      วันที่ {sig.date ? sig.date : "......./......../........"}
                    </div>
                  </div>
                ))}
              </footer>
            )}
            <CompanyPageFooter
              docDate={doc.doc_datetime}
              pageLabel={`เอกสารแนบ ${attachPageNum} / ${attachmentTotalPages}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(A4DocumentPreview);
