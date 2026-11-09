"use client";
import { useEffect, useRef, useState } from "react";

// Counts up from 0 to the value when it first appears.
export default function CountUp({ value, duration = 700 }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const target = Number(value) || 0;
    if (!target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      ref.current = requestAnimationFrame(() => setN(target));
      return () => cancelAnimationFrame(ref.current);
    }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  if (typeof value !== "number") return value ?? "—";
  return <span className="tabular-nums">{n.toLocaleString("en-IN")}</span>;
}
