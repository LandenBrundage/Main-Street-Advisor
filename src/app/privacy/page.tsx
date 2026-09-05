import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import {
  LEGAL_ENTITY_NAME,
  PRIVACY_SUPPORT_EMAIL,
  PRODUCT_NAME,
} from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${PRODUCT_NAME} collects, uses, shares, and protects personal data.`,
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage eyebrow="Your data and choices" title="Privacy Policy">
      <p>
        This Privacy Policy explains how {LEGAL_ENTITY_NAME}, which operates{" "}
        {PRODUCT_NAME}, collects, uses, discloses, and retains personal data
        when you use our pilot website, AI consulting workspace, and related
        support services (the “Service”). It also explains the choices available
        to you.
      </p>

      <section>
        <h2>1. Who controls your data</h2>
        <p>
          {LEGAL_ENTITY_NAME} is the controller of personal data described in
          this policy. We are based in Oregon and operate the Service under the
          name {PRODUCT_NAME}. You can contact us at{" "}
          <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}>
            {PRIVACY_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2>2. Data we collect</h2>
        <p>Depending on how you use the Service, we collect:</p>
        <ul>
          <li>
            <strong>Account and identity data:</strong> email address, display
            name, profile picture, authentication provider, and account
            identifiers. If you use Google sign-in, Google supplies basic
            account information needed to authenticate you.
          </li>
          <li>
            <strong>Policy acknowledgment:</strong> your account identifier, the
            versions of the Tester Terms and Privacy Policy you acknowledged,
            and the date and time of acknowledgment.
          </li>
          <li>
            <strong>Business and workspace data:</strong> the business profile,
            goals, tasks, operating details, preferences, and other information
            you choose to add to your workspace.
          </li>
          <li>
            <strong>Consultation data:</strong> your prompts, messages, AI
            responses, conversation titles and summaries, action proposals, and
            feedback associated with a consultation.
          </li>
          <li>
            <strong>Uploaded documents:</strong> file contents, names, types,
            sizes, processing status, and identifiers used to store and search
            those files.
          </li>
          <li>
            <strong>Settings and communications:</strong> AI context choices,
            deletion requests, privacy requests, safety reports, and messages
            you send us.
          </li>
          <li>
            <strong>Technical and security data:</strong> essential session
            cookies, IP address, browser or device information, request times,
            security signals, and diagnostic or server logs generated when you
            use the Service.
          </li>
        </ul>
        <p>
          The Service is not designed to collect passwords for other services,
          full Social Security numbers, payment-card details, medical records,
          or similarly high-risk information. Please remove unnecessary personal
          or confidential information before submitting a message or file. You
          may use fictional business information during the pilot if you prefer.
        </p>
        <p>
          We do not intentionally request sensitive personal data as defined by
          privacy law. If you include such data in a free-form message, business
          field, or file, we process it as part of that content only for the
          purposes described in this policy.
        </p>
      </section>

      <section>
        <h2>3. How we collect data</h2>
        <p>
          We collect data directly from you when you create an account, complete
          a profile, chat with the advisor, upload a document, change a setting,
          or contact us. We also receive limited data automatically from your
          browser and our service providers, including Supabase, Google, Vercel,
          and OpenAI, as needed to operate and secure the Service.
        </p>
      </section>

      <section>
        <h2>4. Why we use data</h2>
        <p>We use personal data to:</p>
        <ul>
          <li>create, authenticate, and secure your account;</li>
          <li>provide and personalize AI consulting responses;</li>
          <li>
            save consultations, business profiles, goals, tasks, and files;
          </li>
          <li>search documents when you enable document search;</li>
          <li>maintain, troubleshoot, and protect the Service;</li>
          <li>respond to support, privacy, and safety requests;</li>
          <li>enforce our Tester Terms and prevent misuse; and</li>
          <li>comply with law and establish or defend legal claims.</li>
        </ul>
      </section>

      <section id="ai-and-documents">
        <h2>5. AI processing and document search</h2>
        <p>
          When you send a message, the message and the relevant recent portion
          of the current consultation are processed through OpenAI’s API.
          Depending on your AI privacy settings, we may also send selected
          business-profile information, goals and tasks, excerpts or summaries
          from previous consultations, and search results from uploaded
          documents. Inputs may also be checked by OpenAI’s moderation service
          for safety.
        </p>
        <p>
          Documents you upload are stored in your workspace and sent to OpenAI
          to create a searchable index. Turning off document search stops the
          advisor from searching those files for new responses; it does not
          delete files already stored or indexed. Delete a document from your
          Business Profile when you want its active stored copies removed.
        </p>
        <p>
          Our response requests use OpenAI’s <code>store: false</code> setting,
          so response objects are not retained as OpenAI application state.
          OpenAI states that API data is not used to train its models unless the
          API organization expressly opts in; we do not intentionally opt in.
          OpenAI may retain abuse-monitoring logs containing prompts and
          responses for up to 30 days, unless longer retention is required for
          security or legal reasons. Files and vector-search indexes remain with
          OpenAI until they are deleted, after which OpenAI may take up to 30
          days to remove them from its systems.
        </p>
        <p>
          Learn more in OpenAI’s{" "}
          <a href="https://developers.openai.com/api/docs/guides/your-data">
            API data controls documentation
          </a>
          . AI output can be inaccurate. Do not rely on it as a substitute for a
          qualified legal, tax, accounting, financial, medical, or other
          licensed professional.
        </p>
      </section>

      <section>
        <h2>6. When we disclose data</h2>
        <p>We disclose data only as needed for the following purposes:</p>
        <ul>
          <li>
            <strong>Supabase:</strong> account authentication, database
            services, and storage of workspace records and uploaded files.
          </li>
          <li>
            <strong>OpenAI:</strong> AI responses, content moderation, document
            processing, and document search as described above.
          </li>
          <li>
            <strong>Vercel:</strong> application hosting, delivery, operational
            security, and server logs.
          </li>
          <li>
            <strong>Google:</strong> optional account authentication when you
            choose Google sign-in.
          </li>
          <li>
            <strong>Legal and safety disclosures:</strong> regulators, courts,
            law enforcement, advisers, or other parties when reasonably
            necessary to comply with law, protect people or the Service, or
            establish and defend legal claims.
          </li>
          <li>
            <strong>Business transfers:</strong> a successor or transaction
            participant in connection with a merger, financing, acquisition,
            reorganization, or sale, subject to appropriate confidentiality and
            legal requirements.
          </li>
        </ul>
        <p>
          We do not sell personal data, use it for targeted advertising, or use
          it to make decisions that produce legal or similarly significant
          effects about you. We do not disclose personal data to data brokers.
        </p>
      </section>

      <section>
        <h2>7. Cookies and similar technology</h2>
        <p>
          The Service uses essential cookies and browser storage to keep you
          signed in, preserve secure sessions, and support core application
          functions. We do not currently use advertising cookies or third-party
          advertising trackers.
        </p>
      </section>

      <section>
        <h2>8. Retention and deletion</h2>
        <p>
          We generally keep account and workspace content until you delete the
          relevant item or close your account. You can delete individual
          consultations from the navigation sidebar and uploaded documents from
          your Business Profile. Settings includes a self-service account
          deletion flow for eligible workspaces.
        </p>
        <p>
          Account deletion is designed to remove the active workspace,
          consultations, business records, stored files, OpenAI search files and
          indexes, profile picture, and authentication account. Limited copies
          may remain temporarily in provider backups or security logs until
          those copies expire on the provider’s schedule. We may also retain
          data when reasonably necessary to comply with law, resolve disputes,
          prevent fraud, or protect the Service. We do not currently delete
          accounts solely because they have been inactive for a set period.
        </p>
      </section>

      <section>
        <h2>9. Your privacy choices and rights</h2>
        <p>
          Settings lets you control whether new AI responses may use business
          profile data, goals and tasks, previous consultations, and uploaded
          document search. Your new message and relevant current-consultation
          context are always processed when you ask for an AI response.
        </p>
        <p>
          Subject to identity verification and applicable law, you may ask us
          to:
        </p>
        <ul>
          <li>
            confirm whether we process your personal data and provide access;
          </li>
          <li>correct inaccurate personal data;</li>
          <li>delete personal data;</li>
          <li>provide a portable copy of personal data you supplied;</li>
          <li>
            provide a list of specific third parties to which we disclosed your
            personal data, where required; or
          </li>
          <li>appeal our response to a privacy request.</li>
        </ul>
        <p>
          Email requests to{" "}
          <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}>
            {PRIVACY_SUPPORT_EMAIL}
          </a>
          . Use “Privacy request” in the subject line and describe the request
          and account email. We may ask for information needed to verify your
          identity or authority. An authorized agent may submit a request where
          permitted by law, but we may require proof of authorization. We aim to
          respond within 45 days and will provide any extension notice allowed
          by law.
        </p>
        <p>
          To appeal, reply to our decision or email the same address with
          “Privacy appeal” in the subject line. We will not discriminate against
          you for exercising a privacy right. Because we do not sell data,
          conduct targeted advertising, or perform qualifying profiling, those
          opt-outs are not currently applicable. If those practices change, we
          will provide the required controls and honor legally recognized
          universal opt-out signals.
        </p>
      </section>

      <section>
        <h2>10. Security</h2>
        <p>
          We use administrative, technical, and organizational safeguards
          intended to protect personal data, including authenticated access,
          workspace authorization, database row-level access controls, transport
          encryption, guarded deletion flows, and restricted service
          credentials. No system is perfectly secure, so we cannot guarantee
          absolute security. Report a suspected privacy or security issue to{" "}
          <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}>
            {PRIVACY_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2>11. Age requirement</h2>
        <p>
          The Service is intended only for people age 18 or older. We do not
          knowingly collect personal data from anyone under 18. If you believe a
          person under 18 has provided personal data, contact us so we can
          review and delete it as appropriate.
        </p>
      </section>

      <section>
        <h2>12. Changes to this policy</h2>
        <p>
          We may update this policy as the pilot and our practices change. We
          will post the revised policy with a new effective date and provide
          additional notice when required by law. Material changes apply
          prospectively unless law permits otherwise.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          Privacy questions, requests, and appeals may be sent to{" "}
          <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}>
            {PRIVACY_SUPPORT_EMAIL}
          </a>
          . For the rules governing use of the pilot, see our{" "}
          <Link href="/terms">Tester Terms of Use</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
