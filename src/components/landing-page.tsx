import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

const capabilities = [
  {
    icon: MessageSquareText,
    title: "Guidance grounded in your business",
    description:
      "Give the advisor the operating context you choose—from customers and offerings to constraints and goals—so the conversation starts closer to the real problem.",
    accent: "bg-blue-50 text-blue-700",
  },
  {
    icon: ListChecks,
    title: "Advice that becomes a plan",
    description:
      "Turn a useful recommendation into a goal and practical task list. Review and edit the plan before anything is added to your workspace.",
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: ShieldCheck,
    title: "Context you can control",
    description:
      "Choose whether new responses can use your business profile, previous consultations, and uploaded document search from straightforward privacy settings.",
    accent: "bg-violet-50 text-violet-700",
  },
];

const workflow = [
  {
    number: "01",
    title: "Add the useful context",
    description:
      "Build a business profile at your pace and upload only the documents that help explain how your business works.",
  },
  {
    number: "02",
    title: "Work through the decision",
    description:
      "Ask a direct question or use the guided prompt builder to organize the background, constraints, and outcome you want.",
  },
  {
    number: "03",
    title: "Put the answer to work",
    description:
      "Keep the consultation for reference, turn recommendations into approved goals and tasks, and track the work in one place.",
  },
];

const useCases = [
  "Increase weekday sales",
  "Reduce operating costs",
  "Improve customer retention",
  "Pressure-test a pricing idea",
  "Prioritize competing goals",
  "Turn a strategy into tasks",
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-950">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50">
          <div className="landing-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[800px] -translate-x-1/2 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm">
                <Sparkles className="size-3.5" />A practical AI advisor for
                small business
              </div>
              <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]">
                A clearer path from business question to next step.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Main Street Advisor is an AI-powered consulting workspace that
                helps you think through challenges, organize recommendations,
                and keep the follow-through moving.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  Create your account <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/#how-it-works"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  See how it works
                </Link>
              </div>
              <div className="mt-7 flex items-start gap-2 text-sm leading-6 text-slate-500">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>You review every proposed plan before it is saved.</span>
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section aria-label="Product principles" className="bg-white">
          <div className="mx-auto grid max-w-7xl divide-y divide-slate-200 border-x border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Principle
              icon={UserRound}
              title="Built around your context"
              copy="Recommendations can reflect the business details you choose to provide."
            />
            <Principle
              icon={Target}
              title="Focused on useful next steps"
              copy="Move from an open-ended question to a plan you can review and manage."
            />
            <Principle
              icon={ShieldCheck}
              title="Designed with clear controls"
              copy="Manage which additional workspace sources AI may use for new answers."
            />
          </div>
        </section>

        <section id="features" className="scroll-mt-28 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                One connected workspace
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                More than a chat window.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                The conversation, business context, documents, goals, and tasks
                stay connected, so good advice has somewhere useful to go.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {capabilities.map(
                ({ icon: Icon, title, description, accent }) => (
                  <article
                    key={title}
                    className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 sm:p-7"
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-xl ${accent}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {description}
                    </p>
                  </article>
                ),
              )}
            </div>

            <div className="mt-6 grid overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">
                  From recommendation to action
                </p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
                  Keep the momentum after the conversation.
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  Ask the advisor to turn a recommendation into a goal and task
                  list. Edit the proposal, approve it, and continue the work in
                  your Goals &amp; Tasks view.
                </p>
                <div className="mt-7 space-y-3 text-sm text-slate-200">
                  {[
                    "Review before saving",
                    "Organize tasks under a goal",
                    "Update progress as work moves",
                  ].map((item) => (
                    <p key={item} className="flex items-center gap-3">
                      <span className="grid size-5 place-items-center rounded-full bg-blue-500/20 text-blue-300">
                        <Check className="size-3" />
                      </span>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
              <PlanPreview />
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-28 border-y border-slate-200 bg-slate-50 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                Start with the question. Build from there.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                You do not need a perfect brief. Add what you know, work through
                the decision, and keep only the next steps that make sense.
              </p>
            </div>

            <ol className="relative mt-14 grid gap-5 lg:grid-cols-3">
              <div
                aria-hidden="true"
                className="absolute left-[16.7%] right-[16.7%] top-8 hidden h-px bg-blue-200 lg:block"
              />
              {workflow.map((step) => (
                <li
                  key={step.number}
                  className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <span className="relative grid size-16 place-items-center rounded-2xl border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 shadow-[0_0_0_8px_#f8fafc]">
                    {step.number}
                  </span>
                  <h3 className="mt-7 text-lg font-semibold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                Bring the question on your mind
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                Practical support for everyday business decisions.
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
                Use Main Street Advisor to think through an immediate challenge,
                explore an idea, or turn a broad objective into work you can
                actually schedule.
              </p>
              <Link
                href="/sign-up"
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Create your workspace <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {useCases.map((useCase, index) => (
                <div
                  key={useCase}
                  className={`flex min-h-28 items-end rounded-2xl border p-5 ${
                    index === 0 || index === 5
                      ? "border-blue-200 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  <div>
                    <span className="mb-3 block text-xs font-semibold text-slate-400">
                      0{index + 1}
                    </span>
                    <p className="font-semibold">{useCase}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-blue-600 px-6 py-12 text-white sm:px-10 lg:px-14 lg:py-16">
            <div className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full border-[60px] border-white/5" />
            <div className="pointer-events-none absolute -bottom-36 right-48 size-80 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <div className="max-w-2xl">
                <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
                  <ShieldCheck className="size-6" />
                </span>
                <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Useful context, with visible controls.
                </h2>
                <p className="mt-4 text-base leading-8 text-blue-100">
                  Your current question is processed to create a response. You
                  decide whether additional business profile data, prior
                  consultations, and document search can be used as context.
                </p>
                <Link
                  href="/privacy"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white underline decoration-blue-300 underline-offset-4"
                >
                  Read the Privacy Policy <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm backdrop-blur sm:min-w-72">
                {[
                  "Business profile context",
                  "Previous consultations",
                  "Uploaded document search",
                ].map((control) => (
                  <div
                    key={control}
                    className="flex items-center justify-between gap-6 rounded-xl bg-white/10 px-4 py-3"
                  >
                    <span>{control}</span>
                    <span className="relative h-5 w-9 shrink-0 rounded-full bg-white">
                      <span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-blue-600" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 px-5 py-20 text-center sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <Sparkles className="size-6" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Give your next business decision a clearer place to start.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Create a workspace, add the context that matters, and begin with
              the question already on your mind.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                Create your account <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of an advisor consultation and proposed action plan"
      className="relative mx-auto w-full max-w-2xl"
    >
      <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-blue-200/60 via-white/30 to-violet-200/50 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-400/25">
        <div className="flex h-11 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4">
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 text-[11px] font-medium text-slate-400">
            Main Street Advisor
          </span>
        </div>
        <div className="grid min-h-[430px] sm:grid-cols-[152px_1fr]">
          <div className="hidden border-r border-slate-200 bg-slate-50/80 p-3 sm:block">
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700">
              New consultation
            </div>
            <p className="mt-5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </p>
            <div className="mt-2 space-y-1 text-[10px] text-slate-500">
              <p className="rounded-md bg-white px-2 py-2 shadow-sm">
                Goals &amp; Tasks
              </p>
              <p className="px-2 py-2">Business Profile</p>
            </div>
            <p className="mt-6 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Recent
            </p>
            <div className="mt-2 space-y-2 px-2 text-[9px] leading-4 text-slate-400">
              <p>Weekday sales ideas</p>
              <p>Customer retention plan</p>
              <p>Operating cost review</p>
            </div>
          </div>
          <div className="flex flex-col bg-white p-4 sm:p-5">
            <div className="text-center">
              <span className="mx-auto grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <Sparkles className="size-4" />
              </span>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Good morning, Avery
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                How can I help Northstar Coffee today?
              </p>
            </div>
            <div className="mt-5 ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-blue-600 px-3 py-2.5 text-[10px] leading-4 text-white">
              Help me increase weekday sales without adding more staff.
            </div>
            <div className="mt-4 max-w-[94%] text-[10px] leading-[1.55] text-slate-600">
              <p>
                Start with a focused two-week test in your slowest weekday
                window. Based on your goal, I would keep it simple:
              </p>
              <div className="mt-2 space-y-1.5">
                {[
                  "Pair one high-margin drink with a simple add-on.",
                  "Promote the offer only during the target hours.",
                  "Compare transactions and average ticket each day.",
                ].map((item) => (
                  <p key={item} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-blue-500" />
                    {item}
                  </p>
                ))}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700">
                <ListChecks className="size-3" /> Create goal &amp; tasks
              </div>
            </div>
            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-white text-blue-600 shadow-sm">
                  <MessageSquareText className="size-3" />
                </span>
                <p className="text-[9px] text-slate-400">
                  Describe a challenge, goal, or decision…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 right-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl sm:-right-5">
        <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="size-4" />
        </span>
        <div>
          <p className="text-[10px] font-semibold text-slate-800">
            Plan ready for review
          </p>
          <p className="mt-0.5 text-[9px] text-slate-400">1 goal · 4 tasks</p>
        </div>
      </div>
    </div>
  );
}

function Principle({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof UserRound;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-4 px-6 py-7 sm:px-7">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
      </div>
    </div>
  );
}

function PlanPreview() {
  return (
    <div className="relative flex min-h-[460px] items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-violet-600 p-6 sm:p-10">
      <div className="landing-grid-dark pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/20 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Proposed plan
            </p>
            <h4 className="mt-2 text-lg font-semibold text-slate-950">
              Grow weekday afternoon sales
            </h4>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
            Review
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {[
            ["Define a two-week offer", "Today"],
            ["Prepare counter signage", "This week"],
            ["Brief the weekday team", "This week"],
            ["Review sales results", "In 2 weeks"],
          ].map(([task, timing], index) => (
            <div
              key={task}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-[10px] font-semibold text-slate-400">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                {task}
              </span>
              <span className="text-[9px] text-slate-400">{timing}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <span className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-500">
            Edit plan
          </span>
          <span className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white">
            Approve &amp; save
          </span>
        </div>
      </div>
    </div>
  );
}
