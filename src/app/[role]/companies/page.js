import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { staffPage, qs } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { PageHeader, Pagination, Empty, Badge } from "@/components/ui";
import SearchBar from "@/components/SearchBar";

export const metadata = { title: "Companies" };

export default async function Companies({ params, searchParams }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where = { AND: [companyScope(me), q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {}] };
  const [rows, total] = await Promise.all([
    prisma.company.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20, include: { cluster: { select: { name: true } }, _count: { select: { employees: true } } } }),
    prisma.company.count({ where }),
  ]);
  const canAdd = ["SUPER_ADMIN", "SUDO_ADMIN"].includes(role);
  return (
    <>
      <PageHeader title="Companies" subtitle={`${total} ${total === 1 ? "company" : "companies"}`} actions={canAdd && <Link href={`${base}/companies/new`} className="btn-primary">Add company</Link>} />
      <div className="mb-4"><SearchBar placeholder="Name, code or city" /></div>
      {rows.length ? (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((c) => (
              <Link key={c.id} href={`${base}/companies/${c.id}`} className="lift card card-pad block">
                <div className="flex items-start justify-between gap-2"><div className="font-medium">{c.name}</div>{!c.isActive && <Badge tone="red">Inactive</Badge>}</div>
                <div className="text-xs text-slate-500">{c.code} · {c.city} · {c._count.employees} employees</div>
              </Link>
            ))}
          </div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="table">
              <thead><tr><th>Company</th><th>Code</th><th>City</th><th>Cluster</th><th>Employees</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="link" href={`${base}/companies/${c.id}`}>{c.name}</Link><div className="text-xs text-slate-500">{c.industry}</div></td>
                    <td className="font-mono text-xs">{c.code}</td>
                    <td>{c.city}</td>
                    <td>{c.cluster?.name}</td>
                    <td className="tabular-nums">{c._count.employees}</td>
                    <td>{c.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <Empty title="No companies yet">{canAdd ? "Add the first company you visit." : null}</Empty>}
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / 20))} makeHref={(p) => `${base}/companies${qs(sp, { page: p })}`} />
    </>
  );
}
