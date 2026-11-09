"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

const NUMS = [
  ["submittedLimitWorkingHours", "Escalate if Submitted longer than (working hours)"],
  ["forwardedLimitHours", "Escalate if Forwarded but not accepted after (hours)"],
  ["acceptedLimitHours", "Escalate if Accepted but not visited after (hours)"],
  ["visitedLimitDays", "Escalate if Visited but not completed after (days)"],
  ["followUpForwardedHours", "Support follow-up: forwarded but not visited after (hours)"],
  ["autoCloseDays", "Auto-close completed referrals after (days)"],
  ["maxFileMb", "Maximum upload size (MB)"],
  ["workdayStartHour", "Working day starts (hour, IST)"],
  ["workdayEndHour", "Working day ends (hour, IST)"],
];

export default function SettingsForm({ settings, templates }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [t, setT] = useState(templates);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const tpl = Object.fromEntries(t.map((x) => [x.key, { whatsappTemplate: x.whatsappTemplate, emailSubject: x.emailSubject }]));
    const ok = await run(() => api("/api/admin/settings", { method: "PUT", data: { settings: Object.fromEntries(NUMS.map(([k]) => [k, Number(s[k])])), templates: tpl } }), "Settings saved");
    setBusy(false);
    if (ok) router.refresh();
  };
  return (
    <form onSubmit={save} className="space-y-5">
      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-semibold">Time limits and files</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NUMS.map(([k, l]) => <div key={k}><label className="label">{l}</label><input type="number" className="input" min={0} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></div>)}
        </div>
        <p className="mt-2 text-xs text-slate-500">Working days are Monday to Saturday.</p>
      </section>
      <section className="card card-pad">
        <h2 className="mb-1 text-sm font-semibold">Notification templates</h2>
        <p className="mb-3 text-xs text-slate-500">WhatsApp messages use templates approved in MSG91. Leave blank to use the default name. Messages never include diagnosis or report contents.</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Event</th><th>MSG91 WhatsApp template</th><th>Email subject (use {"{{no}}"}, {"{{name}}"}, {"{{hospital}}"})</th></tr></thead>
            <tbody>
              {t.map((x, i) => (
                <tr key={x.key}>
                  <td className="text-sm font-medium">{x.label}</td>
                  <td><input className="input" placeholder={x.defaultTemplate} value={x.whatsappTemplate} onChange={(e) => setT(t.map((y, j) => (j === i ? { ...y, whatsappTemplate: e.target.value } : y)))} /></td>
                  <td><input className="input" placeholder="Default subject" value={x.emailSubject} onChange={(e) => setT(t.map((y, j) => (j === i ? { ...y, emailSubject: e.target.value } : y)))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
