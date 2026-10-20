import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/current-user";
import { toMe } from "@/server/services/mappers";
import { AppProviders } from "@/components/providers/app-providers";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppProviders me={toMe(user)}>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
