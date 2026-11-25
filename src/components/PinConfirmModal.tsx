"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const ADMIN_PIN = "112233";

interface PinConfirmModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function PinConfirmModal({
  open,
  title,
  subtitle,
  description,
  confirmLabel,
  tone = "primary",
  onCancel,
  onConfirm,
}: PinConfirmModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const isDanger = tone === "danger";

  const handleSubmit = async () => {
    if (submitting) return;
    if (pin !== ADMIN_PIN) {
      setError("รหัสไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !submitting) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3
          className={`text-base font-bold ${
            isDanger ? "text-rose-700" : "text-slate-900"
          }`}
        >
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 truncate text-xs text-slate-600">{subtitle}</p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">{description}</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          autoFocus
          onChange={(e) => {
            setPin(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="กรอกรหัสยืนยัน"
          className={`mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-base tracking-widest focus:outline-none ${
            isDanger ? "focus:border-rose-500" : "focus:border-sky-500"
          }`}
        />
        {error ? (
          <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
