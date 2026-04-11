import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

export default async function AuthLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("gm06_session")?.value;
  if (!token) redirect("/login");

  const user = verifyToken(token);
  if (!user) redirect("/login");

  return <AuthShell user={user}>{children}</AuthShell>;
}
