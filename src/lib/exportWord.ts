import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { ChecklistDocument, CheckStatus } from "@/types/checklist";
import {
  buildExportFileName,
  COMPANY_HEADER,
  groupItemsPreservingOrder,
  isNetworkHardware,
} from "@/lib/defaultTemplate";

async function fetchImageBytes(
  url: string
): Promise<{ data: Uint8Array; type: "png" | "jpg" } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const isPng = url.startsWith("data:image/png");
      const base64 = url.split(",")[1];
      const bin = atob(base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return { data: arr, type: isPng ? "png" : "jpg" };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    const isPng = ct.includes("png") || url.toLowerCase().endsWith(".png");
    return { data: new Uint8Array(buf), type: isPng ? "png" : "jpg" };
  } catch {
    return null;
  }
}

const FONT_SPEC = {
  ascii: "TH SarabunPSK",
  hAnsi: "TH SarabunPSK",
  cs: "TH SarabunPSK",
  eastAsia: "TH SarabunPSK",
};
const BORDER_COLOR = "94A3B8";
const THIN_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function makeCell(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    fill?: string;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    colSpan?: number;
    rowSpan?: number;
    widthPct?: number;
    borders?: typeof THIN_BORDERS;
  } = {}
): TableCell {
  return new TableCell({
    columnSpan: options.colSpan,
    rowSpan: options.rowSpan,
    width: options.widthPct
      ? { size: options.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill
      ? { type: ShadingType.CLEAR, fill: options.fill }
      : undefined,
    borders: options.borders ?? THIN_BORDERS,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: options.align ?? AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: text || " ",
            font: FONT_SPEC,
            size: options.size ? options.size + 6 : 26, // TH SarabunPSK 13pt
            bold: options.bold ?? false,
            color: options.color ?? "0F172A",
          }),
        ],
      }),
    ],
  });
}

function formatStatusText(status: CheckStatus): string {
  if (status === "pass") return "☑ ผ่าน   ☐ ไม่ผ่าน";
  if (status === "fail") return "☐ ผ่าน   ☑ ไม่ผ่าน";
  if (status === "na") return "☐ ผ่าน   ☐ ไม่ผ่าน (N/A)";
  return "☐ ผ่าน   ☐ ไม่ผ่าน";
}

function buildSignatureTable(doc: ChecklistDocument): Table {
  const sigs = doc.payload.signatures;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [0, 1, 2].map((i) => {
          const s = sigs[i];
          return new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            margins: { top: 200, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: "ลงชื่อ ...........................................",
                    font: FONT_SPEC,
                    size: 26,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: `(${s?.name || "                                  "})`,
                    font: FONT_SPEC,
                    size: 26,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: s?.role || "",
                    font: FONT_SPEC,
                    size: 26,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `วันที่ ${s?.date || "......./......../........"}`,
                    font: FONT_SPEC,
                    size: 26,
                  }),
                ],
              }),
            ],
          });
        }),
      }),
    ],
  });
}

