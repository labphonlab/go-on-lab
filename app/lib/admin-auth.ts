import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT_DIR } from "./design-store";

const SECRET_PATH = path.join(ROOT_DIR, ".admin-secret");
const SESSION_TTL_SEC = 60 * 60 * 12;
const COOKIE_NAME = "go_admin";

let cachedSecret: string | null = null;

async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 32) {
    cachedSecret = process.env.ADMIN_SECRET;
    return cachedSecret;
  }
  try {
    const s = await fs.readFile(SECRET_PATH, "utf8");
    if (s.length >= 32) {
      cachedSecret = s;
      return cachedSecret;
    }
  } catch {
    /* fall through */
  }
  const buf = crypto.randomBytes(48);
  const fresh = buf.toString("hex");
  await fs.mkdir(ROOT_DIR, { recursive: true });
  await fs.writeFile(SECRET_PATH, fresh, { encoding: "utf8", mode: 0o600 });
  cachedSecret = fresh;
  return fresh;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 6,
  );
}

export function verifyAdminPassword(input: string): boolean {
  if (!adminConfigured()) return false;
  return timingSafeEqualStr(input, process.env.ADMIN_PASSWORD as string);
}

async function sign(payload: string): Promise<string> {
  const secret = await getSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export async function issueSessionCookieValue(): Promise<{
  value: string;
  maxAge: number;
}> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const nonce = crypto.randomBytes(8).toString("base64url");
  const payload = `${expires}.${nonce}`;
  const sig = await sign(payload);
  return { value: `${payload}.${sig}`, maxAge: SESSION_TTL_SEC };
}

export async function verifyCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!/^\d+$/.test(exp)) return false;
  const expNum = Number(exp);
  if (expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(`${exp}.${nonce}`);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = parseCookie(cookieHeader, COOKIE_NAME);
  return verifyCookieValue(cookie);
}

function parseCookie(header: string, name: string): string | undefined {
  const parts = header.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export { COOKIE_NAME, SESSION_TTL_SEC };
