import { NextResponse, after } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const ok = (data, init) => NextResponse.json(data, init);

// After a response is sent, run any background job that is due (no cron needed).
function scheduleDueJobs() {
  if (process.env.BACKGROUND_JOBS === "off") return;
  try {
    after(async () => (await import("./jobs")).runDueJobs());
  } catch {
    // Outside a request (scripts): nothing to schedule.
  }
}

// Wraps a route handler so thrown ApiError / ZodError become JSON responses.
export function route(fn) {
  return async (req, ctx) => {
    try {
      const params = ctx?.params ? await ctx.params : {};
      const res = await fn(req, params);
      scheduleDueJobs();
      return res;
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const msg = first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input";
        return NextResponse.json({ error: msg, details: e.issues }, { status: 400 });
      }
      if (e?.code === "P2002") {
        return NextResponse.json({ error: "A record with this value already exists." }, { status: 409 });
      }
      if (e?.code === "P2025") {
        return NextResponse.json({ error: "Record not found." }, { status: 404 });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}

export async function body(req, schema) {
  let data;
  try {
    data = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON.");
  }
  return schema.parse(data);
}

export function pageParams(url, size = 20) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  return { page, take: size, skip: (page - 1) * size };
}
