"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Country codes ──────────────────────────────────────────────────────────────

const CODES = [
  { value: "+225", label: "🇨🇮 +225" },
  { value: "+221", label: "🇸🇳 +221" },
  { value: "+223", label: "🇲🇱 +223" },
  { value: "+226", label: "🇧🇫 +226" },
  { value: "+229", label: "🇧🇯 +229" },
  { value: "+237", label: "🇨🇲 +237" },
  { value: "+212", label: "🇲🇦 +212" },
  { value: "+33",  label: "🇫🇷 +33"  },
  { value: "+32",  label: "🇧🇪 +32"  },
  { value: "+44",  label: "🇬🇧 +44"  },
  { value: "+1",   label: "🇺🇸 +1"   },
] as const;

const CODES_BY_LEN = [...CODES].sort((a, b) => b.value.length - a.value.length);

// ── Formatting helpers ─────────────────────────────────────────────────────────

/** Display: space every 2 digits — "07 01 02 03 04" */
function formatLocal(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** Raw digits only — strip everything except digits */
function rawDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function parseFullPhone(full: string) {
  if (!full) return { code: "+225", isOther: false, custom: "+", local: "" };
  for (const c of CODES_BY_LEN) {
    if (full.startsWith(c.value)) {
      return { code: c.value, isOther: false, custom: "+", local: formatLocal(full.slice(c.value.length)) };
    }
  }
  const m = full.match(/^(\+\d{1,4})(.*)/);
  if (m) return { code: "other", isOther: true, custom: m[1], local: formatLocal(m[2]) };
  return { code: "+225", isOther: false, custom: "+", local: formatLocal(full) };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  defaultValue?: string;
  onChange: (fullPhone: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
  selectClassName?: string;
  inputClassName?: string;
  wrapperClassName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhoneInput({
  defaultValue = "",
  onChange,
  placeholder = "07 00 00 00 00",
  required = false,
  autoFocus = false,
  id,
  selectClassName,
  inputClassName,
  wrapperClassName,
}: PhoneInputProps) {
  const init = parseFullPhone(defaultValue);
  const [code, setCode]       = useState(init.code);
  const [isOther, setIsOther] = useState(init.isOther);
  const [custom, setCustom]   = useState(init.custom);
  const [local, setLocal]     = useState(init.local); // formatted display value

  const effectiveCode = isOther ? custom : code;

  function emit(c: string, formatted: string) {
    // Always emit without spaces so callers get a clean E.164-ready string
    onChange(c + rawDigits(formatted));
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "other") {
      setIsOther(true);
      setCustom("+");
      emit("+", local);
    } else {
      setIsOther(false);
      setCode(val);
      emit(val, local);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value;
    if (!v.startsWith("+")) v = "+" + v.replace(/^\++/, "");
    if (v.length > 5) v = v.slice(0, 5);
    setCustom(v);
    emit(v, local);
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const codeDigits = effectiveCode.replace(/^\+/, "");
    let digits = rawDigits(e.target.value);

    // Strip country prefix if user pasted the full number
    if (digits.startsWith(codeDigits) && codeDigits.length >= 3) {
      digits = digits.slice(codeDigits.length);
    }

    const formatted = formatLocal(digits);
    setLocal(formatted);
    emit(effectiveCode, formatted);
  }

  // Base styles — shrink-0 on selector prevents it growing and crowding the number input
  const baseSelect =
    "h-10 w-[80px] shrink-0 border border-r-0 border-input bg-muted text-sm " +
    "text-foreground rounded-l-xl px-2 box-border focus:outline-none focus:ring-2 focus:ring-ring";
  const baseInput =
    "flex-1 min-w-0 h-10 border border-input bg-background rounded-r-xl px-3 text-sm " +
    "box-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

  return (
    // w-full + overflow-hidden prevents horizontal overflow on mobile Safari
    <div className={cn("flex w-full max-w-full overflow-hidden", wrapperClassName)}>
      {isOther ? (
        <input
          type="text"
          value={custom}
          onChange={handleCustomChange}
          onBlur={() => {
            if (custom.length < 2) {
              setIsOther(false);
              setCode("+225");
              emit("+225", local);
            }
          }}
          placeholder="+XXX"
          maxLength={5}
          aria-label="Code pays"
          className={cn(baseSelect, "w-[70px] text-center", selectClassName)}
        />
      ) : (
        <select
          value={code}
          onChange={handleCodeChange}
          aria-label="Code pays"
          className={cn(baseSelect, selectClassName)}
        >
          {CODES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
          <option value="other">Autre…</option>
        </select>
      )}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        pattern="[0-9 ]*"
        value={local}
        onChange={handleLocalChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={cn(baseInput, inputClassName)}
      />
    </div>
  );
}
