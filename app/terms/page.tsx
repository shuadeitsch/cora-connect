import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>These terms describe the SMS program of Chabad of Maine (CORA). They should be read together with our Privacy Policy.</p>

      <LegalSection heading="The SMS program">
        <p>Chabad of Maine sends outreach texts inviting you to visits and events in the community.</p>
      </LegalSection>

      <LegalSection heading="Opting in">
        <p>You opt in to these texts by sharing your phone number with us, in person or through prior contact.</p>
      </LegalSection>

      <LegalSection heading="Opting out and help">
        <p>You can opt out at any time by replying STOP, UNSUBSCRIBE, CANCEL, END, or QUIT. After you opt out, we will stop sending you outreach texts. Reply HELP for help.</p>
      </LegalSection>

      <LegalSection heading="Frequency, rates, and delivery">
        <p>Message frequency varies. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.</p>
      </LegalSection>

      <LegalSection heading="Privacy and contact">
        <p>
          Our <Link className="text-primary underline" href="/privacy">Privacy Policy</Link> explains how we collect and use information, including that we never sell, rent, or share phone numbers or SMS opt-in data with third parties or affiliates for marketing.
        </p>
        <p>
          For questions about this program, email{" "}
          <a className="text-primary underline" href="mailto:info@chabadora.com">info@chabadora.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
