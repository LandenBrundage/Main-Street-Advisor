import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import {
  LEGAL_ENTITY_NAME,
  PRIVACY_SUPPORT_EMAIL,
  PRODUCT_NAME,
} from "@/lib/config";

export const metadata: Metadata = {
  title: "Tester Terms of Use",
  description: `Terms governing participation in the ${PRODUCT_NAME} pilot.`,
};

export default function PilotTermsPage() {
  return (
    <LegalPage eyebrow="Tester agreement" title="Tester Terms of Use">
      <p>
        These Tester Terms of Use (“Terms”) are an agreement between you and{" "}
        {LEGAL_ENTITY_NAME} (“we,” “us,” or “our”) and govern your access to and
        use of the {PRODUCT_NAME} pilot website, AI consulting workspace, and
        related services (the “Service”).
      </p>

      <section>
        <h2>1. Acceptance and eligibility</h2>
        <p>
          By creating an account, selecting the acceptance checkbox, or
          accessing or using the Service, you agree to these Terms and
          acknowledge our <Link href="/privacy">Privacy Policy</Link>. If you do
          not agree, do not use the Service.
        </p>
        <p>
          You must be at least 18 years old and able to form a binding contract.
          If you use the Service for a company or another person, you represent
          that you have authority to accept these Terms and submit the relevant
          information on their behalf.
        </p>
      </section>

      <section>
        <h2>2. Pilot status</h2>
        <p>
          The Service is a limited pilot and is still being evaluated. Features
          may be incomplete, change, produce unexpected results, or become
          temporarily unavailable. We may set or change reasonable pilot limits,
          invite or remove participants, and modify or discontinue features. We
          will provide notice of material changes when reasonably practical.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <p>
          Provide accurate account information, keep credentials and access
          links confidential, and promptly tell us if you suspect unauthorized
          access. You are responsible for activity through your account unless
          caused by our failure to use reasonable safeguards. Do not share an
          account in a way that defeats workspace permissions or security
          controls.
        </p>
      </section>

      <section>
        <h2>4. Authorized business information</h2>
        <p>
          You may use real business information only when you have the right and
          authority to do so. You may instead use fictional or de-identified
          information during the pilot. Do not submit another person’s personal
          data, confidential information, or protected materials unless doing so
          is lawful and necessary for your use of the Service.
        </p>
        <p>
          Do not submit passwords, authentication secrets, full Social Security
          numbers, payment-card details, medical records, or other unnecessary
          high-risk data. Remove or redact sensitive content from documents
          before uploading them.
        </p>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          As between you and us, you retain ownership of the prompts, business
          information, files, and other material you submit (“Your Content”).
          You grant us a limited, non-exclusive license to host, copy, process,
          transmit, index, display, and otherwise use Your Content only as
          needed to provide, secure, and maintain the Service, comply with law,
          and enforce these Terms.
        </p>
        <p>
          You represent that Your Content and our permitted use of it do not
          violate law, confidentiality duties, intellectual-property rights, or
          another person’s rights. You are responsible for reviewing and backing
          up information you need to keep.
        </p>
      </section>

      <section>
        <h2>6. AI features and professional judgment</h2>
        <p>
          The Service uses third-party artificial-intelligence systems,
          including OpenAI, to generate responses, moderate inputs, and search
          uploaded documents. AI output may be incomplete, inaccurate, outdated,
          or unsuitable for your situation. Similar inputs may produce different
          results.
        </p>
        <p>
          The Service provides general business consulting support only. It is
          not a law firm, accounting firm, financial adviser, medical provider,
          or other licensed professional service. AI output is not legal, tax,
          accounting, investment, medical, or other regulated advice. You remain
          responsible for decisions and should independently verify important
          information and consult a qualified professional before acting on
          high-stakes matters.
        </p>
      </section>

      <section>
        <h2>7. Acceptable use</h2>
        <p>You may not use the Service to:</p>
        <ul>
          <li>violate law or another person’s rights;</li>
          <li>submit information you are not authorized to use;</li>
          <li>
            generate or facilitate fraud, abuse, harassment, or harmful
            activity;
          </li>
          <li>
            upload malware or interfere with the Service or another account;
          </li>
          <li>
            probe, bypass, disable, or defeat access controls, safety controls,
            rate limits, or other protective measures;
          </li>
          <li>
            reverse engineer or extract components of the Service except where
            applicable law expressly permits it; or
          </li>
          <li>misrepresent AI output as verified professional advice.</li>
        </ul>
      </section>

      <section>
        <h2>8. Our service and intellectual property</h2>
        <p>
          We and our licensors retain all rights in the Service, including its
          software, design, branding, and documentation. Subject to these Terms,
          we grant you a limited, revocable, non-exclusive, non-transferable
          right to use the Service during the pilot for your internal business
          evaluation and planning. These Terms do not transfer ownership of the
          Service or third-party technology to you.
        </p>
        <p>
          If you choose to provide feedback, you permit us to use it without
          restriction or compensation, provided we do not publicly identify you
          as its source without permission.
        </p>
      </section>

      <section>
        <h2>9. Privacy and service providers</h2>
        <p>
          Our <Link href="/privacy">Privacy Policy</Link> explains how we handle
          personal data and how OpenAI, Supabase, Vercel, and optional Google
          sign-in support the Service. Third-party services may also be governed
          by their own terms and policies. Privacy settings control which
          additional workspace sources the advisor may use; they do not
          eliminate processing needed to authenticate you, store the workspace,
          or answer a message you send.
        </p>
      </section>

      <section>
        <h2>10. Suspension and termination</h2>
        <p>
          You may stop using the Service at any time and may use Settings to
          delete an eligible account and workspace. You may also request help at{" "}
          <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}>
            {PRIVACY_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p>
          We may suspend or terminate access if you materially violate these
          Terms, create security or legal risk, or if the pilot ends. When
          reasonably possible, we will provide notice and an opportunity to
          export or delete Your Content. Sections that by their nature should
          survive termination, including ownership, disclaimers, liability
          limits, and governing law, will survive.
        </p>
      </section>

      <section>
        <h2>11. Disclaimers</h2>
        <p>
          To the fullest extent permitted by law, the Service and all output are
          provided “as is” and “as available.” We disclaim implied warranties of
          merchantability, fitness for a particular purpose, title, and
          non-infringement. We do not warrant that the Service will be
          uninterrupted, error-free, secure, or that output will be accurate or
          achieve a particular business result. Nothing in these Terms excludes
          a warranty or right that cannot lawfully be excluded.
        </p>
      </section>

      <section>
        <h2>12. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, neither we nor our suppliers
          will be liable for indirect, incidental, special, consequential,
          exemplary, or punitive damages, or for lost profits, revenue, data,
          goodwill, or business opportunity arising from the Service, even if
          advised that such damages are possible.
        </p>
        <p>
          To the fullest extent permitted by law, our total liability arising
          out of or relating to the Service or these Terms will not exceed the
          greater of the amount you paid us for the Service during the 12 months
          before the event giving rise to the claim or $100. These limits do not
          apply where prohibited by law or to liability that cannot lawfully be
          limited.
        </p>
      </section>

      <section>
        <h2>13. Changes to these Terms</h2>
        <p>
          We may update these Terms as the pilot changes. We will post revised
          Terms with a new effective date and provide additional notice of
          material changes when required. If you continue using the Service
          after revised Terms take effect, you accept the revised Terms; if you
          do not agree, stop using the Service and delete or request deletion of
          your account.
        </p>
      </section>

      <section>
        <h2>14. Governing law and general terms</h2>
        <p>
          Oregon law governs these Terms, without regard to conflict-of-law
          rules. Any dispute that is not resolved informally will be brought in
          a state or federal court with jurisdiction in Oregon, and each party
          consents to personal jurisdiction there. Nothing in these Terms
          prevents either party from seeking urgent injunctive relief where
          appropriate.
        </p>
        <p>
          These Terms and the Privacy Policy are the entire agreement concerning
          the Service during the pilot. If one provision is unenforceable, the
          remaining provisions remain effective. Our failure to enforce a
          provision is not a waiver. You may not assign these Terms without our
          consent; we may assign them in connection with a reorganization,
          financing, merger, acquisition, or sale of assets.
        </p>
      </section>

      <section>
        <h2>15. Contact</h2>
        <p>
          Questions about these Terms may be sent to {LEGAL_ENTITY_NAME} at{" "}
          <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}>
            {PRIVACY_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
