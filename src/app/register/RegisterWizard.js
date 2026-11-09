"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/components/api-client";
import OtpInput from "@/components/OtpInput";
import Icon from "@/components/Icon";
import { GENDERS, BLOOD_GROUPS } from "@/lib/constants";
import { Spinner } from "../login/LoginForm";

const STEPS = ["Company", "About you", "Contact", "Verify"];
const EMPTY = {
  companyId: "", companyName: "", employeeCode: "", fullName: "", gender: "", dateOfBirth: "", bloodGroup: "",
  email: "", department: "", designation: "", aadhaarLast4: "", address: "", emergencyName: "", emergencyMobile: "", mobile: "",
};
const today = () => new Date().toISOString().slice(0, 10);

// Four-step self-registration: company → personal → contact → mobile OTP.
export default function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [v, setV] = useState(EMPTY);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k) => (e) => { setV({ ...v, [k]: e.target.value }); setError(""); };

  const validate = () => {
    if (step === 0) {
      if (!v.companyId) return "Choose your company from the list.";
      if (!v.employeeCode.trim()) return "Enter your employee ID.";
    }
    if (step === 1) {
      if (v.fullName.trim().length < 2) return "Enter your full name.";
      if (!v.gender) return "Choose your gender.";
      if (!v.dateOfBirth) return "Enter your date of birth.";
    }
    if (step === 2) {
      if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return "Enter a valid email or leave it blank.";
      if (v.aadhaarLast4 && !/^\d{4}$/.test(v.aadhaarLast4)) return "Aadhaar last 4 must be 4 digits.";
      if (v.emergencyMobile && !/^[6-9]\d{9}$/.test(v.emergencyMobile)) return "Emergency mobile must be 10 digits.";
    }
    return "";
  };
  const go = (to) => {
    if (to > step) {
      const msg = validate();
      if (msg) return setError(msg);
    }
    setError("");
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  if (done) return <Success />;

  return (
    <div className="animate-fade-up">
      <ol className="mb-6 flex items-center">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button type="button" onClick={() => i < step && go(i)} className="flex flex-col items-center gap-1" disabled={i > step}>
              <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-all duration-300 ${i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-700 text-white ring-4 ring-brand-100" : "bg-slate-100 text-slate-400"}`}>
                {i < step ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`hidden text-[11px] font-medium sm:block ${i <= step ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="mx-1.5 mb-0 h-0.5 flex-1 overflow-hidden rounded bg-slate-100 sm:mb-5">
                <span className="block h-full bg-brand-600 transition-all duration-500" style={{ width: i < step ? "100%" : "0%" }} />
              </span>
            )}
          </li>
        ))}
      </ol>

      <div key={step} className={dir > 0 ? "animate-slide-right" : "animate-slide-left"}>
        {step === 0 && <CompanyStep v={v} setV={setV} set={set} />}
        {step === 1 && <PersonalStep v={v} setV={setV} set={set} />}
        {step === 2 && <ContactStep v={v} set={set} setV={setV} />}
        {step === 3 && <VerifyStep v={v} setV={setV} onDone={() => setDone(true)} />}
      </div>

      {error && <p className="animate-scale-in mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

      {step < 3 && (
        <div className="mt-6 flex gap-2">
          {step > 0 && <button type="button" className="btn-secondary" onClick={() => go(step - 1)}><Icon name="arrowLeft" size={16} /> Back</button>}
          <button type="button" className="btn-primary group flex-1 py-2.5" onClick={() => go(step + 1)}>Continue <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-1" /></button>
        </div>
      )}
      {step === 3 && <button type="button" className="btn-ghost mt-3" onClick={() => go(2)}><Icon name="arrowLeft" size={16} /> Back</button>}

      <p className="mt-8 text-center text-sm text-slate-500">Already registered? <Link href="/login" className="link">Log in</Link></p>
    </div>
  );
}

function CompanyStep({ v, setV, set }) {
  const [q, setQ] = useState(v.companyName);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef();
  const search = (text) => {
    setQ(text);
    setV((x) => ({ ...x, companyId: "", companyName: "" }));
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setRows([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await api(`/api/public/companies?q=${encodeURIComponent(text)}`);
        setRows(r.rows);
        setOpen(true);
      } catch { setRows([]); }
      setLoading(false);
    }, 250);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="label" htmlFor="company">Your company</label>
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="company" className="input py-2.5 pl-9 text-base" autoComplete="off" placeholder="Start typing your company name" value={q} onChange={(e) => search(e.target.value)} onFocus={() => rows.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
          {loading && <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />}
          {v.companyId && !loading && <Icon name="check" size={16} className="animate-pop absolute right-3 top-1/2 -translate-y-1/2 text-brand-600" />}
        </div>
        {open && (
          <ul className="animate-scale-in absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            {rows.length ? rows.map((c) => (
              <li key={c.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setV((x) => ({ ...x, companyId: c.id, companyName: c.name })); setQ(c.name); setOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-brand-50">
                  <span className="font-medium">{c.name}</span><span className="text-xs text-slate-500">{c.city}</span>
                </button>
              </li>
            )) : <li className="px-3 py-3 text-sm text-slate-500">No company found. Ask your HR whether your company is on SUSALI.</li>}
          </ul>
        )}
      </div>
      <div>
        <label className="label" htmlFor="empcode">Employee ID</label>
        <input id="empcode" className="input py-2.5 text-base" placeholder="As on your ID card" value={v.employeeCode} onChange={set("employeeCode")} />
      </div>
    </div>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${value === o ? "bg-brand-700 text-white shadow-sm shadow-brand-700/30" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:ring-brand-400"}`}>{o}</button>
      ))}
    </div>
  );
}

