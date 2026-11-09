"use client";
import { useRef } from "react";

// Six boxes with auto-advance, backspace and paste support.
export default function OtpInput({ value, onChange, autoFocus, error, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");
  // Read the other boxes from the DOM so fast typing or autofill never
  // overwrites a digit with a stale value.
  const setAt = (i, d) => {
    const next = Array.from({ length: 6 }, (_, j) => (j === i ? d : refs.current[j]?.value || ""));
    onChange(next.join("").slice(0, 6));
  };
  return (
    <div className={`flex justify-between gap-2 ${error ? "animate-shake" : ""}`} onPaste={(e) => {
      const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, 5)]?.focus(); }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            let raw = e.target.value.replace(/\D/g, "");
            // Typing over a filled box gives two characters: keep the new one.
            if (raw.length === 2 && digits[i] && raw.includes(digits[i])) raw = raw.replace(digits[i], "") || digits[i];
            // Several digits at once (autofill) fill the following boxes.
            if (raw.length > 1) {
              const before = Array.from({ length: i }, (_, j) => refs.current[j]?.value || "").join("");
              const full = (before + raw).slice(0, 6);
              onChange(full);
              refs.current[Math.min(full.length, 5)]?.focus();
              return;
            }
            setAt(i, raw);
            if (raw && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) { setAt(i - 1, ""); refs.current[i - 1]?.focus(); }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={`h-12 w-full min-w-0 rounded-xl border text-center text-xl font-semibold transition-all duration-150 focus:-translate-y-0.5 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15 sm:h-14 ${d ? "border-brand-500 bg-brand-50/50 text-brand-900" : "border-slate-300 bg-white"} ${error ? "border-red-400" : ""}`}
        />
      ))}
    </div>
  );
}
