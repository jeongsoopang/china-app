import Link from "next/link";
import { PUBLIC_SITE } from "../config/public-site";
import { PUBLIC_LANG_LABELS, type PublicLang } from "./public-pages-content";

type PublicPageShellProps = {
  title: string;
  description?: string;
  lastUpdatedLabel?: string;
  currentLang: PublicLang;
  pathname: string;
  children: React.ReactNode;
};

export function PublicPageShell(props: PublicPageShellProps) {
  const { title, description, lastUpdatedLabel, currentLang, pathname, children } = props;

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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem"
            }}
          >
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{PUBLIC_SITE.siteName}</p>
            <div
              aria-label="language toggle"
              style={{
                display: "inline-flex",
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                overflow: "hidden"
              }}
            >
              {(["ko", "en"] as const).map((lang) => {
                const active = lang === currentLang;
                return (
                  <Link
                    key={lang}
                    href={`${pathname}?lang=${lang}`}
                    style={{
                      padding: "0.35rem 0.65rem",
                      fontSize: 12,
                      textDecoration: "none",
                      color: active ? "#ffffff" : "#334155",
                      background: active ? "#0f172a" : "#ffffff",
                      fontWeight: 600
                    }}
                  >
                    {PUBLIC_LANG_LABELS[lang]}
                  </Link>
                );
              })}
            </div>
          </div>

          <h1 style={{ margin: 0 }}>{title}</h1>
          {lastUpdatedLabel ? (
            <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>{lastUpdatedLabel}</p>
          ) : null}
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
