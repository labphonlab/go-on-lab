import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME,
  adminConfigured,
  verifyCookieValue,
} from "./admin-auth";

function parseCookie(header: string, name: string): string | undefined {
  const parts = header.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function requireAdmin(): Promise<void> {
  if (!adminConfigured()) {
    redirect("/admin/login");
  }
  const h = await headers();
  const cookies = h.get("cookie") || "";
  const value = parseCookie(cookies, COOKIE_NAME);
  const ok = await verifyCookieValue(value);
  if (!ok) {
    redirect("/admin/login");
  }
}
