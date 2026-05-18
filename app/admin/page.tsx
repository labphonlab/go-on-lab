import { requireAdmin } from "@/app/lib/admin-guard";
import { ensureDefaultDesign, listDesigns } from "@/app/lib/design-store";
import { AdminHome } from "./AdminHome";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  await ensureDefaultDesign();
  const designs = await listDesigns();
  return <AdminHome initialDesigns={designs} />;
}
