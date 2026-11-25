import {
  ChecklistCategory,
  ChecklistDocument,
  HardwareSerialRow,
  IpAddressRow,
} from "@/types/checklist";

export const COMPANY_HEADER = {
  nameTh: "บริษัท เวอร์ติคัลเทค จำกัด",
  nameEn: "VerticalTec Co., Ltd.",
  fullName: "บริษัท เวอร์ติคัลเทค จำกัด (VerticalTec Co., Ltd.)",
  address:
    "หมู่บ้านบิซ แกลเลอเรีย เลขที่ 388/68 ถนนนวลจันทร์ แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพมหานคร 10230",
  documentTitle: "แบบฟอร์ม Check List งานเปลี่ยนระบบ POS สาขา (Replace POS – ThaiBev)",
  logoPath: "/verticaltec-logo.png",
};

export function buildExportFileName(
  doc: Pick<ChecklistDocument, "shop_name" | "store_id">
): string {
  const rawBranch = (doc.shop_name || doc.store_id || "สาขา")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const baseName = rawBranch || "สาขา";
  return `${baseName} Check List`;
}

export function createId(prefix = "row"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const TEST_SECTION_KEYWORDS = [
  "หลังจากเชื่อมต่ออุปกรณ์ทั้งหมด",
  "ทดสอบโปรแกรม",
];

export function isEquipmentCategory(cat: ChecklistCategory): boolean {
  return !TEST_SECTION_KEYWORDS.some((kw) => cat.title.includes(kw));
}

const NON_NETWORK_KEYWORDS = [
  "monitor",
  "mouse",
  "keyboard",
  "ups",
  "cashdrawer",
  "ลิ้นชัก",
  "barcode",
  "scanner",
  "bump bar",
  "touch screen",
];

export function isNetworkHardware(rawName: string): boolean {
  const lower = rawName.toLowerCase();
  if (!lower.trim()) return true;
  if (lower.includes("kds display") || lower.includes("kds controller")) {
    return true;
  }
  if (
    lower.includes("pos") ||
    lower.includes("server") ||
    lower.includes("printer") ||
    lower.includes("router") ||
    lower.includes("switch") ||
    lower.includes("edc") ||
    lower.includes("kiosk") ||
    lower.includes("iorder") ||
    lower.includes("controller") ||
    lower.includes("mini pc")
  ) {
    // Even if a POS row mentions something else, it's a terminal;
    // only exclude pure peripherals like "Monitor 2", "Mouse, Keyboard", "UPS", "Cashdrawer", "Barcode Scanner"
    if (
      lower.includes("monitor") ||
      lower.includes("mouse") ||
      lower.includes("keyboard") ||
      lower.includes("ups") ||
      lower.includes("cashdrawer") ||
      lower.includes("ลิ้นชัก") ||
      lower.includes("barcode") ||
      lower.includes("scanner")
    ) {
      return false;
    }
    return true;
  }
  return !NON_NETWORK_KEYWORDS.some((kw) => lower.includes(kw));
}

export function parseGroupedName(raw: string): { group: string; label: string } {
  const match = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return { group: match[1].trim(), label: match[2].trim() };
  }
  return { group: "อื่นๆ / เพิ่มเติม", label: raw };
}

export function groupItemsPreservingOrder<T>(
  items: T[],
  getName: (item: T) => string
): { group: string; entries: { item: T; index: number; label: string }[] }[] {
  const groups: { group: string; entries: { item: T; index: number; label: string }[] }[] = [];
  const groupMap = new Map<string, { group: string; entries: { item: T; index: number; label: string }[] }>();

  items.forEach((item, index) => {
    const { group, label } = parseGroupedName(getName(item));
    let bucket = groupMap.get(group);
    if (!bucket) {
      bucket = { group, entries: [] };
      groupMap.set(group, bucket);
      groups.push(bucket);
    }
    bucket.entries.push({ item, index, label });
  });

  return groups;
}

export function extractEquipmentItemsFromChecklist(
  categories: ChecklistCategory[]
): { sectionTitle: string; label: string }[] {
  const result: { sectionTitle: string; label: string }[] = [];
  for (const cat of categories) {
    if (!isEquipmentCategory(cat)) continue;
    const cleanSection = cat.title.replace(/^\d+\.\s*/, "").trim();
    for (const item of cat.items) {
      if (!item.label.trim()) continue;
      result.push({
        sectionTitle: cleanSection,
        label: `[${cleanSection}] ${item.label.trim()}`,
      });
    }
  }
  return result;
}

