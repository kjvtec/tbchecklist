import ExcelJS from "exceljs";
import { ChecklistCategory, ChecklistDocument, CheckStatus } from "@/types/checklist";
import {
  buildExportFileName,
  COMPANY_HEADER,
  groupItemsPreservingOrder,
  isNetworkHardware,
} from "@/lib/defaultTemplate";

async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; extension: "png" | "jpeg" } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const isPng = url.startsWith("data:image/png");
      const base64 = url.split(",")[1];
      return { base64, extension: isPng ? "png" : "jpeg" };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const extension: "png" | "jpeg" =
      contentType.includes("png") || url.toLowerCase().endsWith(".png")
        ? "png"
        : "jpeg";
    return { base64, extension };
  } catch {
    return null;
  }
}

function formatStatusText(status: CheckStatus): string {
  if (status === "pass") return "☑ ผ่าน   ☐ ไม่ผ่าน";
  if (status === "fail") return "☐ ผ่าน   ☑ ไม่ผ่าน";
  if (status === "na") return "☐ ผ่าน   ☐ ไม่ผ่าน  (N/A)";
  return "☐ ผ่าน   ☐ ไม่ผ่าน";
}

function applyThinBorders(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
      right: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  }
}

function styleSectionHeader(
  row: ExcelJS.Row,
  colCount: number,
  fillArgb = "FFE2E8F0"
) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = {
      name: "Sarabun",
      size: 10.5,
      bold: true,
      color: { argb: "FF0F172A" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillArgb },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }
  applyThinBorders(row, colCount);
}