export async function exportChecklistToWord(
  doc: ChecklistDocument
): Promise<void> {
  const logoBytes = await fetchImageBytes(COMPANY_HEADER.logoPath);

  const formatTiming = (key: string) => {
    const t = doc.payload.sectionTimings?.[key];
    const start = t?.startTime || "_____:_____";
    const end = t?.endTime || "_____:_____";
    return `เริ่ม ${start}   เสร็จ ${end}`;
  };

  // Header on every page
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            borders: {
              ...NO_BORDERS,
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "0284C7" },
            },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              logoBytes
                ? new Paragraph({
                    spacing: { after: 60 },
                    children: [
                      new ImageRun({
                        data: logoBytes.data,
                        type: logoBytes.type,
                        transformation: { width: 88, height: 35 },
                      }),
                    ],
                  })
                : new Paragraph({ children: [] }),
            ],
          }),
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            borders: {
              ...NO_BORDERS,
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0F2FE" },
            },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: COMPANY_HEADER.fullName,
                    font: FONT_SPEC,
                    size: 32,
                    bold: true,
                    color: "0F172A",
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: COMPANY_HEADER.address,
                    font: FONT_SPEC,
                    size: 24,
                    color: "334155",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: {
              ...NO_BORDERS,
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0F2FE" },
            },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: "BRANCH INSTALL CHECK LIST",
                    font: FONT_SPEC,
                    size: 22,
                    bold: true,
                    color: "0369A1",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: doc.store_id ? `Branch ID: ${doc.store_id}` : "",
                    font: FONT_SPEC,
                    size: 22,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: {
              ...NO_BORDERS,
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "0284C7" },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 60 },
                children: [
                  new TextRun({
                    text: COMPANY_HEADER.documentTitle,
                    font: FONT_SPEC,
                    size: 32,
                    bold: true,
                    color: "0369A1",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Footer on every page
  const pageFooter = new Footer({
    children: [
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        },
        spacing: { before: 80 },
        children: [
          new TextRun({
            text: `Branch Install Check List • v1.0          วันที่: ${
              doc.doc_datetime || "-"
            }          หน้า `,
            font: FONT_SPEC,
            size: 24,
            color: "475569",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: FONT_SPEC,
            size: 24,
            bold: true,
            color: "334155",
          }),
          new TextRun({
            text: " / ",
            font: FONT_SPEC,
            size: 24,
            color: "475569",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: FONT_SPEC,
            size: 24,
            bold: true,
            color: "334155",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [];

  // 1. General Info Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            makeCell("Date time:", { bold: true, fill: "F8FAFC", widthPct: 16 }),
            makeCell(doc.doc_datetime || "-", { widthPct: 34 }),
            makeCell("Engineer In-Charge:", {
              bold: true,
              fill: "F8FAFC",
              widthPct: 18,
            }),
            makeCell(doc.engineer_in_charge || "-", { widthPct: 32 }),
          ],
        }),
        new TableRow({
          children: [
            makeCell("Branch ID:", { bold: true, fill: "F8FAFC" }),
            makeCell(doc.store_id || "-"),
            makeCell("Branch Name:", { bold: true, fill: "F8FAFC" }),
            makeCell(doc.shop_name || "-"),
          ],
        }),
        new TableRow({
          children: [
            makeCell("Address:", { bold: true, fill: "F8FAFC" }),
            makeCell(doc.address || "-", { colSpan: 3 }),
          ],
        }),
        new TableRow({
          children: [
            makeCell("เวลาเริ่มงาน:", { bold: true, fill: "F8FAFC" }),
            makeCell(doc.payload.workStartTime || "-"),
            makeCell("เวลาปิดงาน:", { bold: true, fill: "F8FAFC" }),
            makeCell(doc.payload.workEndTime || "-"),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [] }));

  // 2. Hardware Serial and IP Address Report
  const hwGroups = groupItemsPreservingOrder(
    doc.payload.hardwareSerials,
    (hw) => hw.itemName
  );
  const hwRows: TableRow[] = [
    new TableRow({
      children: [
        makeCell(
          `Hardware Serial and IP Address Report   (${formatTiming("sec:hardware")})`,
          { bold: true, fill: "DBEAFE", colSpan: 4, size: 20 }
        ),
      ],
    }),
    new TableRow({
      children: [
        makeCell("ลำดับ", {
          bold: true,
          fill: "F1F5F9",
          align: AlignmentType.CENTER,
          widthPct: 8,
        }),
        makeCell("รายการอุปกรณ์ (Hardware)", {
          bold: true,
          fill: "F1F5F9",
          widthPct: 44,
        }),
        makeCell("Serial Number (S/N)", {
          bold: true,
          fill: "F1F5F9",
          widthPct: 26,
        }),
        makeCell("IP Address", {
          bold: true,
          fill: "F1F5F9",
          widthPct: 22,
        }),
      ],
    }),
  ];

  hwGroups.forEach((grp) => {
    hwRows.push(
      new TableRow({
        children: [
          makeCell(grp.group, { bold: true, fill: "F8FAFC", colSpan: 4 }),
        ],
      })
    );
    grp.entries.forEach(({ item: hw, index: idx, label }) => {
      const isNet = isNetworkHardware(label);
      hwRows.push(
        new TableRow({
          children: [
            makeCell(String(idx + 1), { align: AlignmentType.CENTER }),
            makeCell(label),
            makeCell(hw.serialNumber || ""),
            makeCell(isNet ? hw.ipAddress || "" : "—", {
              align: isNet ? AlignmentType.LEFT : AlignmentType.CENTER,
              fill: isNet ? undefined : "F8FAFC",
              color: isNet ? "0F172A" : "94A3B8",
            }),
          ],
        })
      );
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: hwRows,
    })
  );

  // Page Break -> Software Version + Work Days
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // 3. Software Version (3-column table)
  const swRows: TableRow[] = [
    new TableRow({
      children: [
        makeCell(`Software Version   (${formatTiming("sec:software")})`, {
          bold: true,
          fill: "DBEAFE",
          colSpan: 3,
          size: 20,
        }),
      ],
    }),
    new TableRow({
      children: [
        makeCell("จุดติดตั้ง / เครื่อง", {
          bold: true,
          fill: "F1F5F9",
          widthPct: 34,
        }),
        makeCell("โปรแกรม (Software)", {
          bold: true,
          fill: "F1F5F9",
          widthPct: 34,
        }),
        makeCell("Version", {
          bold: true,
          fill: "F1F5F9",
          widthPct: 32,
        }),
      ],
    }),
  ];

  groupItemsPreservingOrder(doc.payload.softwareVersions, (sw) => sw.name).forEach(
    (grp) => {
      grp.entries.forEach(({ item: sw, label }, eIdx) => {
        const cells: TableCell[] = [];
        if (eIdx === 0) {
          cells.push(
            makeCell(grp.group, {
              bold: true,
              fill: "F8FAFC",
              rowSpan: grp.entries.length,
            })
          );
        }
        cells.push(makeCell(label, { bold: true }));
        cells.push(makeCell(sw.version || ""));
        swRows.push(new TableRow({ children: cells }));
      });
    }
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: swRows,
    })
  );

  children.push(new Paragraph({ spacing: { before: 140, after: 40 }, children: [] }));

  // 4. Work Days Summary
  const buildWorkDayTable = (
    subtitle: string,
    rows: typeof doc.payload.plannedWorkDays
  ) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [makeCell(subtitle, { bold: true, fill: "F8FAFC", colSpan: 4 })],
        }),
        new TableRow({
          children: [
            makeCell("วันที่", { bold: true, fill: "F1F5F9", widthPct: 18 }),
            makeCell("รายละเอียด", { bold: true, fill: "F1F5F9", widthPct: 42 }),
            makeCell("เจ้าหน้าที่", { bold: true, fill: "F1F5F9", widthPct: 22 }),
            makeCell("เลขที่ใบงาน", { bold: true, fill: "F1F5F9", widthPct: 18 }),
          ],
        }),
        ...rows.map(
          (wd) =>
            new TableRow({
              children: [
                makeCell(wd.date),
                makeCell(wd.detail),
                makeCell(wd.staff),
                makeCell(wd.jobNo),
              ],
            })
        ),
      ],
    });

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `เอกสารสรุปวันทำงาน (รวมทั้งหมด ${doc.total_work_days || 0} วัน)   ${formatTiming(
            "sec:workdays"
          )}`,
          font: FONT_SPEC,
          size: 28,
          bold: true,
        }),
      ],
    })
  );
  children.push(
    buildWorkDayTable("วันทำงานตามแผนที่กำหนด", doc.payload.plannedWorkDays)
  );
  children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [] }));
  children.push(
    buildWorkDayTable(
      "วันทำงานเพิ่มเติมจากแผนที่กำหนดไว้",
      doc.payload.extraWorkDays
    )
  );

  // Page Break -> Check List
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // 5. Check List Categories
  const clRows: TableRow[] = [
    new TableRow({
      children: [
        makeCell("รหัส", {
          bold: true,
          fill: "DBEAFE",
          align: AlignmentType.CENTER,
          widthPct: 8,
        }),
        makeCell("รายการตรวจสอบ (Check List)", {
          bold: true,
          fill: "DBEAFE",
          widthPct: 48,
        }),
        makeCell("สถานะ", {
          bold: true,
          fill: "DBEAFE",
          align: AlignmentType.CENTER,
          widthPct: 22,
        }),
        makeCell("หมายเหตุ", {
          bold: true,
          fill: "DBEAFE",
          widthPct: 22,
        }),
      ],
    }),
  ];

  doc.payload.checklistCategories.forEach((cat) => {
    clRows.push(
      new TableRow({
        children: [
          makeCell(`${cat.title}   (${formatTiming(`cl:${cat.id}`)})`, {
            bold: true,
            fill: "F1F5F9",
            colSpan: 4,
          }),
        ],
      })
    );

    const hasSubGroups = cat.items.some((it) => it.label.startsWith("["));
    if (hasSubGroups) {
      groupItemsPreservingOrder(cat.items, (it) => it.label).forEach((grp) => {
        clRows.push(
          new TableRow({
            children: [
              makeCell(grp.group, {
                bold: true,
                fill: "F8FAFC",
                colSpan: 4,
                color: "0369A1",
              }),
            ],
          })
        );
        grp.entries.forEach(({ item, label }) => {
          clRows.push(
            new TableRow({
              children: [
                makeCell(item.code, { align: AlignmentType.CENTER }),
                makeCell(label),
                makeCell(formatStatusText(item.status), {
                  align: AlignmentType.CENTER,
                }),
                makeCell(item.remark),
              ],
            })
          );
        });
      });
    } else {
      cat.items.forEach((item) => {
        clRows.push(
          new TableRow({
            children: [
              makeCell(item.code, { align: AlignmentType.CENTER }),
              makeCell(item.label),
              makeCell(formatStatusText(item.status), {
                align: AlignmentType.CENTER,
              }),
              makeCell(item.remark),
            ],
          })
        );
      });
    }
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: clRows,
    })
  );

  // Signature Footer under Section 11
  children.push(buildSignatureTable(doc));

  // 6. Attachment Pages: 2 large photos per page
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

  for (let cIdx = 0; cIdx < photoChunks.length; cIdx++) {
    const chunk = photoChunks[cIdx];
    const isLast = cIdx === photoChunks.length - 1;
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: `เอกสารแนบรูปรายละเอียดเครื่องและใบเสร็จ (${cIdx + 1} / ${
              photoChunks.length
            })   ${formatTiming("sec:photos")}`,
            font: FONT_SPEC,
            size: 28,
            bold: true,
          }),
        ],
      })
    );

    for (const ph of chunk) {
      const imgBytes = ph.imageUrl ? await fetchImageBytes(ph.imageUrl) : null;
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                makeCell(`${ph.idx}. ${ph.group} — ${ph.detail}`, {
                  bold: true,
                  fill: "F1F5F9",
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  borders: THIN_BORDERS,
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 140, bottom: 140, left: 140, right: 140 },
                  children: [
                    imgBytes
                      ? new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new ImageRun({
                              data: imgBytes.data,
                              type: imgBytes.type,
                              transformation: {
                                width: 420,
                                height: isLast ? 210 : 250,
                              },
                            }),
                          ],
                        })
                      : new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: isLast ? 700 : 900, after: isLast ? 700 : 900 },
                          children: [
                            new TextRun({
                              text: `(พื้นที่ติดรูปภาพ: ${ph.detail})`,
                              font: FONT_SPEC,
                              size: 26,
                              color: "94A3B8",
                            }),
                          ],
                        }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
      children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    }

    if (isLast) {
      children.push(buildSignatureTable(doc));
    }
  }

  const wordDoc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_SPEC,
            size: 26,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width in twips
              height: 16838, // A4 height in twips
            },
            margin: {
              top: 1450,
              bottom: 1000,
              left: 650,
              right: 650,
              header: 400,
              footer: 400,
            },
          },
        },
        headers: {
          default: new Header({ children: [headerTable] }),
        },
        footers: {
          default: pageFooter,
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${buildExportFileName(doc)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
