import Image from "next/image";

// The SUSALI emblem from the supplied logo artwork.
export function Logo({ size = 32, className = "" }) {
  return <Image src="/brand/emblem.png" alt="" width={Math.round(size * 0.885)} height={size} className={`h-auto shrink-0 ${className}`} style={{ width: Math.round(size * 0.885), height: "auto" }} priority />;
}

// Emblem + "SUSALI / HEALTHCARE" wordmark in the logo's lettering style.
export function Brand({ size = 34, light = false, sub = true }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} />
      <span className="flex flex-col leading-none">
        <span className={`font-brand text-[1.3rem] font-bold tracking-[0.06em] ${light ? "text-gold-200" : "text-emerald-gradient"}`}>SUSALI</span>
        {sub && <span className={`mt-0.5 text-[0.55rem] font-semibold tracking-[0.42em] ${light ? "text-gold-300" : "text-gold-600"}`}>HEALTHCARE</span>}
      </span>
    </span>
  );
}

// Full logo with tagline, for the landing and login pages.
export function FullLogo({ width = 260, className = "" }) {
  return <Image src="/brand/logo.png" alt="SUSALI Healthcare — Healthier lives ahead" width={width} height={Math.round(width * 1.017)} className={`h-auto ${className}`} style={{ width, height: "auto" }} priority />;
}

// Emerald and gold sweeping waves from the logo background.
export function Waves({ className = "", flip = false }) {
  return (
    <svg className={className} viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true" style={flip ? { transform: "rotate(180deg)" } : undefined}>
      <defs>
        <linearGradient id={`wg-gold${flip ? "f" : ""}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#875c22" /><stop offset="0.45" stopColor="#ecd49a" /><stop offset="1" stopColor="#a8772b" /></linearGradient>
        <linearGradient id={`wg-em${flip ? "f" : ""}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#083526" /><stop offset="1" stopColor="#156a4d" /></linearGradient>
      </defs>
      <path d="M0 0h600v40C470 70 330 40 220 110 140 160 60 200 0 260z" fill={`url(#wg-em${flip ? "f" : ""})`} />
      <path d="M0 260c60-60 140-100 220-150C330 40 470 70 600 40v12C474 84 340 58 232 124 150 174 70 214 0 260z" fill={`url(#wg-gold${flip ? "f" : ""})`} />
    </svg>
  );
}
