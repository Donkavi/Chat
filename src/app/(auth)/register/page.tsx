import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/current-user";
import { RegisterForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/discover");
  return <RegisterForm />;
}
