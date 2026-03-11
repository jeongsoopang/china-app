import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/reports", label: "Reports" },
  { href: "/moderation", label: "Moderation" },
  { href: "/announcements", label: "Announcements" },
  { href: "/universities", label: "Universities" },
  { href: "/audit", label: "Audit" }
] as const;

export default function AdminSectionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
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
