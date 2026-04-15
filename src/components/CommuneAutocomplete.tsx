"use client";
import { useState } from "react";

export const COMMUNES = [
  "Cocody", "Plateau", "Marcory", "Treichville", "Adjamé", "Yopougon",
  "Abobo", "Koumassi", "Port-Bouët", "Attécoubé", "Williamsville",
  "Bingerville", "Anyama",
];

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function CommuneAutocomplete({ label, value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (v.length > 0) {
      const filtered = COMMUNES.filter((c) =>
        c.toLowerCase().includes(v.toLowerCase())
      );
      setSuggestions(filtered);
      setOpen(filtered.length > 0);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const handleSelect = (commune: string) => {
    onChange(commune);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium">{label}</label>
      <input
        name="location"
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full border p-2 rounded"
        required
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-md mt-1 max-h-48 overflow-y-auto">
          {suggestions.map((c) => (
            <li
              key={c}
              onMouseDown={() => handleSelect(c)}
              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
