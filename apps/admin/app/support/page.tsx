import type { Metadata } from "next";
import { PUBLIC_SITE } from "../../config/public-site";
import { PublicPageShell } from "../public-page-shell";

export const metadata: Metadata = {
  title: `Support | ${PUBLIC_SITE.siteName}`,
  description: `Support page for ${PUBLIC_SITE.siteName}`
};

export default function SupportPage() {
  return (
    <PublicPageShell
      title="Support"
      description="Need help with LUCL? Contact support for account, bug, or safety-related requests."
    >
      <section>
        <h2>How to Get Help</h2>
        <ul>
          <li>App usage questions and account access issues.</li>
          <li>Bug reports and feature feedback.</li>
          <li>Safety concerns and harmful content reports.</li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Email: <a href={`mailto:${PUBLIC_SITE.supportEmail}`}>{PUBLIC_SITE.supportEmail}</a>
        </p>
        <p>
          Please include device/OS details, app version, and screenshots when reporting bugs to
          help us respond faster.
        </p>
      </section>
    </PublicPageShell>
  );
}

