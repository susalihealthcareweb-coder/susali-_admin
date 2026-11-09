"use client";
import { toast } from "./Toaster";

// fetch wrapper: JSON in/out, throws Error(message) on failure.
export async function api(url, { method = "GET", data, form } = {}) {
  const res = await fetch(url, {
    method,
    headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: form || (data !== undefined ? JSON.stringify(data) : undefined),
  });
  let json = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Runs an API call with toasts; returns the result or null.
export async function run(fn, success) {
  try {
    const r = await fn();
    if (success) toast(success);
    return r ?? true;
  } catch (e) {
    toast(e.message, "error");
    return null;
  }
}

// Uploads one file to storage through a signed URL, then returns the key.
export async function uploadFile(file, signBody) {
  const sign = await api("/api/uploads/sign", { method: "POST", data: { ...signBody, fileName: file.name, mimeType: file.type || guessType(file.name), size: file.size } });
  const res = await fetch(sign.url, { method: sign.method, headers: sign.headers, body: file });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  return sign.key;
}

export function guessType(name) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}
