import {
  adminConfigured,
  COOKIE_NAME,
  issueSessionCookieValue,
  SESSION_TTL_SEC,
  verifyAdminPassword,
} from "@/app/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "ADMIN_PASSWORD environment variable is not set on the server.",
      },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const password =
    body && typeof body === "object" && "password" in (body as object)
      ? String((body as { password: unknown }).password ?? "")
      : "";
  if (!verifyAdminPassword(password)) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }
  const { value, maxAge } = await issueSessionCookieValue();
  const cookie = [
    `${COOKIE_NAME}=${value}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `HttpOnly`,
    `SameSite=Lax`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  return new Response(JSON.stringify({ ok: true, ttlSec: SESSION_TTL_SEC }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
