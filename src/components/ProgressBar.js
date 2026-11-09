import { PATIENT_STAGES, patientStageIndex } from "@/lib/constants";

export default function ProgressBar({ status }) {
  const idx = patientStageIndex(status);
  return (
    <ol className="flex items-start">
      {PATIENT_STAGES.map((s, i) => (
        <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && (
            <span className="absolute right-1/2 top-2.5 h-0.5 w-full bg-slate-200">
              {i <= idx && <span className="animate-grow-x absolute inset-0 bg-brand-600" style={{ animationDelay: `${i * 0.12}s` }} />}
            </span>
          )}
          <span style={{ animationDelay: `${i * 0.12}s` }} className={`relative z-10 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${i <= idx ? "animate-pop bg-brand-600 text-white" : "bg-slate-200 text-slate-500"} ${i === idx && idx < PATIENT_STAGES.length - 1 ? "animate-pulse-ring" : ""}`}>{i < idx || (i === idx && i === PATIENT_STAGES.length - 1) ? "✓" : i + 1}</span>
          <span className={`mt-1 text-[10px] leading-tight sm:text-xs ${i <= idx ? "font-medium text-slate-800" : "text-slate-400"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
