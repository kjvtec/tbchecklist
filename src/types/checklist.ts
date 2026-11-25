export type CheckStatus = "pass" | "fail" | "na" | null;

export interface HardwareSerialRow {
  id: string;
  itemName: string;
  serialNumber: string;
  ipAddress?: string;
}

export interface WorkDayRow {
  id: string;
  date: string;
  detail: string;
  staff: string;
  jobNo: string;
}

export interface SoftwareVersionRow {
  id: string;
  name: string;
  version: string;
}

export interface ChecklistItem {
  id: string;
  code: string;
  label: string;
  status: CheckStatus;
  remark: string;
}

export interface ChecklistCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface IpAddressRow {
  id: string;
  hardwareName: string;
  ipAddress: string;
  patchPanelPort: string;
}

export interface PhotoRow {
  id: string;
  detail: string;
  imageUrl: string;
}

export interface SignatureEntry {
  role: string;
  name: string;
  date: string;
}

export interface SectionTiming {
  startTime: string;
  endTime: string;
}

export interface ChecklistPayload {
  workStartTime?: string;
  workEndTime?: string;
  sectionTimings?: Record<string, SectionTiming>;
  hardwareSerials: HardwareSerialRow[];
  plannedWorkDays: WorkDayRow[];
  extraWorkDays: WorkDayRow[];
  softwareVersions: SoftwareVersionRow[];
  checklistCategories: ChecklistCategory[];
  ipAddresses: IpAddressRow[];
  photos: PhotoRow[];
  signatures: SignatureEntry[];
}

export interface ChecklistDocument {
  id?: string;
  store_id: string;
  shop_name: string;
  engineer_in_charge: string;
  doc_datetime: string;
  address: string;
  total_work_days: number;
  payload: ChecklistPayload;
  created_at?: string;
  updated_at?: string;
}

export type ChecklistSummary = Omit<ChecklistDocument, "payload">;