export async function exportChecklistToExcel(doc: ChecklistDocument): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = COMPANY_HEADER.fullName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Check List A4", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.55,
        header: 0.2,
        footer: 0.25,
      },
    },
    headerFooter: {
      oddFooter: `&L&8Branch Install Check List • v1.0&C&8วันที่: ${
        doc.doc_datetime || "-"
      }&R&8หน้า &P / &N`,
    },
  });

  // 5-column A4 grid
  sheet.columns = [
    { width: 12.5 }, // Col A: ลำดับ / รหัส / Logo
    { width: 32 },   // Col B: รายการ
    { width: 22 },   // Col C: S/N / สถานะ
    { width: 18 },   // Col D: IP / หมายเหตุ / เจ้าหน้าที่
    { width: 16 },   // Col E: เลขที่ใบงาน / รูปภาพ
  ];
  const COL_COUNT = 5;

  const logoImg = await fetchImageAsBase64(COMPANY_HEADER.logoPath);
  const logoId = logoImg
    ? workbook.addImage({ base64: logoImg.base64, extension: logoImg.extension })
    : null;

  const formatTimingSuffix = (key: string) => {
    const t = doc.payload.sectionTimings?.[key];
    const start = t?.startTime || "_____:_____";
    const end = t?.endTime || "_____:_____";
    return `   (เริ่ม ${start}   เสร็จ ${end})`;
  };

  const addCompanyPageHeader = (pageLabel: string) => {
    const r1 = sheet.addRow([
      "",
      COMPANY_HEADER.fullName,
      "",
      "",
      doc.shop_name || "สาขา",
    ]);
    const r2 = sheet.addRow([
      "",
      COMPANY_HEADER.address,
      "",
      "",
      `${doc.store_id ? `Branch ID: ${doc.store_id} • ` : ""}${pageLabel}`,
    ]);
    const r3 = sheet.addRow(["", COMPANY_HEADER.documentTitle, "", "", ""]);
    sheet.mergeCells(r1.number, 1, r3.number, 1);
    sheet.mergeCells(r1.number, 2, r1.number, 4);
    sheet.mergeCells(r2.number, 2, r2.number, 4);
    sheet.mergeCells(r3.number, 2, r3.number, 5);
    r1.height = 22;
    r2.height = 20;
    r3.height = 24;

    if (logoId !== null) {
      sheet.addImage(logoId, {
        tl: { col: 0.08, row: r1.number - 1 + 0.35 },
        ext: { width: 76, height: 31 },
      });
    }

    r1.getCell(2).font = {
      name: "Sarabun",
      size: 12.5,
      bold: true,
      color: { argb: "FF0F172A" },
    };
    r1.getCell(2).alignment = { vertical: "bottom", horizontal: "left" };
    r1.getCell(5).font = {
      name: "Sarabun",
      size: 9.5,
      bold: true,
      color: { argb: "FF0369A1" },
    };
    r1.getCell(5).alignment = { vertical: "bottom", horizontal: "right" };

    r2.getCell(2).font = {
      name: "Sarabun",
      size: 9.5,
      color: { argb: "FF334155" },
    };
    r2.getCell(2).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    r2.getCell(5).font = {
      name: "Sarabun",
      size: 9.5,
      color: { argb: "FF64748B" },
    };
    r2.getCell(5).alignment = { vertical: "middle", horizontal: "right" };

    r3.getCell(2).font = {
      name: "Sarabun",
      size: 13.5,
      bold: true,
      color: { argb: "FF0369A1" },
    };
    r3.getCell(2).alignment = { vertical: "middle", horizontal: "left" };

    for (let c = 1; c <= COL_COUNT; c++) {
      r3.getCell(c).border = {
        bottom: { style: "medium", color: { argb: "FF0284C7" } },
      };
    }

    const spacer = sheet.addRow([]);
    spacer.height = 8;
  };

  const addSignatureBlock = () => {
    const spacer = sheet.addRow([]);
    spacer.height = 10;

    const sigs = doc.payload.signatures;
    const sr1 = sheet.addRow([
      "ลงชื่อ ...........................................",
      "",
      "ลงชื่อ ...........................................",
      "ลงชื่อ ...........................................",
      "",
    ]);
    sheet.mergeCells(sr1.number, 1, sr1.number, 2);
    sheet.mergeCells(sr1.number, 4, sr1.number, 5);
    sr1.height = 24;
    sr1.font = { name: "Sarabun", size: 10 };
    [1, 3, 4].forEach((c) => {
      sr1.getCell(c).alignment = { horizontal: "center", vertical: "bottom" };
    });

    const sr2 = sheet.addRow([
      `(${sigs[0]?.name || "                                  "})`,
      "",
      `(${sigs[1]?.name || "                                  "})`,
      `(${sigs[2]?.name || "                                  "})`,
      "",
    ]);
    sheet.mergeCells(sr2.number, 1, sr2.number, 2);
    sheet.mergeCells(sr2.number, 4, sr2.number, 5);
    sr2.height = 18;
    sr2.font = { name: "Sarabun", size: 10 };
    [1, 3, 4].forEach((c) => {
      sr2.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    });

    const sr3 = sheet.addRow([
      sigs[0]?.role || "เจ้าหน้าที่ส่งมอบ",
      "",
      sigs[1]?.role || "ผู้จัดการหรือผู้มีอำนาจ",
      sigs[2]?.role || "เจ้าหน้าที่ตรวจสอบ",
      "",
    ]);
    sheet.mergeCells(sr3.number, 1, sr3.number, 2);
    sheet.mergeCells(sr3.number, 4, sr3.number, 5);
    sr3.height = 18;
    sr3.font = { name: "Sarabun", size: 10, bold: true };
    [1, 3, 4].forEach((c) => {
      sr3.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    });

    const sr4 = sheet.addRow([
      `วันที่ ${sigs[0]?.date || "......./......../........"}`,
      "",
      `วันที่ ${sigs[1]?.date || "......./......../........"}`,
      `วันที่ ${sigs[2]?.date || "......./......../........"}`,
      "",
    ]);
    sheet.mergeCells(sr4.number, 1, sr4.number, 2);
    sheet.mergeCells(sr4.number, 4, sr4.number, 5);
    sr4.height = 18;
    sr4.font = { name: "Sarabun", size: 10 };
    [1, 3, 4].forEach((c) => {
      sr4.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    });
  };

  // Prepare page counts matching A4DocumentPreview
  const hwGroups = groupItemsPreservingOrder(
    doc.payload.hardwareSerials,
    (hw) => hw.itemName
  );
  const hwPage1Groups = hwGroups.slice(0, 4);
  const hwPage2Groups = hwGroups.slice(4);
  const hasHwPage2 = hwPage2Groups.length > 0;

  const clPage1Categories = doc.payload.checklistCategories.slice(0, 5);
  const clPage2Categories = doc.payload.checklistCategories.slice(5, 8);
  const clPage3Categories = doc.payload.checklistCategories.slice(8);
  const clPagesCount =
    (clPage1Categories.length > 0 ? 1 : 0) +
    (clPage2Categories.length > 0 ? 1 : 0) +
    (clPage3Categories.length > 0 ? 1 : 0);

  const flatPhotos: { group: string; detail: string; imageUrl: string; idx: number }[] = [];
  groupItemsPreservingOrder(doc.payload.photos, (ph) => ph.detail).forEach((grp) => {
    grp.entries.forEach(({ item, index, label }) => {
      flatPhotos.push({
        group: grp.group,
        detail: label || "-",
        imageUrl: item.imageUrl,
        idx: index + 1,
      });
    });
  });
  const photoChunks: typeof flatPhotos[] = [];
  for (let i = 0; i < flatPhotos.length; i += 2) {
    photoChunks.push(flatPhotos.slice(i, i + 2));
  }
  if (photoChunks.length === 0) photoChunks.push([]);

  const mainTotalPages = 1 + (hasHwPage2 ? 1 : 0) + 1 + clPagesCount;
  const attachmentTotalPages = photoChunks.length;
  let currentPage = 1;

  const renderHardwareRows = (
    groups: typeof hwGroups,
    isContinuation: boolean
  ) => {
    const hwTitle = sheet.addRow([
      `Hardware Serial and IP Address Report${isContinuation ? " (ต่อ)" : ""}${
        !isContinuation ? formatTimingSuffix("sec:hardware") : ""
      }`,
      "",
      "",
      "",
      "",
    ]);
    sheet.mergeCells(hwTitle.number, 1, hwTitle.number, 5);
    hwTitle.height = 22;
    styleSectionHeader(hwTitle, COL_COUNT, "FFDBEAFE");

    const hwHead = sheet.addRow([
      "ลำดับ",
      "รายการอุปกรณ์ (Hardware)",
      "Serial Number (S/N)",
      "IP Address",
      "",
    ]);
    sheet.mergeCells(hwHead.number, 4, hwHead.number, 5);
    hwHead.height = 20;
    styleSectionHeader(hwHead, COL_COUNT, "FFF1F5F9");
    hwHead.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    groups.forEach((grp) => {
      const grpRow = sheet.addRow([grp.group, "", "", "", ""]);
      sheet.mergeCells(grpRow.number, 1, grpRow.number, 5);
      grpRow.height = 19;
      styleSectionHeader(grpRow, COL_COUNT, "FFF8FAFC");

      grp.entries.forEach(({ item: hw, index: idx, label }) => {
        const isNet = isNetworkHardware(label);
        const r = sheet.addRow([
          idx + 1,
          label,
          hw.serialNumber,
          isNet ? hw.ipAddress || "" : "—",
          "",
        ]);
        sheet.mergeCells(r.number, 4, r.number, 5);
        r.height = 19;
        r.font = { name: "Sarabun", size: 10 };
        r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        if (!isNet) {
          r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
          r.getCell(4).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
          r.getCell(4).font = {
            name: "Sarabun",
            size: 10,
            color: { argb: "FF94A3B8" },
          };
        }
        applyThinBorders(r, COL_COUNT);
      });
    });
  };

  // ==================== PAGE 1: Info + Hardware Part 1 ====================
  addCompanyPageHeader(`แผ่นที่ ${currentPage++} / ${mainTotalPages}`);

  const rInfo1 = sheet.addRow([
    "Date time:",
    doc.doc_datetime || "-",
    "Engineer In-Charge:",
    doc.engineer_in_charge || "-",
    "",
  ]);
  sheet.mergeCells(rInfo1.number, 4, rInfo1.number, 5);
  rInfo1.height = 20;
  rInfo1.font = { name: "Sarabun", size: 10 };
  rInfo1.getCell(1).font = { name: "Sarabun", size: 10, bold: true };
  rInfo1.getCell(3).font = { name: "Sarabun", size: 10, bold: true };
  applyThinBorders(rInfo1, COL_COUNT);

  const rInfo2 = sheet.addRow([
    "Branch ID:",
    doc.store_id || "-",
    "Branch Name:",
    doc.shop_name || "-",
    "",
  ]);
  sheet.mergeCells(rInfo2.number, 4, rInfo2.number, 5);
  rInfo2.height = 20;
  rInfo2.font = { name: "Sarabun", size: 10 };
  rInfo2.getCell(1).font = { name: "Sarabun", size: 10, bold: true };
  rInfo2.getCell(3).font = { name: "Sarabun", size: 10, bold: true };
  applyThinBorders(rInfo2, COL_COUNT);

  const rInfo3 = sheet.addRow(["Address:", doc.address || "-", "", "", ""]);
  sheet.mergeCells(rInfo3.number, 2, rInfo3.number, 5);
  rInfo3.height = 24;
  rInfo3.font = { name: "Sarabun", size: 10 };
  rInfo3.getCell(1).font = { name: "Sarabun", size: 10, bold: true };
  rInfo3.getCell(2).alignment = { wrapText: true, vertical: "middle" };
  applyThinBorders(rInfo3, COL_COUNT);

  const rInfo4 = sheet.addRow([
    "เวลาเริ่มงาน:",
    doc.payload.workStartTime || "-",
    "เวลาปิดงาน:",
    doc.payload.workEndTime || "-",
    "",
  ]);
  sheet.mergeCells(rInfo4.number, 4, rInfo4.number, 5);
  rInfo4.height = 20;
  rInfo4.font = { name: "Sarabun", size: 10 };
  rInfo4.getCell(1).font = { name: "Sarabun", size: 10, bold: true };
  rInfo4.getCell(3).font = { name: "Sarabun", size: 10, bold: true };
  applyThinBorders(rInfo4, COL_COUNT);

  const sp1 = sheet.addRow([]);
  sp1.height = 8;

  renderHardwareRows(hwPage1Groups, false);

  const pb1 = sheet.addRow([]);
  pb1.addPageBreak();

  // ==================== PAGE 2: Hardware Part 2 + Software Version ====================
  addCompanyPageHeader(`แผ่นที่ ${currentPage++} / ${mainTotalPages}`);

  if (hasHwPage2) {
    renderHardwareRows(hwPage2Groups, true);
    const sp2 = sheet.addRow([]);
    sp2.height = 10;
  }

  const swTitle = sheet.addRow([
    `Software Version${formatTimingSuffix("sec:software")}`,
    "",
    "",
    "",
    "",
  ]);
  sheet.mergeCells(swTitle.number, 1, swTitle.number, 5);
  swTitle.height = 22;
  styleSectionHeader(swTitle, COL_COUNT, "FFDBEAFE");

  const swHead = sheet.addRow([
    "จุดติดตั้ง / เครื่อง",
    "",
    "โปรแกรม (Software)",
    "Version",
    "",
  ]);
  sheet.mergeCells(swHead.number, 1, swHead.number, 2);
  sheet.mergeCells(swHead.number, 4, swHead.number, 5);
  swHead.height = 20;
  styleSectionHeader(swHead, COL_COUNT, "FFF1F5F9");

  groupItemsPreservingOrder(doc.payload.softwareVersions, (sw) => sw.name).forEach(
    (grp) => {
      const startRowNum = sheet.rowCount + 1;
      grp.entries.forEach(({ item: sw, label }, eIdx) => {
        const r = sheet.addRow([
          eIdx === 0 ? grp.group : "",
          "",
          label,
          sw.version,
          "",
        ]);
        sheet.mergeCells(r.number, 4, r.number, 5);
        r.height = 19;
        r.font = { name: "Sarabun", size: 10 };
        r.getCell(1).font = { name: "Sarabun", size: 10, bold: true };
        r.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
        r.getCell(1).alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: true,
        };
        r.getCell(3).font = { name: "Sarabun", size: 10, bold: true };
        applyThinBorders(r, COL_COUNT);
      });
      const endRowNum = sheet.rowCount;
      if (endRowNum >= startRowNum) {
        sheet.mergeCells(startRowNum, 1, endRowNum, 2);
      }
    }
  );

  const pb2 = sheet.addRow([]);
  pb2.addPageBreak();

  // ==================== PAGE 3: Work Days Summary ====================
  addCompanyPageHeader(`แผ่นที่ ${currentPage++} / ${mainTotalPages}`);

  const wdTitle = sheet.addRow([
    `เอกสารสรุปวันทำงาน (สรุปรวมวันที่ทำงานทั้งหมด: ${doc.total_work_days || 0} วัน)`,
    "",
    "",
    "",
    "",
  ]);
  sheet.mergeCells(wdTitle.number, 1, wdTitle.number, 5);
  wdTitle.height = 22;
  styleSectionHeader(wdTitle, COL_COUNT, "FFDBEAFE");

  const renderWorkDaysTable = (
    subtitle: string,
    rows: typeof doc.payload.plannedWorkDays
  ) => {
    const sub = sheet.addRow([subtitle, "", "", "", ""]);
    sheet.mergeCells(sub.number, 1, sub.number, 5);
    sub.height = 20;
    styleSectionHeader(sub, COL_COUNT, "FFF8FAFC");

    const hdr = sheet.addRow([
      "วันที่",
      "รายละเอียด",
      "",
      "เจ้าหน้าที่",
      "เลขที่ใบงาน",
    ]);
    sheet.mergeCells(hdr.number, 2, hdr.number, 3);
    hdr.height = 20;
    styleSectionHeader(hdr, COL_COUNT, "FFF1F5F9");

    rows.forEach((wd) => {
      const r = sheet.addRow([wd.date, wd.detail, "", wd.staff, wd.jobNo]);
      sheet.mergeCells(r.number, 2, r.number, 3);
      r.height = 22;
      r.font = { name: "Sarabun", size: 10 };
      applyThinBorders(r, COL_COUNT);
    });
  };

  renderWorkDaysTable("วันทำงานตามแผนที่กำหนด", doc.payload.plannedWorkDays);
  const sp3 = sheet.addRow([]);
  sp3.height = 10;
  renderWorkDaysTable(
    "วันทำงานเพิ่มเติมจากแผนที่กำหนดไว้",
    doc.payload.extraWorkDays
  );

  // ==================== PAGES 4-6: Check List (Split 1-5, 6-8, 9-11 + Signatures) ====================
  const renderChecklistPage = (
    categories: ChecklistCategory[],
    withSignatures: boolean
  ) => {
    if (categories.length === 0) return;
    const pb = sheet.addRow([]);
    pb.addPageBreak();

    addCompanyPageHeader(`แผ่นที่ ${currentPage++} / ${mainTotalPages}`);

    const clMainTitle = sheet.addRow([
      "Check List การติดตั้งและทดสอบระบบ",
      "",
      "ผลการตรวจสอบ",
      "หมายเหตุ",
      "",
    ]);
    sheet.mergeCells(clMainTitle.number, 1, clMainTitle.number, 2);
    sheet.mergeCells(clMainTitle.number, 4, clMainTitle.number, 5);
    clMainTitle.height = 22;
    styleSectionHeader(clMainTitle, COL_COUNT, "FFDBEAFE");
    clMainTitle.getCell(3).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    categories.forEach((cat) => {
      const catRow = sheet.addRow([
        `${cat.title}${formatTimingSuffix(`cl:${cat.id}`)}`,
        "",
        "",
        "",
        "",
      ]);
      sheet.mergeCells(catRow.number, 1, catRow.number, 5);
      catRow.height = 21;
      styleSectionHeader(catRow, COL_COUNT, "FFF1F5F9");

      const hasSubGroups = cat.items.some((it) => it.label.startsWith("["));
      if (hasSubGroups) {
        groupItemsPreservingOrder(cat.items, (it) => it.label).forEach((grp) => {
          const grpRow = sheet.addRow([grp.group, "", "", "", ""]);
          sheet.mergeCells(grpRow.number, 1, grpRow.number, 5);
          grpRow.height = 19;
          styleSectionHeader(grpRow, COL_COUNT, "FFF8FAFC");

          grp.entries.forEach(({ item, label }) => {
            const r = sheet.addRow([
              item.code,
              label,
              formatStatusText(item.status),
              item.remark,
              "",
            ]);
            sheet.mergeCells(r.number, 4, r.number, 5);
            r.height = label.length > 55 ? 30 : 20;
            r.font = { name: "Sarabun", size: 10 };
            r.getCell(1).alignment = {
              horizontal: "center",
              vertical: "middle",
            };
            r.getCell(2).alignment = { wrapText: true, vertical: "middle" };
            r.getCell(3).alignment = {
              horizontal: "center",
              vertical: "middle",
            };
            r.getCell(4).alignment = { wrapText: true, vertical: "middle" };
            applyThinBorders(r, COL_COUNT);
          });
        });
      } else {
        cat.items.forEach((item) => {
          const r = sheet.addRow([
            item.code,
            item.label,
            formatStatusText(item.status),
            item.remark,
            "",
          ]);
          sheet.mergeCells(r.number, 4, r.number, 5);
          r.height = item.label.length > 55 ? 30 : 20;
          r.font = { name: "Sarabun", size: 10 };
          r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
          r.getCell(2).alignment = { wrapText: true, vertical: "middle" };
          r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
          r.getCell(4).alignment = { wrapText: true, vertical: "middle" };
          applyThinBorders(r, COL_COUNT);
        });
      }
    });

    if (withSignatures) {
      addSignatureBlock();
    }
  };

  renderChecklistPage(clPage1Categories, false);
  renderChecklistPage(clPage2Categories, false);
  renderChecklistPage(clPage3Categories, true);

  // ==================== ATTACHMENT PAGES: 2 Large Photos per Page (1/X) + Signatures on Last ====================
  for (let chunkIdx = 0; chunkIdx < photoChunks.length; chunkIdx++) {
    const chunk = photoChunks[chunkIdx];
    const attachPageNum = chunkIdx + 1;
    const isLastAttachmentPage = chunkIdx === photoChunks.length - 1;

    const pbAtt = sheet.addRow([]);
    pbAtt.addPageBreak();

    addCompanyPageHeader(`เอกสารแนบ ${attachPageNum} / ${attachmentTotalPages}`);

    const phTitle = sheet.addRow([
      `เอกสารแนบรูปรายละเอียดเครื่องและใบเสร็จ (${attachPageNum} / ${attachmentTotalPages})${formatTimingSuffix("sec:photos")}`,
      "",
      "",
      "",
      "",
    ]);
    sheet.mergeCells(phTitle.number, 1, phTitle.number, 5);
    phTitle.height = 22;
    styleSectionHeader(phTitle, COL_COUNT, "FFDBEAFE");

    for (const ph of chunk) {
      const capRow = sheet.addRow([
        `${ph.idx}. ${ph.group}`,
        "",
        ph.detail,
        "",
        "",
      ]);
      sheet.mergeCells(capRow.number, 1, capRow.number, 2);
      sheet.mergeCells(capRow.number, 3, capRow.number, 5);
      capRow.height = 20;
      styleSectionHeader(capRow, COL_COUNT, "FFF1F5F9");

      const imgRow = sheet.addRow([
        ph.imageUrl ? "" : `(พื้นที่ติดรูปภาพ: ${ph.detail})`,
        "",
        "",
        "",
        "",
      ]);
      sheet.mergeCells(imgRow.number, 1, imgRow.number, 5);
      imgRow.height = isLastAttachmentPage ? 175 : 210;
      imgRow.font = { name: "Sarabun", size: 10.5, color: { argb: "FF94A3B8" } };
      imgRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      applyThinBorders(imgRow, COL_COUNT);

      if (ph.imageUrl) {
        const imgData = await fetchImageAsBase64(ph.imageUrl);
        if (imgData) {
          const imgId = workbook.addImage({
            base64: imgData.base64,
            extension: imgData.extension,
          });
          sheet.addImage(imgId, {
            tl: { col: 0.4, row: imgRow.number - 1 + 0.08 },
            ext: { width: 460, height: isLastAttachmentPage ? 215 : 255 },
          });
        }
      }

      const gap = sheet.addRow([]);
      gap.height = 8;
    }

    if (isLastAttachmentPage) {
      addSignatureBlock();
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${buildExportFileName(doc)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
