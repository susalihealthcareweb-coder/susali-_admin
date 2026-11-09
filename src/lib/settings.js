import { prisma } from "./prisma";

// Defaults; Super Admin can override each value from the Settings page.
export const DEFAULT_SETTINGS = {
  submittedLimitWorkingHours: 4,
  forwardedLimitHours: 24,
  acceptedLimitHours: 72,
  visitedLimitDays: 7,
  followUpForwardedHours: 48,
  autoCloseDays: 7,
  maxFileMb: 20,
  workdayStartHour: 9,
  workdayEndHour: 18,
  workingDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
};

export async function getSettings() {
  const row = await prisma.setting.findUnique({ where: { id: "system" } });
  return { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
}

export async function saveSettings(value) {
  return prisma.setting.upsert({
    where: { id: "system" },
    create: { id: "system", value },
    update: { value },
  });
}

export async function getTemplateOverrides() {
  const row = await prisma.setting.findUnique({ where: { id: "templates" } });
  return row?.value || {};
}

export async function saveTemplateOverrides(value) {
  return prisma.setting.upsert({
    where: { id: "templates" },
    create: { id: "templates", value },
    update: { value },
  });
}

// Hours inside the working window (IST) between two dates.
export function workingHoursBetween(start, end, s = DEFAULT_SETTINGS) {
  const IST = 5.5 * 3600 * 1000;
  let t = new Date(start).getTime() + IST;
  const stop = new Date(end).getTime() + IST;
  let ms = 0;
  while (t < stop) {
    const d = new Date(t);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), s.workdayStartHour);
    const dayEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), s.workdayEndHour);
    if (s.workingDays.includes(d.getUTCDay())) {
      const a = Math.max(t, dayStart);
      const b = Math.min(stop, dayEnd);
      if (b > a) ms += b - a;
    }
    t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  }
  return ms / 3600000;
}
