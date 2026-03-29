import { PUBLIC_SITE } from "../config/public-site";

type PublicPageShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function PublicPageShell(props: PublicPageShellProps) {
  const { title, description, children } = props;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "24px 16px"
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto"
        }}
      >
        <section
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            background: "#ffffff",
            padding: "1.25rem",
            display: "grid",
            gap: "0.75rem"
          }}
        >
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{PUBLIC_SITE.siteName}</p>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {description ? <p style={{ margin: 0 }}>{description}</p> : null}
        </section>

        <section
          style={{
            marginTop: "1rem",
            border: "1px solid #d1d5db",
            borderRadius: 12,
            background: "#ffffff",
            padding: "1.25rem",
            display: "grid",
            gap: "1rem"
          }}
        >
          {children}
        </section>
      </div>
    </main>
  );
}
