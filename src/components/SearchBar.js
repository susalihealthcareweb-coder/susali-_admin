"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ placeholder = "Search…", param = "q" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get(param) || "");
  const submit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(sp);
    if (q) next.set(param, q); else next.delete(param);
    next.delete("page");
    router.push(`${pathname}?${next}`);
  };
  return (
    <form onSubmit={submit} className="flex w-full max-w-md gap-2">
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} type="search" />
      <button className="btn-secondary">Search</button>
    </form>
  );
}
