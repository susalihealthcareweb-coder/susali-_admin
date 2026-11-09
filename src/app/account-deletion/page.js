import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Delete your account" };

const CONTACT = process.env.PRIVACY_CONTACT_EMAIL || "privacy@susali.in";

// Public page for the Play Store "account deletion" requirement.
export default function AccountDeletion() {
  return (
    <LegalPage title="Delete your SUSALI account" updated="9 November 2026">
      <h2 className="font-display text-2xl font-bold text-brand-900">In the app</h2>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Open the SUSALI app and log in.</li>
        <li>Go to <b>Profile</b> (employees) or the <b>Home</b> screen menu (Cluster Managers).</li>
        <li>Tap <b>Delete my account</b> and confirm.</li>
      </ol>
      <h2 className="font-display text-2xl font-bold text-brand-900">Without the app</h2>
      <p>Email <a className="link" href={`mailto:${CONTACT}?subject=Delete%20my%20SUSALI%20account`}>{CONTACT}</a> from the email on your account, or ask your Cluster Manager, with your name, company and registered mobile number.</p>
      <h2 className="font-display text-2xl font-bold text-brand-900">What happens next</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>We confirm the request and delete your account within 30 days.</li>
        <li>Deleted: your login, profile, family members, contact details and uploaded photos.</li>
        <li>Kept only where the law requires it (for example hospital treatment records), and then anonymised so they are no longer linked to you.</li>
        <li>Your employer&apos;s record that you were an employee is not part of SUSALI and is not affected.</li>
      </ul>
    </LegalPage>
  );
}
