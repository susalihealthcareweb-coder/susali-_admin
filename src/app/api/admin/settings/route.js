import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getSettings, saveSettings, getTemplateOverrides, saveTemplateOverrides } from "@/lib/settings";
import { EVENTS } from "@/lib/notify";
import { audit } from "@/lib/audit";

const num = (min, max) => z.coerce.number().min(min).max(max);

export const GET = route(async () => {
  await requireApi(["SUPER_ADMIN"]);
  const templates = await getTemplateOverrides();
  return ok({
    settings: await getSettings(),
    templates: Object.fromEntries(Object.entries(EVENTS).map(([k, e]) => [k, { label: e.label, defaultTemplate: e.template, ...(templates[k] || {}) }])),
  });
});

export const PUT = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  const input = await body(req, z.object({
    settings: z.object({
      submittedLimitWorkingHours: num(1, 72),
      forwardedLimitHours: num(1, 720),
      acceptedLimitHours: num(1, 720),
      visitedLimitDays: num(1, 90),
      followUpForwardedHours: num(1, 720),
      autoCloseDays: num(1, 90),
      maxFileMb: num(1, 100),
      workdayStartHour: num(0, 23),
      workdayEndHour: num(1, 24),
    }),
    templates: z.record(z.string(), z.object({ whatsappTemplate: z.string().trim().max(100).optional(), emailSubject: z.string().trim().max(200).optional() })).optional(),
  }));
  const before = await getSettings();
  await saveSettings({ ...before, ...input.settings });
  if (input.templates) {
    const clean = Object.fromEntries(Object.entries(input.templates).filter(([k]) => EVENTS[k]).map(([k, t]) => [k, { whatsappTemplate: t.whatsappTemplate || undefined, emailSubject: t.emailSubject || undefined }]));
    await saveTemplateOverrides(clean);
  }
  await audit({ actor: me, action: "SETTINGS_UPDATE", entity: "Setting", entityId: "system", before, after: input, req });
  return ok({ ok: true });
});
