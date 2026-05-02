"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Country codes (sorted longest-first for correct prefix matching) ──────────

const CODES = [
  { value: "+225", label: "+225 🇨🇮 Côte d'Ivoire" },
  { value: "+221", label: "+221 🇸🇳 Sénégal" },
  { value: "+223", label: "+223 🇲🇱 Mali" },
  { value: "+226", label: "+226 🇧🇫 Burkina Faso" },
  { value: "+229", label: "+229 🇧🇯 Bénin" },
  { value: "+237", label: "+237 🇨🇲 Cameroun" },
  { value: "+212", label: "+212 🇲🇦 Maroc" },
  { value: "+33",  label: "+33 🇫🇷 France" },
  { value: "+32",  label: "+32 🇧🇪 Belgique" },
  { value: "+44",  label: "+44 🇬🇧 UK" },
  { value: "+1",   label: "+1 🇺🇸 USA/Canada" },
] as const;

// Sorted by length desc to avoid "+1" matching "+12X..."
const CODES_BY_LEN = [...CODES].sort((a, b) => b.value.length - a.value.length);

function parseFullPhone(full: string) {
  if (!full) return { code: "+225", isOther: false, custom: "+", local: "" };
  for (const c of CODES_BY_LEN) {
    if (full.startsWith(c.value)) {
      return { code: c.value, isOther: false, custom: "+", local: full.slice(c.value.length) };
    }
  }
  const m = full.match(/^(\+\d{1,4})(.*)/);
  if (m) return { code: "other", isOther: true, custom: m[1], local: m[2] };
  return { code: "+225", isOther: false, custom: "+", local: full };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  /** Full phone for initialization only (e.g. "+22507123456") */
  defaultValue?: string;
  onChange: (fullPhone: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
  /** Extra classes merged onto the select / custom-code input */
  selectClassName?: string;
  /** Extra classes merged onto the number input */
  inputClassName?: string;
  /** Extra classes on the outer wrapper div */
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
  const [local, setLocal]     = useState(init.local);

  const effectiveCode = isOther ? custom : code;

  function emit(c: string, l: string) {
    onChange(c + l.replace(/\s+/g, ""));
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
    const l = e.target.value;
    setLocal(l);
    emit(effectiveCode, l);
  }

  const baseSelect = "h-10 border border-r-0 border-input bg-muted text-sm text-foreground rounded-l-xl px-2 focus:outline-none focus:ring-2 focus:ring-ring";
  const baseInput  = "flex-1 h-10 border border-input bg-background rounded-r-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

  return (
    <div className={cn("flex", wrapperClassName)}>
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
          className={cn(baseSelect, "w-[72px] text-center", selectClassName)}
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
        pattern="[0-9]*"
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