function PersonalStep({ v, setV, set }) {
  return (
    <div className="space-y-4">
      <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input py-2.5 text-base" autoComplete="name" value={v.fullName} onChange={set("fullName")} /></div>
      <div><span className="label">Gender</span><Chips options={GENDERS} value={v.gender} onChange={(g) => setV({ ...v, gender: g })} /></div>
      <div><label className="label" htmlFor="dob">Date of birth</label><input id="dob" type="date" max={today()} className="input py-2.5 text-base" value={v.dateOfBirth} onChange={set("dateOfBirth")} /></div>
      <div><span className="label">Blood group (optional)</span><Chips options={BLOOD_GROUPS} value={v.bloodGroup} onChange={(g) => setV({ ...v, bloodGroup: v.bloodGroup === g ? "" : g })} /></div>
    </div>
  );
}

function ContactStep({ v, set }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label">Email (optional)</label><input className="input" type="email" autoComplete="email" value={v.email} onChange={set("email")} /></div>
      <div><label className="label">Department</label><input className="input" value={v.department} onChange={set("department")} /></div>
      <div><label className="label">Designation</label><input className="input" value={v.designation} onChange={set("designation")} /></div>
      <div><label className="label">Aadhaar last 4 digits</label><input className="input" inputMode="numeric" maxLength={4} value={v.aadhaarLast4} onChange={(e) => set("aadhaarLast4")({ target: { value: e.target.value.replace(/\D/g, "") } })} /></div>
      <div className="sm:col-span-2"><label className="label">Address</label><textarea className="input" rows={2} value={v.address} onChange={set("address")} /></div>
      <div><label className="label">Emergency contact name</label><input className="input" value={v.emergencyName} onChange={set("emergencyName")} /></div>
      <div><label className="label">Emergency contact mobile</label><input className="input" inputMode="numeric" maxLength={10} value={v.emergencyMobile} onChange={(e) => set("emergencyMobile")({ target: { value: e.target.value.replace(/\D/g, "") } })} /></div>
    </div>
  );
}

function VerifyStep({ v, setV, onDone }) {
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [dev, setDev] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setBusy(true); setError("");
    try {
      const r = await api("/api/auth/register/otp", { method: "POST", data: { mobile: v.mobile } });
      setSent(true); setWait(r.resendAfter || 30); setDev(r.dev);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const register = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { companyName, ...rest } = v;
    void companyName;
    const data = Object.fromEntries(Object.entries(rest).map(([k, x]) => [k, x === "" ? null : x]));
    try {
      const r = await api("/api/auth/register", { method: "POST", data: { ...data, otp, consent } });
      onDone();
      setTimeout(() => { window.location.href = r.redirect || "/patient"; }, 1800);
    } catch (err) { setError(err.message); setOtp(""); setBusy(false); }
  };

  return (
    <form onSubmit={register} className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
        <div className="font-medium text-slate-900">{v.fullName}</div>
        <div className="text-slate-500">{v.companyName} · Emp ID {v.employeeCode}</div>
      </div>
      <div>
        <label className="label" htmlFor="rmobile">Your mobile number (you will log in with it)</label>
        <div className="flex gap-2">
          <div className="flex flex-1 rounded-lg focus-within:ring-4 focus-within:ring-brand-600/15">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
            <input id="rmobile" className="input rounded-l-none py-2.5 text-base focus:ring-0" inputMode="numeric" maxLength={10} disabled={sent} value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value.replace(/\D/g, "") })} />
          </div>
          {sent ? (
            <button type="button" className="btn-secondary" onClick={() => { setSent(false); setOtp(""); }}>Change</button>
          ) : (
            <button type="button" className="btn-primary" disabled={busy || !/^[6-9]\d{9}$/.test(v.mobile)} onClick={send}>{busy ? <Spinner /> : "Send OTP"}</button>
          )}
        </div>
      </div>
      {sent && (
        <div className="animate-fade-up space-y-4">
          <div>
            <span className="label">Enter the 6-digit code</span>
            <OtpInput value={otp} onChange={(x) => { setOtp(x); setError(""); }} autoFocus error={Boolean(error)} disabled={busy} />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{dev ? "Development mode: use DEV_OTP from .env." : "Valid for 5 minutes."}</span>
              <button type="button" className="link disabled:text-slate-400 disabled:no-underline" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : "Resend"}</button>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="text-slate-600">I agree that SUSALI may use my personal and health details only to manage my hospital referrals, under the Digital Personal Data Protection Act, 2023. My Cluster Manager sees referral status but not my medical documents.</span>
          </label>
          <button className="btn-primary w-full py-2.5" disabled={busy || otp.length !== 6 || !consent}>{busy ? <Spinner /> : null}{busy ? "Registering…" : "Verify and register"}</button>
        </div>
      )}
      {error && <p className="animate-scale-in rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
    </form>
  );
}

function Success() {
  return (
    <div className="animate-scale-in py-8 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-50 ring-8 ring-brand-50/50">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0b4633" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path className="animate-draw" d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h2 className="mt-5 text-xl font-semibold">You&apos;re registered!</h2>
      <p className="mt-2 text-sm text-slate-500">Your Cluster Manager has been notified and will approve your account shortly. Taking you to your app…</p>
    </div>
  );
}
