// MSG91 OTP and WhatsApp. Without MSG91_AUTH_KEY, development mode simulates
// sends and accepts DEV_OTP; production refuses to run without a key.

const KEY = () => process.env.MSG91_AUTH_KEY;
const isDev = () => process.env.NODE_ENV !== "production";
export const msg91Configured = () => Boolean(KEY());

const intl = (mobile) => (String(mobile).length === 10 ? "91" + mobile : String(mobile));

export async function msg91SendOtp(mobile) {
  if (!KEY()) {
    if (isDev()) {
      console.log(`[dev] OTP for ${mobile}: ${process.env.DEV_OTP || "123456"}`);
      return;
    }
    throw new Error("MSG91 is not configured");
  }
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", process.env.MSG91_OTP_TEMPLATE_ID || "");
  url.searchParams.set("mobile", intl(mobile));
  url.searchParams.set("otp_length", "6");
  url.searchParams.set("otp_expiry", "5");
  const res = await fetch(url, { method: "POST", headers: { authkey: KEY(), "content-type": "application/json" }, body: "{}" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.type === "error") throw new Error(json.message || "OTP send failed");
}

export async function msg91VerifyOtp(mobile, otp) {
  if (!KEY()) {
    return isDev() && otp === (process.env.DEV_OTP || "123456");
  }
  const url = new URL("https://control.msg91.com/api/v5/otp/verify");
  url.searchParams.set("otp", otp);
  url.searchParams.set("mobile", intl(mobile));
  const res = await fetch(url, { headers: { authkey: KEY() } });
  const json = await res.json().catch(() => ({}));
  return json.type === "success";
}

// Sends one approved WhatsApp template. Returns a provider reference.
export async function msg91SendWhatsApp({ to, templateName, variables = [] }) {
  if (!KEY()) {
    if (isDev()) {
      console.log(`[dev] WhatsApp to ${to} (${templateName}):`, variables.join(" | "));
      return "simulated";
    }
    throw new Error("MSG91 is not configured");
  }
  const components = {};
  variables.forEach((v, i) => {
    components[`body_${i + 1}`] = { type: "text", value: String(v ?? "") };
  });
  const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
    method: "POST",
    headers: { authkey: KEY(), "content-type": "application/json" },
    body: JSON.stringify({
      integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: { code: "en", policy: "deterministic" },
          to_and_components: [{ to: [intl(to)], components }],
        },
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === "fail" || json.hasError) {
    throw new Error(json.errors || json.message || `WhatsApp send failed (${res.status})`);
  }
  return json.request_id || json.data?.request_id || "sent";
}
