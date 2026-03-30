import type { Metadata } from "next";
import { PUBLIC_SITE } from "../../config/public-site";
import {
  PUBLIC_PAGES_CONTENT,
  normalizePublicLang,
  type PublicSection
} from "../public-pages-content";
import { PublicPageShell } from "../public-page-shell";

export const metadata: Metadata = {
  title: `계정 삭제 안내 | ${PUBLIC_SITE.siteName}`,
  description: `Delete account information for ${PUBLIC_SITE.siteName}`
};

type DeleteAccountPageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

function renderSection(section: PublicSection, index: number) {
  const HeadingTag = section.level === 3 ? "h3" : "h2";

  return (
    <section key={`${section.heading}-${index}`} style={{ display: "grid", gap: "0.5rem" }}>
      <HeadingTag style={{ margin: 0 }}>{section.heading}</HeadingTag>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} style={{ margin: 0 }}>
          {paragraph}
        </p>
      ))}
      {section.bullets ? (
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.35rem" }}>
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default async function DeleteAccountPage({ searchParams }: DeleteAccountPageProps) {
  const params = (await searchParams) ?? {};
  const lang = normalizePublicLang(params.lang);
  const content = PUBLIC_PAGES_CONTENT.deleteAccount[lang];

  return (
    <PublicPageShell
      title={content.title}
      lastUpdatedLabel={content.lastUpdatedLabel}
      currentLang={lang}
      pathname="/delete-account"
    >
      {content.introParagraphs.map((paragraph) => (
        <p key={paragraph} style={{ margin: 0 }}>
          {paragraph}
        </p>
      ))}
      {content.sections.map(renderSection)}
    </PublicPageShell>
  );
}
