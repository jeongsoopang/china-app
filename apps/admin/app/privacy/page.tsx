import type { Metadata } from "next";
import { PUBLIC_SITE } from "../../config/public-site";
import { PublicPageShell } from "../public-page-shell";

export const metadata: Metadata = {
  title: `Privacy Policy | ${PUBLIC_SITE.siteName}`,
  description: `Privacy Policy for ${PUBLIC_SITE.siteName}`
};

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Privacy Policy"
      description="This page explains what information LUCL currently handles and how it is used."
    >
      <section>
        <h2>Information We Collect</h2>
        <ul>
          <li>Account information: sign-in email and basic authentication identifiers.</li>
          <li>Profile information: display name, avatar/profile fields, and related settings.</li>
          <li>
            School verification information: school email and verification status/history when you
            use school verification.
          </li>
          <li>Community activity: posts, comments, reports, and moderation-related records.</li>
          <li>Uploaded content: images and other content you choose to upload in-app.</li>
          <li>
            Notification-related data: in-app notification records and related reference metadata.
          </li>
        </ul>
      </section>

      <section>
        <h2>How We Use Information</h2>
        <ul>
          <li>To provide account access and core community features.</li>
          <li>To operate moderation, abuse reporting, and safety workflows.</li>
          <li>To display user-generated content and account/profile state.</li>
          <li>To maintain service reliability and resolve user support requests.</li>
        </ul>
      </section>

      <section>
        <h2>Feature Status and Changes</h2>
        <p>
          Some features, including parts of verification and communication workflows, may change as
          the service evolves. This policy may be updated over time to reflect product and legal
          requirements.
        </p>
      </section>

      <section>
        <h2>Support Contact</h2>
        <p>
          For privacy or data requests, contact us at{" "}
          <a href={`mailto:${PUBLIC_SITE.supportEmail}`}>{PUBLIC_SITE.supportEmail}</a>.
        </p>
      </section>
    </PublicPageShell>
  );
}

