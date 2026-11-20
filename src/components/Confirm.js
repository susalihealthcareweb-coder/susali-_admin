"use client";
import { useEffect, useState } from "react";
import Dialog from "./Dialog";

// Styled replacement for the browser's confirm() and prompt(), usable anywhere
// on the client:
//   if (!(await ask({ title: "Remove file?", message: "…", confirmLabel: "Remove", danger: true }))) return;
//   const reason = await ask({ title: "Cancel referral?", input: "Reason (optional)" }); // false = cancelled, else the text
export function ask(options) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("susali-confirm", { detail: { ...options, resolve } }));
  });
}

export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [text, setText] = useState("");
  useEffect(() => {
    const on = (e) => { setText(""); setReq(e.detail); };
    window.addEventListener("susali-confirm", on);
    return () => window.removeEventListener("susali-confirm", on);
  }, []);
  const finish = (value) => {
    req?.resolve(value);
    setReq(null);
  };
  return (
    <Dialog
      open={Boolean(req)}
      onClose={() => finish(false)}
      title={req?.title || "Are you sure?"}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => finish(false)}>{req?.cancelLabel || "Back"}</button>
          <button type="button" className={req?.danger ? "btn-danger" : "btn-primary"} onClick={() => finish(req?.input ? text.trim() : true)}>{req?.confirmLabel || "Confirm"}</button>
        </>
      }
    >
      {req?.message && <p className="text-sm text-slate-600">{req.message}</p>}
      {req?.input && (
        <div className={req?.message ? "mt-3" : ""}>
          <label className="label" htmlFor="confirm-input">{req.input}</label>
          <textarea id="confirm-input" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
      )}
    </Dialog>
  );
}
