import { AdminConsole } from "@/components/admin/admin-console";
import { pageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await pageAccess();
  return <AdminConsole label={access?.label ?? "admin"} />;
}
