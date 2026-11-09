// Preset referral lists linked from dashboards (?view=… or ?ids=…).
export function viewFilter(sp, me, s) {
  const now = Date.now();
  if (sp.view === "mine") return { title: "Locked by me", extra: { status: "UNDER_VERIFICATION", lockedById: me.id } };
  if (sp.view === "follow-forward")
    return { title: `Follow-up: not visited within ${s.followUpForwardedHours} hours`, extra: { status: { in: ["FORWARDED", "ACCEPTED"] }, forwardedAt: { lt: new Date(now - s.followUpForwardedHours * 3600000) } } };
  if (sp.view === "follow-visit")
    return { title: `Follow-up: not completed within ${s.visitedLimitDays} days`, extra: { status: { in: ["VISITED", "UNDER_TREATMENT"] }, visitedAt: { lt: new Date(now - s.visitedLimitDays * 86400000) } } };
  if (sp.view === "escalated")
    return { title: "Escalated referrals", extra: { escalations: { isEmpty: false }, status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED", "REJECTED"] } } };
  if (sp.ids) return { title: "Referrals past their time limit", extra: { id: { in: String(sp.ids).split(",").filter((x) => /^[a-f0-9]{24}$/.test(x)) } } };
  return { title: "Referrals" };
}
