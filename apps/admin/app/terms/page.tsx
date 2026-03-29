import type { Metadata } from "next";
import { PUBLIC_SITE } from "../../config/public-site";
import { PublicPageShell } from "../public-page-shell";

export const metadata: Metadata = {
  title: `Terms of Service | ${PUBLIC_SITE.siteName}`,
  description: `Terms of Service for ${PUBLIC_SITE.siteName}`
};

export default function TermsPage() {
  return (
    <PublicPageShell
      title="Terms of Service"
      description="By using LUCL, you agree to these basic service terms."
    >
      <section>
        <h2>Acceptable Use</h2>
        <p>
          You may use LUCL to participate in community discussions, share content, and interact
          with other users in a lawful and respectful way.
        </p>
      </section>

      <section>
        <h2>Prohibited Behavior</h2>
        <ul>
          <li>Harassment, hate speech, threats, or abusive conduct.</li>
          <li>Spam, fraud, impersonation, or misleading content.</li>
          <li>Unauthorized access attempts or service disruption.</li>
          <li>Posting content that violates law or third-party rights.</li>
        </ul>
      </section>

      <section>
        <h2>Account and Content Responsibility</h2>
        <p>
          You are responsible for activity on your account and for content you post. Keep your
          account credentials secure and avoid sharing access with others.
        </p>
      </section>

      <section>
        <h2>Moderation and Enforcement</h2>
        <p>
          LUCL may review reports and apply moderation actions, including content limitation,
          removal, or account restrictions, when necessary for safety and policy enforcement.
        </p>
      </section>

      <section>
        <h2>Service Changes</h2>
        <p>
          Features may be modified, suspended, or discontinued at any time to improve service,
          address safety concerns, or meet legal obligations.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href={`mailto:${PUBLIC_SITE.supportEmail}`}>{PUBLIC_SITE.supportEmail}</a>.
        </p>
      </section>
    </PublicPageShell>
  );
}

