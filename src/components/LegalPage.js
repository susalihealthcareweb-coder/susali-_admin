import Link from "next/link";
import { Brand, Waves } from "./Brand";

// Simple public page layout for policies (linked from the apps and stores).
export default function LegalPage({ title, updated, children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#faf6ef]">
      <Waves className="absolute left-0 top-0 h-32 w-[70%] sm:w-[45%]" />
      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6">
        <Link href="/" className="mb-6 inline-block"><Brand size={36} /></Link>
        <h1 className="text-4xl text-brand-900">{title}</h1>
        {updated && <p className="mt-1 text-sm text-slate-500">Last updated {updated}</p>}
        <div className="gold-rule mt-4 w-24" />
        <article className="legal mt-8 space-y-5 text-[15px] leading-7 text-slate-700">{children}</article>
        <p className="mt-12 text-sm text-slate-500">
          <Link className="link" href="/privacy">Privacy policy</Link> · <Link className="link" href="/account-deletion">Delete your account</Link> · <Link className="link" href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
