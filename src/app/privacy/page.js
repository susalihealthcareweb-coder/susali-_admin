import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Privacy policy" };

const CONTACT = process.env.PRIVACY_CONTACT_EMAIL || "privacy@susali.in";

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="9 November 2026">
      <p>SUSALI Healthcare (&ldquo;SUSALI&rdquo;, &ldquo;we&rdquo;) runs the SUSALI website and the SUSALI mobile app. They help company employees and their families move from a dispensary referral to hospital treatment and back. This policy explains what personal data we collect, why, who sees it, and your rights under India&apos;s Digital Personal Data Protection Act, 2023.</p>

      <h2 className="font-display text-2xl font-bold text-brand-900">What we collect</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><b>Employee details</b> provided by your employer&apos;s Cluster Manager or by you when you register: name, employee ID, company, mobile number, email, gender, date of birth, blood group, department, designation, address, emergency contact and the last 4 digits of Aadhaar (optional).</li>
        <li><b>Family members</b> you add to your card: name, relation, gender, date of birth, blood group and an optional mobile number. If you add a child, you confirm you are their parent or guardian.</li>
        <li><b>Referral and health information</b>: dispensary and superintendent hospital details, referral letter number, hospital and department, the reason for referral, visit and treatment details, and documents such as referral letters, prescriptions, lab reports and scans.</li>
        <li><b>Photos and files</b> you choose to upload with the camera or from your device.</li>
        <li><b>Location</b>, only for Cluster Managers, and only when they log a company visit.</li>
        <li><b>Technical data</b>: login times, IP address and device type, kept in our audit log to protect your account.</li>
      </ul>

      <h2 className="font-display text-2xl font-bold text-brand-900">Why we use it</h2>
      <p>Only to manage hospital referrals: to verify a referral, send it to the right hospital, let the hospital record your visit and upload your reports, show you the progress and your records, and send you updates by WhatsApp, SMS and email. We do not sell your data and we do not use it for advertising.</p>

      <h2 className="font-display text-2xl font-bold text-brand-900">Who can see it</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><b>You</b>: your own profile, family, referrals and documents.</li>
        <li><b>SUSALI verification team and administrators</b>: to verify and manage referrals.</li>
        <li><b>The hospital</b> a referral is forwarded to: only that referral, from the moment it is forwarded.</li>
        <li><b>Your Cluster Manager</b>: your employee profile and the status of your referrals, but not your medical documents or diagnosis.</li>
        <li><b>Service providers</b> who process data for us: cloud hosting and database, file storage, and messaging (MSG91 for WhatsApp and SMS, an email provider). They may use it only to provide their service to us.</li>
      </ul>
      <p>Every view or download of a medical document is recorded.</p>

      <h2 className="font-display text-2xl font-bold text-brand-900">Security and retention</h2>
      <p>Data is sent over encrypted connections and stored in access-controlled databases and private file storage. Documents open only through links that expire after 10 minutes. We keep referral records for as long as needed to provide the service and to meet legal and medical record-keeping duties, then delete or anonymise them.</p>

      <h2 className="font-display text-2xl font-bold text-brand-900">Your rights</h2>
      <p>You can see and correct your details in the app, withdraw consent, and ask us to delete your account and personal data. See <Link className="link" href="/account-deletion">how to delete your account</Link>. You can also ask for a summary of the data we hold about you, or raise a complaint with our Grievance Officer at <a className="link" href={`mailto:${CONTACT}`}>{CONTACT}</a>. If you are not satisfied, you may complain to the Data Protection Board of India.</p>

      <h2 className="font-display text-2xl font-bold text-brand-900">Contact</h2>
      <p>SUSALI Healthcare · Grievance Officer · <a className="link" href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </LegalPage>
  );
}