export function buildHardwareSerialsFromChecklist(
  categories: ChecklistCategory[],
  existing: HardwareSerialRow[] = []
): HardwareSerialRow[] {
  const equipment = extractEquipmentItemsFromChecklist(categories);
  const existingMap = new Map(existing.map((r) => [r.itemName, r]));
  const synced: HardwareSerialRow[] = equipment.map((eq) => {
    const prev = existingMap.get(eq.label);
    return prev
      ? { ...prev, ipAddress: prev.ipAddress ?? "" }
      : { id: createId("hw"), itemName: eq.label, serialNumber: "", ipAddress: "" };
  });
  return synced;
}

export function buildIpAddressesFromChecklist(
  categories: ChecklistCategory[],
  existing: IpAddressRow[] = []
): IpAddressRow[] {
  const equipment = extractEquipmentItemsFromChecklist(categories);
  const existingMap = new Map(existing.map((r) => [r.hardwareName, r]));
  return equipment.map((eq) => {
    const prev = existingMap.get(eq.label);
    return prev
      ? prev
      : {
          id: createId("ip"),
          hardwareName: eq.label,
          ipAddress: "",
          patchPanelPort: "",
        };
  });
}

export function createDefaultChecklist(): ChecklistDocument {
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return {
    store_id: "",
    shop_name: "",
    engineer_in_charge: "",
    doc_datetime: formattedDate,
    address: "",
    total_work_days: 1,
    payload: {
      "workStartTime": "",
      "workEndTime": "",
      "sectionTimings": {},
      "hardwareSerials": [
            {
                  "id": "hw-1",
                  "itemName": "[Manager Room / Back Office] Server / Back Office PC",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-7",
                  "itemName": "[Pos Cashier] เครื่อง POS Cashier",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-8",
                  "itemName": "[Pos Cashier] Monitor 2 (Customer Display)",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-9",
                  "itemName": "[Pos Cashier] Cashdrawer (ลิ้นชักเก็บเงิน)",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-10",
                  "itemName": "[Pos Cashier] Slip Printer (เครื่องพิมพ์ใบเสร็จ)",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-11",
                  "itemName": "[Pos Cashier] Barcode Scanner",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-12",
                  "itemName": "[Pos Cashier] EDC (กรณีร้านค้ามีการเชื่อมต่อกับระบบ POS)",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-13",
                  "itemName": "[Pos Cashier] Mouse, Keyboard",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-14",
                  "itemName": "[Pos Cashier] UPS",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-15",
                  "itemName": "[POS ORDER] เครื่อง POS ORDER",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-16",
                  "itemName": "[POS ORDER] Slip Printer / Order Printer",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-17",
                  "itemName": "[POS ORDER] Mouse, Keyboard",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-18",
                  "itemName": "[POS ORDER] UPS",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-19",
                  "itemName": "[Kitchen Printer] Kitchen Printer 1",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-20",
                  "itemName": "[Kitchen Printer] Kitchen Printer 2",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-21",
                  "itemName": "[Kitchen Printer] Kitchen Printer 3",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-22",
                  "itemName": "[Kitchen Printer] Kitchen Printer 4",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-23",
                  "itemName": "[KDS System] KDS Display / Monitor",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-24",
                  "itemName": "[KDS System] KDS Controller / Mini PC",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-25",
                  "itemName": "[KDS System] Mouse / Touch Screen / Bump Bar",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-26",
                  "itemName": "[Kiosk] เครื่อง Kiosk",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-27",
                  "itemName": "[Kiosk] Slip Printer (Kiosk)",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-28",
                  "itemName": "[Kiosk] QR / EDC Payment Terminal",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-29",
                  "itemName": "[Kiosk] Barcode / QR Scanner",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-30",
                  "itemName": "[Kiosk] UPS",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-31",
                  "itemName": "[iOrder (2 เครื่อง)] Tablet iOrder เครื่องที่ 1",
                  "serialNumber": "",
                  "ipAddress": ""
            },
            {
                  "id": "hw-32",
                  "itemName": "[iOrder (2 เครื่อง)] Tablet iOrder เครื่องที่ 2",
                  "serialNumber": "",
                  "ipAddress": ""
            }
      ],
      "plannedWorkDays": [
            {
                  "id": "pwd-6119a501",
                  "date": "",
                  "detail": "",
                  "staff": "",
                  "jobNo": ""
            },
            {
                  "id": "pwd-39dd4ea5",
                  "date": "",
                  "detail": "",
                  "staff": "",
                  "jobNo": ""
            },
            {
                  "id": "pwd-4b1a48b0",
                  "date": "",
                  "detail": "",
                  "staff": "",
                  "jobNo": ""
            }
      ],
      "extraWorkDays": [
            {
                  "id": "ewd-c434b84d",
                  "date": "",
                  "detail": "",
                  "staff": "",
                  "jobNo": ""
            },
            {
                  "id": "ewd-6c40ab20",
                  "date": "",
                  "detail": "",
                  "staff": "",
                  "jobNo": ""
            },
            {
                  "id": "wd-e6d6cb42",
                  "date": "",
                  "detail": "",
                  "staff": "",
                  "jobNo": ""
            }
      ],
      "softwareVersions": [
            {
                  "id": "sw-1",
                  "name": "[Manager Room / Back Office] vTecSystem",
                  "version": ""
            },
            {
                  "id": "sw-2",
                  "name": "[Pos Cashier] vTec-ResPOS",
                  "version": ""
            },
            {
                  "id": "sw-3",
                  "name": "[POS ORDER] vTec-ResPOS",
                  "version": ""
            },
            {
                  "id": "sw-4",
                  "name": "[KDS System] KDS",
                  "version": ""
            },
            {
                  "id": "sw-5",
                  "name": "[Kiosk] Kiosk",
                  "version": ""
            },
            {
                  "id": "sw-6",
                  "name": "[iOrder (2 เครื่อง)] iOrder เครื่องที่ 1",
                  "version": ""
            },
            {
                  "id": "sw-7",
                  "name": "[iOrder (2 เครื่อง)] iOrder เครื่องที่ 2",
                  "version": ""
            }
      ],
      "checklistCategories": [
            {
                  "id": "cat-1",
                  "title": "1. Manager Room / Back Office",
                  "items": [
                        {
                              "id": "1-1",
                              "code": "1.1",
                              "label": "Server / Back Office PC",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "1-2",
                              "code": "1.2",
                              "label": "Monitor",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "1-3",
                              "code": "1.3",
                              "label": "Mouse, Keyboard",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "1-4",
                              "code": "1.4",
                              "label": "UPS",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "1-5",
                              "code": "1.5",
                              "label": "Router / Network Switch / Patch Panel",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "1-6",
                              "code": "1.6",
                              "label": "Printer (Back Office)",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-2",
                  "title": "2. Pos Cashier",
                  "items": [
                        {
                              "id": "2-1",
                              "code": "2.1",
                              "label": "เครื่อง POS Cashier",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-2",
                              "code": "2.2",
                              "label": "Monitor 2 (Customer Display)",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-3",
                              "code": "2.3",
                              "label": "Cashdrawer (ลิ้นชักเก็บเงิน)",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-4",
                              "code": "2.4",
                              "label": "Slip Printer (เครื่องพิมพ์ใบเสร็จ)",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-5",
                              "code": "2.5",
                              "label": "Barcode Scanner",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-6",
                              "code": "2.6",
                              "label": "EDC (กรณีร้านค้ามีการเชื่อมต่อกับระบบ POS)",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-7",
                              "code": "2.7",
                              "label": "Mouse, Keyboard",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "2-8",
                              "code": "2.8",
                              "label": "UPS",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-3",
                  "title": "3. POS ORDER",
                  "items": [
                        {
                              "id": "3-1",
                              "code": "3.1",
                              "label": "เครื่อง POS ORDER",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "3-2",
                              "code": "3.2",
                              "label": "Slip Printer / Order Printer",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "3-3",
                              "code": "3.3",
                              "label": "Mouse, Keyboard",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "3-4",
                              "code": "3.4",
                              "label": "UPS",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-4",
                  "title": "4. Kitchen Printer",
                  "items": [
                        {
                              "id": "4-1",
                              "code": "4.1",
                              "label": "Kitchen Printer 1",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "4-2",
                              "code": "4.2",
                              "label": "Kitchen Printer 2",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "4-3",
                              "code": "4.3",
                              "label": "Kitchen Printer 3",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "4-4",
                              "code": "4.4",
                              "label": "Kitchen Printer 4",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-5",
                  "title": "5. KDS System",
                  "items": [
                        {
                              "id": "5-1",
                              "code": "5.1",
                              "label": "KDS Display / Monitor",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "5-2",
                              "code": "5.2",
                              "label": "KDS Controller / Mini PC",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "5-3",
                              "code": "5.3",
                              "label": "Mouse / Touch Screen / Bump Bar",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-6",
                  "title": "6. Kiosk",
                  "items": [
                        {
                              "id": "6-1",
                              "code": "6.1",
                              "label": "เครื่อง Kiosk",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "6-2",
                              "code": "6.2",
                              "label": "Slip Printer (Kiosk)",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "6-3",
                              "code": "6.3",
                              "label": "QR / EDC Payment Terminal",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "6-4",
                              "code": "6.4",
                              "label": "Barcode / QR Scanner",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "6-5",
                              "code": "6.5",
                              "label": "UPS",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-7",
                  "title": "7. iOrder (2 เครื่อง)",
                  "items": [
                        {
                              "id": "7-1",
                              "code": "7.1",
                              "label": "Tablet iOrder เครื่องที่ 1",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "7-2",
                              "code": "7.2",
                              "label": "Tablet iOrder เครื่องที่ 2",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-8",
                  "title": "8. หลังจากเชื่อมต่ออุปกรณ์ทั้งหมดแล้วตรวจสอบอุปกรณ์ทั้งหมดว่าทำงานได้",
                  "items": [
                        {
                              "id": "8-1",
                              "code": "8.1",
                              "label": "[Manager Room / Back Office] Server / Back Office PC, Monitor, UPS และ Printer พร้อมใช้งาน",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-2",
                              "code": "8.2",
                              "label": "[Manager Room / Back Office] Router / Network Switch / Patch Panel เชื่อมต่อเครือข่ายได้ปกติ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-3",
                              "code": "8.3",
                              "label": "[Pos Cashier] เครื่อง POS Cashier และ Monitor 2 อยู่ในสภาพพร้อมใช้งาน",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-4",
                              "code": "8.4",
                              "label": "[Pos Cashier] Cashdrawer หลังจากทดสอบทำการขายแล้วลิ้นชักดีดออก",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-5",
                              "code": "8.5",
                              "label": "[Pos Cashier] Slip Printer มีไฟสีเขียว และทำการ Print Test ออกปกติ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-6",
                              "code": "8.6",
                              "label": "[Pos Cashier] Barcode Scanner, EDC, Mouse/Keyboard และ UPS ทำงานได้ปกติ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-7",
                              "code": "8.7",
                              "label": "[POS ORDER] เครื่อง POS ORDER, Slip/Order Printer, Mouse/Keyboard และ UPS ทำงานได้ปกติ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-8",
                              "code": "8.8",
                              "label": "[Kitchen Printer] Kitchen Printer 1, 2, 3 และ 4 มีไฟสถานะปกติและ Print Test ออกทุกจุด",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-9",
                              "code": "8.9",
                              "label": "[KDS System] KDS Display, Controller และ Mouse/Touch/Bump Bar แสดงผลได้ปกติ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-10",
                              "code": "8.10",
                              "label": "[Kiosk] เครื่อง Kiosk, Slip Printer, QR/EDC, Scanner และ UPS ทำงานได้ปกติ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "8-11",
                              "code": "8.11",
                              "label": "[iOrder (2 เครื่อง)] Tablet iOrder เครื่องที่ 1 และ 2 เชื่อมต่อ Wi-Fi/Server ได้ปกติ",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-9",
                  "title": "9. ทดสอบโปรแกรม vTec-ResPOS",
                  "items": [
                        {
                              "id": "9-1",
                              "code": "9.1",
                              "label": "[Pos Cashier] สามารถ Login เข้าระบบได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-2",
                              "code": "9.2",
                              "label": "[Pos Cashier] หน้าแสดงเมนูแสดงรายละเอียดครบถ้วนและภาษาถูกต้อง",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-3",
                              "code": "9.3",
                              "label": "[Pos Cashier] คีย์รายการในเมนูและส่งเข้าครัว/KDS ได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-4",
                              "code": "9.4",
                              "label": "[Pos Cashier] สามารถยกเลิกรายการ ระบบพิมพ์รายการยกเลิกได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-5",
                              "code": "9.5",
                              "label": "[Pos Cashier] เก็บเงินด้วย Payment Cash (เงินสด) และลิ้นชักดีดออก",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-6",
                              "code": "9.6",
                              "label": "[Pos Cashier] เก็บเงินด้วย Payment Credit แบบ Manual / Link EDC / Payment อื่นๆ ได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-7",
                              "code": "9.7",
                              "label": "[Pos Cashier] สามารถ Void Bill, ออกใบกำกับภาษี และปิดกะ/ปิดสิ้นวันได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-8",
                              "code": "9.8",
                              "label": "[POS ORDER] Login, คีย์รายการ, ส่งเข้า Kitchen Printer/KDS และยกเลิกรายการได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-9",
                              "code": "9.9",
                              "label": "[Kitchen Printer] รับรายการสั่งและรายการยกเลิกพิมพ์ออกถูกต้องตามจุด (ครบทั้ง 4 จุด)",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-10",
                              "code": "9.10",
                              "label": "[KDS System] แสดงออเดอร์และสถานะรายการยกเลิกถูกต้องตามจุด",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "9-11",
                              "code": "9.11",
                              "label": "[Kiosk] สั่งรายการ ชำระเงิน และพิมพ์ใบเสร็จได้ปกติ",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-10",
                  "title": "10. ทดสอบโปรแกรม vTecSystem",
                  "items": [
                        {
                              "id": "10-1",
                              "code": "10.1",
                              "label": "สามารถเข้าโปรแกรม vTecSystem (Manager Room / Back Office) ได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "10-2",
                              "code": "10.2",
                              "label": "เรียกดู - รายงานสรุปยอดขายตามวัน",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "10-3",
                              "code": "10.3",
                              "label": "เรียกดู - รายงานสรุปยอดขายตามกะ",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "10-4",
                              "code": "10.4",
                              "label": "สร้างเอกสารรับตรงที่สาขาได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "10-5",
                              "code": "10.5",
                              "label": "ตั้งต้นสต๊อก",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "10-6",
                              "code": "10.6",
                              "label": "ตั้งค่านับสต๊อก",
                              "status": null,
                              "remark": ""
                        }
                  ]
            },
            {
                  "id": "cat-11",
                  "title": "11. ทดสอบโปรแกรม iOrder (2 เครื่อง)",
                  "items": [
                        {
                              "id": "11-1",
                              "code": "11.1",
                              "label": "[Tablet iOrder เครื่องที่ 1] เข้าโปรแกรม iOrder ได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "11-2",
                              "code": "11.2",
                              "label": "[Tablet iOrder เครื่องที่ 1] เมนูโชว์รายละเอียดครบ, เลือกรายการ/Modified และส่งเข้าครัว/KDS ถูกต้อง",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "11-3",
                              "code": "11.3",
                              "label": "[Tablet iOrder เครื่องที่ 2] เข้าโปรแกรม iOrder ได้",
                              "status": null,
                              "remark": ""
                        },
                        {
                              "id": "11-4",
                              "code": "11.4",
                              "label": "[Tablet iOrder เครื่องที่ 2] เมนูโชว์รายละเอียดครบ, เลือกรายการ/Modified และส่งเข้าครัว/KDS ถูกต้อง",
                              "status": null,
                              "remark": ""
                        }
                  ]
            }
      ],
      "ipAddresses": [],
      "photos": [
            {
                  "id": "ph-1",
                  "detail": "[Manager Room / Back Office] รูป Server / Back Office PC & ตู้ Rack",
                  "imageUrl": ""
            },
            {
                  "id": "ph-2",
                  "detail": "[Pos Cashier] รูปเครื่อง POS Cashier",
                  "imageUrl": ""
            },
            {
                  "id": "ph-3",
                  "detail": "[Pos Cashier] ใบเสร็จ",
                  "imageUrl": ""
            },
            {
                  "id": "ph-4",
                  "detail": "[Pos Cashier] ใบกำกับภาษี",
                  "imageUrl": ""
            },
            {
                  "id": "ph-5",
                  "detail": "[POS ORDER] รูปเครื่อง POS ORDER",
                  "imageUrl": ""
            },
            {
                  "id": "ph-6",
                  "detail": "[Kitchen Printer] รูปเครื่อง Kitchen Printer (1-4)",
                  "imageUrl": ""
            },
            {
                  "id": "ph-7",
                  "detail": "[Kitchen Printer] ใบรายการพิมพ์ครัว",
                  "imageUrl": ""
            },
            {
                  "id": "ph-8",
                  "detail": "[KDS System] รูปหน้าจอ KDS System",
                  "imageUrl": ""
            },
            {
                  "id": "ph-9",
                  "detail": "[Kiosk] รูปเครื่อง Kiosk & ใบเสร็จ Kiosk",
                  "imageUrl": ""
            },
            {
                  "id": "ph-10",
                  "detail": "[iOrder (2 เครื่อง)] รูป Tablet iOrder เครื่องที่ 1",
                  "imageUrl": ""
            },
            {
                  "id": "ph-11",
                  "detail": "[iOrder (2 เครื่อง)] รูป Tablet iOrder เครื่องที่ 2",
                  "imageUrl": ""
            }
      ],
      "signatures": [
            {
                  "role": "เจ้าหน้าที่ส่งมอบ",
                  "name": "",
                  "date": ""
            },
            {
                  "role": "ผู้จัดการหรือผู้มีอำนาจ",
                  "name": "",
                  "date": ""
            },
            {
                  "role": "เจ้าหน้าที่ตรวจสอบ",
                  "name": "",
                  "date": ""
            }
      ]
},
  };
}
