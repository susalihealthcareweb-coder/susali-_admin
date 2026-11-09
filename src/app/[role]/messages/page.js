import { prisma } from "@/lib/prisma";
import { staffPage, qs } from "@/lib/page";
import { PageHeader, Badge, Pagination, Tabs } from "@/components/ui";
import RetryButton from "@/components/RetryButton";
import { fmtDateTime } from "@/lib/format";
import { msg91Configured } from "@/lib/msg91";
import { smtpConfigured } from "@/lib/mailer";

export const metadata = { title: "Message health" };

const TONE = { QUEUED: "blue", SENT: "green", DELIVERED: "green", FAILED: "red" };

// WhatsApp and email send log with manual retry for failures.
export default async function Messages({ params, searchParams }) {
  const { base } = await staffPage(params, ["SUPER_ADMIN"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ["QUEUED", "SENT", "FAILED"].includes(sp.status) ? sp.status : null;
  const where = { channel: { in: ["WHATSAPP", "EMAIL"] }, ...(status ? { status } : {}) };
  const [rows, total, counts] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
    prisma.notification.count({ where }),
    prisma.notification.groupBy({ by: ["status"], where: { channel: { in: ["WHATSAPP", "EMAIL"] } }, _count: { _all: true } }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all]));
  return (
    <>
      <PageHeader title="Message health" subtitle="WhatsApp (MSG91) and email (SMTP) deliveries. Failed sends retry at 1, 5 and 15 minutes." />
      {(!msg91Configured() || !smtpConfigured()) && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {!msg91Configured() && "MSG91 is not configured, so WhatsApp and OTP are simulated in development. "}
          {!smtpConfigured() && "SMTP is not configured, so emails are simulated in development."}
        </div>
      )}
      <Tabs active={status || "all"} tabs={[{ key: "all", label: "All", href: `${base}/messages` }, ...["QUEUED", "SENT", "FAILED"].map((s) => ({ key: s, label: s[0] + s.slice(1).toLowerCase(), count: c[s] || 0, href: `${base}/messages?status=${s}` }))]} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Event</th><th>Channel</th><th>To</th><th>Status</th><th>Tries</th><th>Error</th><th></th></tr></thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(n.createdAt)}</td>
                <td className="text-xs">{n.event}<div className="text-slate-500">{n.templateName}</div></td>
                <td className="text-xs">{n.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</td>
                <td className="font-mono text-xs">{n.recipient}</td>
                <td><Badge tone={TONE[n.status]}>{n.status}</Badge>{n.providerRef === "simulated" && <div className="text-[10px] text-slate-400">simulated</div>}</td>
                <td className="tabular-nums">{n.attempts}</td>
                <td className="max-w-xs truncate text-xs text-red-700" title={n.error || ""}>{n.error}</td>
                <td>{n.status === "FAILED" && <RetryButton id={n.id} />}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-slate-500">No messages.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / 50))} makeHref={(p) => `${base}/messages${qs(sp, { page: p })}`} />
    </>
  );
}
