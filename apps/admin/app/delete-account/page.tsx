import type { Metadata } from "next";
import { PUBLIC_SITE } from "../../config/public-site";
import { PublicPageShell } from "../public-page-shell";

export const metadata: Metadata = {
  title: `Delete Account | ${PUBLIC_SITE.siteName}`,
  description: `Account deletion and deactivation information for ${PUBLIC_SITE.siteName}`
};

export default function DeleteAccountPage() {
  return (
    <PublicPageShell
      title="Delete Account"
      description="How to request account deletion/deactivation for LUCL."
    >
      <section>
        <h2>Delete from the App</h2>
        <p>
          You can request account deletion/deactivation directly from the app settings via
          <strong> 계정 삭제하기 / Delete Account</strong>.
        </p>
      </section>

      <section>
        <h2>If You Cannot Access the App</h2>
        <p>
          If you no longer have app access, contact{" "}
          <a href={`mailto:${PUBLIC_SITE.supportEmail}`}>{PUBLIC_SITE.supportEmail}</a> and request
          account deletion support.
        </p>
      </section>

      <section>
        <h2>How Data Is Handled</h2>
        <ul>
          <li>Some user-owned records may be deleted as part of cleanup.</li>
          <li>
            Some profile-related data may be anonymized/deactivated when full immediate deletion is
            not operationally safe.
          </li>
          <li>
            Certain records may be retained when required for legal, security, fraud prevention, or
            operational compliance reasons.
          </li>
        </ul>
      </section>

      <section>
        <h2>Important Note</h2>
        <p>
          LUCL account deletion flows may evolve as backend systems are improved. This page is
          updated as deletion processes are refined.
        </p>
      </section>
    </PublicPageShell>
  );
}

