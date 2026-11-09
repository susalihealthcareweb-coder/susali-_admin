// Allowed status transitions from section 3 of the spec.
// Every status route checks against this map and rejects any other jump.

export const TRANSITIONS = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_VERIFICATION", "CANCELLED"],
  UNDER_VERIFICATION: ["FORWARDED", "INFO_REQUESTED", "REJECTED", "SUBMITTED", "CANCELLED"],
  INFO_REQUESTED: ["SUBMITTED", "CANCELLED"],
  REJECTED: ["SUBMITTED"], // reopen by admin only
  FORWARDED: ["ACCEPTED", "HOSPITAL_DECLINED", "CANCELLED"],
  HOSPITAL_DECLINED: ["UNDER_VERIFICATION", "CANCELLED"],
  ACCEPTED: ["VISITED"],
  VISITED: ["UNDER_TREATMENT", "COMPLETED"],
  UNDER_TREATMENT: ["COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: ["COMPLETED"], // reopen by admin only
  CANCELLED: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

// A patient may cancel only before the hospital accepts.
export const PATIENT_CANCELLABLE = ["DRAFT", "SUBMITTED", "INFO_REQUESTED"];
export const STAFF_CANCELLABLE = ["SUBMITTED", "UNDER_VERIFICATION", "INFO_REQUESTED", "FORWARDED", "HOSPITAL_DECLINED"];
