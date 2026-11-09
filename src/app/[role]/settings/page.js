import { staffPage } from "@/lib/page";
import { getSettings, getTemplateOverrides } from "@/lib/settings";
import { EVENTS } from "@/lib/notify";
import { PageHeader } from "@/components/ui";
import SettingsForm from "@/components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function Settings({ params }) {
  await staffPage(params, ["SUPER_ADMIN"]);
  const [settings, overrides] = await Promise.all([getSettings(), getTemplateOverrides()]);
  const templates = Object.entries(EVENTS).map(([k, e]) => ({ key: k, label: e.label, defaultTemplate: e.template, whatsappTemplate: overrides[k]?.whatsappTemplate || "", emailSubject: overrides[k]?.emailSubject || "" }));
  return (
    <>
      <PageHeader title="System settings" subtitle="Time limits, file limits and notification templates." />
      <SettingsForm settings={settings} templates={templates} />
    </>
  );
}
