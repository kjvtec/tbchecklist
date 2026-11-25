import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ChecklistDocument, ChecklistSummary } from "@/types/checklist";
import { createDefaultChecklist } from "@/lib/defaultTemplate";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

let client: SupabaseClient | null = null;

export const MASTER_TEMPLATE_STORE_ID = "__MASTER_TEMPLATE__";

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey);
  }
  return client;
}

export const PHOTO_BUCKET = "checklist-photos";

const SUMMARY_COLUMNS =
  "id, store_id, shop_name, engineer_in_charge, doc_datetime, address, total_work_days, created_at, updated_at";

export async function listChecklists(): Promise<ChecklistSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("checklists")
    .select(SUMMARY_COLUMNS)
    .neq("store_id", MASTER_TEMPLATE_STORE_ID)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChecklistSummary[];
}

export async function getMasterTemplate(): Promise<ChecklistDocument> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("checklists")
      .select("*")
      .eq("store_id", MASTER_TEMPLATE_STORE_ID)
      .maybeSingle();

    if (error || !data) {
      return createDefaultChecklist();
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;

    return {
      store_id: "",
      shop_name: "",
      engineer_in_charge: "",
      doc_datetime: formattedDate,
      address: "",
      total_work_days: 1,
      payload: structuredClone((data as ChecklistDocument).payload),
    };
  } catch {
    return createDefaultChecklist();
  }
}

export async function saveAsMasterTemplate(doc: ChecklistDocument): Promise<void> {
  const supabase = getSupabaseClient();
  const cleanPayload = {
    workStartTime: "",
    workEndTime: "",
    sectionTimings: {},
    hardwareSerials: doc.payload.hardwareSerials.map((r) => ({
      ...r,
      serialNumber: "",
      ipAddress: "",
    })),
    plannedWorkDays: doc.payload.plannedWorkDays.map((r) => ({
      ...r,
      date: "",
      detail: "",
      staff: "",
      jobNo: "",
    })),
    extraWorkDays: doc.payload.extraWorkDays.map((r) => ({
      ...r,
      date: "",
      detail: "",
      staff: "",
      jobNo: "",
    })),
    softwareVersions: doc.payload.softwareVersions.map((r) => ({
      ...r,
      version: "",
    })),
    checklistCategories: doc.payload.checklistCategories.map((c) => ({
      ...c,
      items: c.items.map((it) => ({
        ...it,
        status: null,
        remark: "",
      })),
    })),
    ipAddresses: [],
    photos: doc.payload.photos.map((r) => ({
      ...r,
      imageUrl: "",
    })),
    signatures: doc.payload.signatures.map((s) => ({
      ...s,
      name: "",
      date: "",
    })),
  };

  const { data: existing } = await supabase
    .from("checklists")
    .select("id")
    .eq("store_id", MASTER_TEMPLATE_STORE_ID)
    .maybeSingle();

  const row = {
    store_id: MASTER_TEMPLATE_STORE_ID,
    shop_name: "Master Template",
    engineer_in_charge: "",
    doc_datetime: "",
    address: "",
    total_work_days: 1,
    payload: cleanPayload,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("checklists")
      .update(row)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("checklists").insert(row);
    if (error) throw error;
  }
}

export async function getChecklistById(id: string): Promise<ChecklistDocument | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as ChecklistDocument | null) ?? null;
}

export async function saveChecklist(doc: ChecklistDocument): Promise<ChecklistDocument> {
  const supabase = getSupabaseClient();
  const row = {
    store_id: doc.store_id,
    shop_name: doc.shop_name,
    engineer_in_charge: doc.engineer_in_charge,
    doc_datetime: doc.doc_datetime,
    address: doc.address,
    total_work_days: Number(doc.total_work_days) || 0,
    payload: doc.payload,
  };

  if (doc.id) {
    const { data, error } = await supabase
      .from("checklists")
      .update(row)
      .eq("id", doc.id)
      .select()
      .single();
    if (error) throw error;
    return data as ChecklistDocument;
  } else {
    const { data, error } = await supabase
      .from("checklists")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as ChecklistDocument;
  }
}

export async function deleteChecklist(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("checklists").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadChecklistPhoto(file: File, storeId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeStore = (storeId || "general").replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${safeStore}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
