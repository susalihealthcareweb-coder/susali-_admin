import Icon from "./Icon";

export default function AwaitingApproval({ company }) {
  return (
    <div className="card card-pad animate-scale-in overflow-hidden text-center">
      <div className="relative mx-auto grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/60" />
        <span className="relative grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-700"><Icon name="clock" size={28} /></span>
      </div>
      <h2 className="mt-4 text-lg font-semibold">Waiting for approval</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">Your Cluster Manager for {company} has been notified. You can raise referrals as soon as they approve your registration. We&apos;ll send you a WhatsApp message.</p>
    </div>
  );
}
