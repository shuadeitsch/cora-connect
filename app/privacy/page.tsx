import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This policy describes how Chabad of Maine (CORA) (“we,” “us”) collects and uses information for community outreach, including text messages. It is effective November 15, 2026.</p>

      <LegalSection heading="What we collect">
        <p>We collect your name, phone number, email address, and visit notes. We collect this information in person or through prior contact with you.</p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>We use this information only for community outreach messages, such as invitations to visits and events.</p>
      </LegalSection>

      <LegalSection heading="We do not sell or share your information for marketing">
        <p>We never sell, rent, or share phone numbers or SMS opt-in data with third parties or affiliates for their marketing.</p>
      </LegalSection>

      <LegalSection heading="Text messages">
        <p>Message frequency varies. Message and data rates may apply. Reply STOP to opt out of text messages. Reply HELP for help.</p>
      </LegalSection>

      <LegalSection heading="Data security">
        <p>We take reasonable steps to protect the information we collect and to limit access to people who need it for outreach. No method of storage or transmission is completely secure, but we work to keep your information safe.</p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy, or requests about your information, can be sent to{" "}
          <a className="text-primary underline" href="mailto:info@chabadora.com">info@chabadora.com</a>.
        </p>
        <p>Effective date: November 15, 2026.</p>
      </LegalSection>
    </LegalPage>
  );
}
