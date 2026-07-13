import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { listInvitations } from "@/lib/invitations";
import { getSettings } from "@/lib/settings";
import { Dashboard } from "./dashboard";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Tansu & Arda",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <LoginForm />;
  }
  const [invitations, settings] = await Promise.all([listInvitations(), getSettings()]);
  return <Dashboard invitations={invitations} settings={settings} />;
}
