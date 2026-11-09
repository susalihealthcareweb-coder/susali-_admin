import { notFound } from "next/navigation";
import { requirePage } from "./session";
import { roleFromSlug, ROLES } from "./constants";

// For pages under /[role]/…: checks the slug matches the signed-in role and
// that the role may open this page.
export async function staffPage(params, allowed) {
  const { role: slug } = await params;
  const role = roleFromSlug(slug);
  if (!role || role === "PATIENT") notFound();
  const me = await requirePage([role]);
  if (allowed && !allowed.includes(role)) notFound();
  return { me, base: "/" + ROLES[role].slug, role };
}

export function qs(sp, patch) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) if (v != null && v !== "") p.set(k, Array.isArray(v) ? v[0] : v);
  for (const [k, v] of Object.entries(patch || {})) {
    if (v == null || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? "?" + s : "";
}
