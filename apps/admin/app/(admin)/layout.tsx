import Link from "next/link";
import { redirect } from "next/navigation";
import { getGrandMasterAccessState } from "../../lib/auth/grandmaster";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/reports", label: "Reports" },
  { href: "/moderation", label: "Moderation" },
  { href: "/announcements", label: "Announcements" },
  { href: "/universities", label: "Universities" },
  { href: "/audit", label: "Audit" }
] as const;

export default async function AdminSectionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const accessState = await getGrandMasterAccessState();

  if (accessState.status !== "allow") {
    if (accessState.reason === "not_signed_in") {
      redirect("/login");
    }

    redirect("/access-denied");
  }

  return (
    <main>
      <h1>ForYou Admin</h1>
      <nav aria-label="Admin Navigation">
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </main>
  );
}
