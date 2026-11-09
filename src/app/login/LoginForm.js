"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { api } from "@/components/api-client";
import OtpInput from "@/components/OtpInput";
import Icon from "@/components/Icon";
import { homeFor } from "@/lib/constants";

const EMAIL_ERRORS = {
  invalid: "Email or password is incorrect.",
  inactive: "This account is inactive. Contact your administrator.",
  rate_limited: "Too many failed attempts. Try again in 15 minutes.",
  missing: "Enter your email and password.",
};

// One login page: mobile OTP on one side, email + password on the other.
export default function LoginForm({ next, initialMode }) {
  const [mode, setMode] = useState(initialMode);
  const otpRef = useRef(null);
  const emailRef = useRef(null);
  const [height, setHeight] = useState();
  // Animate the box to the height of whichever side is showing.
  useEffect(() => {
    const el = (mode === "otp" ? otpRef : emailRef).current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  return (
    <div className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
      <div role="tablist" aria-label="Login method" className="relative mb-6 grid grid-cols-2 rounded-xl bg-[#f3ede1] p-1 ring-1 ring-[#e7dcc6]">
        <span className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-gold-300/70 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ transform: mode === "email" ? "translateX(100%)" : "none" }} />
        {[["otp", "Mobile OTP", "phone"], ["email", "Email & password", "mail"]].map(([k, l, ic]) => (
          <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => setMode(k)} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === k ? "text-brand-800" : "text-slate-500 hover:text-slate-700"}`}>
            <Icon name={ic} size={16} className={`transition-transform duration-500 ${mode === k ? "scale-110 -rotate-6" : "scale-100"}`} /> {l}
          </button>
        ))}
      </div>

      <div className="overflow-clip [perspective:1200px] transition-[height] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ height }}>
        <div className="flex w-[200%] items-start transition-transform duration-[600ms] ease-[cubic-bezier(0.65,0,0.35,1)]" style={{ transform: mode === "email" ? "translateX(-50%)" : "none" }}>
          <div ref={otpRef} className={`switch-panel w-1/2 px-1 pb-1 ${mode === "otp" ? "is-active" : "is-out"}`} inert={mode !== "otp"}><OtpPanel next={next} /></div>
          <div ref={emailRef} className={`switch-panel w-1/2 px-1 pb-1 ${mode === "email" ? "is-active" : "is-out"}`} inert={mode !== "email"}><EmailPanel next={next} /></div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-gold-300 bg-gold-50/60 p-4 text-center text-sm">
        <span className="text-slate-600">New employee? </span>
        <Link href="/register" className="group inline-flex items-center gap-1 font-semibold text-brand-700">Register yourself <Icon name="arrowRight" size={15} className="transition-transform group-hover:translate-x-1" /></Link>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400"><Link href="/privacy" className="hover:underline">Privacy policy</Link></p>
    </div>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return <p className="animate-scale-in rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{children}</p>;
}

function OtpPanel({ next }) {
  const [step, setStep] = useState("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [dev, setDev] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/otp/send", { method: "POST", data: { mobile } });
      setDev(r.dev);
      setStep("otp");
      setOtp("");
      setWait(r.resendAfter || 30);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const verify = async (e) => {
    e?.preventDefault();
    if (otp.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/otp/verify", { method: "POST", data: { mobile, otp } });
      window.location.href = next?.startsWith("/patient") ? next : r.redirect || "/patient";
    } catch (err) {
      setError(err.message);
      setOtp("");
      setBusy(false);
    }
  };

  if (step === "mobile") {
    return (
      <form onSubmit={send} className="space-y-4">
        <div>
          <label className="label" htmlFor="mobile">Registered mobile number</label>
          <div className="flex rounded-lg transition-shadow focus-within:ring-4 focus-within:ring-brand-600/15">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
            <input id="mobile" className="input rounded-l-none py-2.5 text-base focus:ring-0" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210" required value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Employees log in with the number registered with their company.</p>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <button className="btn-primary w-full py-2.5" disabled={busy || mobile.length !== 10}>{busy ? <Spinner /> : null}{busy ? "Sending OTP…" : "Send OTP"}</button>
      </form>
    );
  }
  return (
    <form onSubmit={verify} className="animate-slide-right space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">Code sent to <b>+91 {mobile}</b></span>
        <button type="button" className="link text-xs" onClick={() => { setStep("mobile"); setError(""); }}>Change</button>
      </div>
      <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(""); }} autoFocus error={Boolean(error)} disabled={busy} />
      {dev && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Development mode: SMS is not set up. Use the DEV_OTP from .env.</p>}
      <ErrorBox>{error}</ErrorBox>
      <button className="btn-primary w-full py-2.5" disabled={busy || otp.length !== 6}>{busy ? <Spinner /> : null}{busy ? "Verifying…" : "Verify and log in"}</button>
      <p className="text-center text-sm text-slate-500">
        Didn&apos;t get it?{" "}
        <button type="button" className="link disabled:cursor-default disabled:text-slate-400 disabled:no-underline" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : "Resend OTP"}</button>
      </p>
    </form>
  );
}

function EmailPanel({ next }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("staff", { email, password, redirect: false });
    if (res?.error) {
      setError(EMAIL_ERRORS[res.code] || EMAIL_ERRORS.invalid);
      setBusy(false);
      return;
    }
    const s = await getSession();
    const home = homeFor(s?.user?.role);
    window.location.href = next && next.startsWith(home) ? next : home;
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input py-2.5 text-base" type="email" autoComplete="username" placeholder="you@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" className="input py-2.5 pr-11 text-base" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 transition hover:text-slate-700" aria-label={show ? "Hide password" : "Show password"}><Icon name={show ? "eyeOff" : "eye"} /></button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">For admins, support, Cluster Managers and hospital staff.</p>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? <Spinner /> : null}{busy ? "Signing in…" : "Log in"}</button>
    </form>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />;
}
