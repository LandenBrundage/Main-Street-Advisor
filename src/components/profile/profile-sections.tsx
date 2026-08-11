"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ProfileSectionKey } from "@/lib/profile";
import type { ProfileInput } from "@/lib/schemas";

export type SectionEditorProps = {
  profile: ProfileInput;
  setRoot: (
    key: "businessName" | "legacyAdditionalInformation",
    value: string,
  ) => void;
  setField: (section: ProfileSectionKey, key: string, value: unknown) => void;
};

const industries = [
  "Agriculture",
  "Automotive",
  "Construction",
  "Consulting",
  "Education",
  "Finance and insurance",
  "Food and beverage",
  "Health and wellness",
  "Home services",
  "Hospitality",
  "Manufacturing",
  "Professional services",
  "Real estate",
  "Retail",
  "Technology",
  "Transportation",
  "Other",
];

export function ProfileSectionEditor({
  section,
  ...props
}: SectionEditorProps & { section: ProfileSectionKey }) {
  switch (section) {
    case "basics":
      return <Basics {...props} />;
    case "offerings":
      return <Offerings {...props} />;
    case "customers":
      return <Customers {...props} />;
    case "performance":
      return <Performance {...props} />;
    case "operations":
      return <Operations {...props} />;
    case "goals":
      return <Goals {...props} />;
    case "advice":
      return <Advice {...props} />;
  }
}

function Basics({ profile, setRoot, setField }: SectionEditorProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        label="Business name"
        required
        value={profile.businessName}
        onChange={(value) => setRoot("businessName", value)}
      />
      <label>
        <span className="label">Industry *</span>
        <input
          list="business-industries"
          className="field"
          value={profile.basics.industry}
          placeholder="Search or choose an industry"
          onChange={(event) =>
            setField("basics", "industry", event.target.value)
          }
        />
        <datalist id="business-industries">
          {industries.map((industry) => (
            <option key={industry} value={industry} />
          ))}
        </datalist>
      </label>
      {profile.basics.industry === "Other" && (
        <TextField
          label="Describe the industry"
          value={profile.basics.industryOther}
          onChange={(value) => setField("basics", "industryOther", value)}
        />
      )}
      <TextArea
        className="sm:col-span-2"
        label="What does the business do?"
        required
        value={profile.basics.description}
        helper="For example: We provide weekly bookkeeping and cash-flow reporting for independent restaurants."
        onChange={(value) => setField("basics", "description", value)}
      />
      <TextField
        label="Location or service area"
        value={profile.basics.location}
        onChange={(value) => setField("basics", "location", value)}
      />
      <TextField
        label="Website"
        type="url"
        value={profile.basics.website}
        onChange={(value) => setField("basics", "website", value)}
      />
      <NumberField
        label="Years in business"
        value={profile.basics.yearsInBusiness}
        onChange={(value) => setField("basics", "yearsInBusiness", value)}
      />
      <NumberField
        label="Number of employees"
        value={profile.basics.employees}
        onChange={(value) => setField("basics", "employees", value)}
      />
      <SelectField
        label="Business stage"
        value={profile.basics.stage}
        options={[
          ["", "Select a stage"],
          ["idea", "Idea"],
          ["recently_launched", "Recently launched"],
          ["growing", "Growing"],
          ["established", "Established"],
          ["declining", "Declining"],
        ]}
        onChange={(value) => setField("basics", "stage", value)}
      />
      <SelectField
        label="How the business operates"
        value={profile.basics.businessStructure}
        options={[
          ["", "Select a structure"],
          ["online", "Online"],
          ["physical", "Physical location"],
          ["service_area", "Service-area business"],
          ["hybrid", "Hybrid"],
        ]}
        onChange={(value) => setField("basics", "businessStructure", value)}
      />
      <SelectField
        label="Legal structure"
        value={profile.basics.legalStructure}
        options={[
          ["", "Select if known"],
          ["sole_proprietorship", "Sole proprietorship"],
          ["partnership", "Partnership"],
          ["llc", "LLC"],
          ["corporation", "Corporation"],
          ["nonprofit", "Nonprofit"],
          ["other", "Other"],
        ]}
        onChange={(value) => setField("basics", "legalStructure", value)}
      />
      {profile.legacyAdditionalInformation && (
        <details className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Review migrated legacy information
          </summary>
          <textarea
            className="field mt-3"
            rows={5}
            value={profile.legacyAdditionalInformation}
            onChange={(event) =>
              setRoot("legacyAdditionalInformation", event.target.value)
            }
          />
          <p className="mt-2 text-xs text-slate-500">
            Information that did not map cleanly remains here and is never
            discarded automatically.
          </p>
        </details>
      )}
    </div>
  );
}

function Offerings({ profile, setField }: SectionEditorProps) {
  return (
    <div className="space-y-5">
      <TagInput
        label="Main products or services"
        required
        values={profile.offerings.main}
        placeholder="Add a product or service"
        onChange={(values) => setField("offerings", "main", values)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Typical price or price range"
          value={profile.offerings.typicalPriceRange}
          placeholder="For example: $75–$150 per visit"
          onChange={(value) =>
            setField("offerings", "typicalPriceRange", value)
          }
        />
        <TextField
          label="Best-selling product or service"
          value={profile.offerings.bestSeller}
          onChange={(value) => setField("offerings", "bestSeller", value)}
        />
      </div>
      <ChoiceGroup
        label="Revenue model"
        values={profile.offerings.revenueModels}
        options={[
          ["one_time", "One-time purchases"],
          ["subscriptions", "Subscriptions"],
          ["contracts", "Contracts"],
          ["advertising", "Advertising"],
          ["commissions", "Commissions"],
          ["other", "Other"],
        ]}
        onChange={(values) => setField("offerings", "revenueModels", values)}
      />
      <ChoiceGroup
        label="Sales channels"
        values={profile.offerings.salesChannels}
        options={[
          ["storefront", "Storefront"],
          ["website", "Website"],
          ["marketplace", "Marketplace"],
          ["social_media", "Social media"],
          ["direct_sales", "Direct sales"],
          ["other", "Other"],
        ]}
        onChange={(values) => setField("offerings", "salesChannels", values)}
      />
    </div>
  );
}

function Customers({ profile, setField }: SectionEditorProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextArea
        className="sm:col-span-2"
        label="Ideal customer"
        required
        value={profile.customers.idealCustomer}
        helper="Describe the customer most likely to benefit and buy. For example: local homeowners with older yards who value reliable weekly service."
        onChange={(value) => setField("customers", "idealCustomer", value)}
      />
      <TextField
        label="Where most customers are located"
        value={profile.customers.locations}
        onChange={(value) => setField("customers", "locations", value)}
      />
      <TagInput
        label="Main competitors (optional)"
        values={profile.customers.competitors}
        placeholder="Add a competitor"
        onChange={(values) => setField("customers", "competitors", values)}
      />
      <ChoiceGroup
        className="sm:col-span-2"
        label="How customers currently find the business"
        values={profile.customers.discoveryChannels}
        options={[
          ["referrals", "Referrals"],
          ["search", "Search engines"],
          ["social", "Social media"],
          ["walk_in", "Walk-in traffic"],
          ["advertising", "Advertising"],
          ["marketplaces", "Marketplaces"],
          ["other", "Other"],
        ]}
        onChange={(values) =>
          setField("customers", "discoveryChannels", values)
        }
      />
      <TextArea
        label="Why customers choose the business"
        value={profile.customers.whyChoose}
        onChange={(value) => setField("customers", "whyChoose", value)}
      />
      <TextArea
        label="What makes the business different"
        value={profile.customers.differentiation}
        onChange={(value) => setField("customers", "differentiation", value)}
      />
    </div>
  );
}

const optionalRangeOptions: Array<[string, string]> = [
  ["", "Not answered"],
  ["under_1k", "Under $1,000"],
  ["1k_5k", "$1,000–$5,000"],
  ["5k_10k", "$5,000–$10,000"],
  ["10k_25k", "$10,000–$25,000"],
  ["25k_50k", "$25,000–$50,000"],
  ["50k_100k", "$50,000–$100,000"],
  ["over_100k", "Over $100,000"],
  ["unknown", "I don’t know"],
  ["prefer_not", "Prefer not to answer"],
];

const optionalSalesVolumeOptions: Array<[string, string]> = [
  ["", "Not answered"],
  ["under_10", "Fewer than 10"],
  ["10_49", "10–49"],
  ["50_99", "50–99"],
  ["100_249", "100–249"],
  ["250_499", "250–499"],
  ["500_999", "500–999"],
  ["over_1000", "1,000 or more"],
  ["unknown", "I don’t know"],
  ["prefer_not", "Prefer not to answer"],
];

const optionalTransactionOptions: Array<[string, string]> = [
  ["", "Not answered"],
  ["under_10", "Under $10"],
  ["10_24", "$10–$24"],
  ["25_49", "$25–$49"],
  ["50_99", "$50–$99"],
  ["100_249", "$100–$249"],
  ["250_499", "$250–$499"],
  ["500_999", "$500–$999"],
  ["over_1000", "$1,000 or more"],
  ["unknown", "I don’t know"],
  ["prefer_not", "Prefer not to answer"],
];

function Performance({ profile, setField }: SectionEditorProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        Everything in this section is optional. Use ranges and share only what
        you are comfortable using for personalized advice.
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Approximate monthly revenue"
          value={profile.performance.monthlyRevenueRange}
          options={optionalRangeOptions}
          onChange={(value) =>
            setField("performance", "monthlyRevenueRange", value)
          }
        />
        <SelectField
          label="Approximate monthly expenses"
          value={profile.performance.monthlyExpensesRange}
          options={optionalRangeOptions}
          onChange={(value) =>
            setField("performance", "monthlyExpensesRange", value)
          }
        />
        <SelectField
          label="Average customers or sales per month"
          value={profile.performance.averageSalesPerMonth}
          options={optionalSalesVolumeOptions}
          onChange={(value) =>
            setField("performance", "averageSalesPerMonth", value)
          }
        />
        <SelectField
          label="Average transaction value"
          value={profile.performance.averageTransactionValue}
          options={optionalTransactionOptions}
          onChange={(value) =>
            setField("performance", "averageTransactionValue", value)
          }
        />
        <TextField
          label="Most profitable product or service"
          value={profile.performance.mostProfitableOffering}
          onChange={(value) =>
            setField("performance", "mostProfitableOffering", value)
          }
        />
        <SelectField
          label="Recent trend"
          value={profile.performance.recentTrend}
          options={[
            ["", "Not answered"],
            ["growing", "Growing"],
            ["stable", "Stable"],
            ["declining", "Declining"],
            ["unsure", "I don’t know / unsure"],
            ["prefer_not", "Prefer not to answer"],
          ]}
          onChange={(value) => setField("performance", "recentTrend", value)}
        />
      </div>
      <ChoiceGroup
        label="Metrics currently tracked"
        values={profile.performance.metricsTracked}
        options={[
          ["sales", "Sales"],
          ["profit", "Profit"],
          ["leads", "Leads"],
          ["repeat_customers", "Repeat customers"],
          ["website_traffic", "Website traffic"],
          ["other", "Other"],
        ]}
        onChange={(values) => setField("performance", "metricsTracked", values)}
      />
    </div>
  );
}

function Operations({ profile, setField }: SectionEditorProps) {
  return (
    <div className="space-y-5">
      <TagInput
        label="Tools, software, or manual processes used"
        values={profile.operations.tools}
        placeholder="Add a tool or process"
        onChange={(values) => setField("operations", "tools", values)}
      />
      <TextArea
        label="Who handles the main responsibilities?"
        value={profile.operations.responsibilities}
        helper="For example: The owner handles sales and scheduling; two team leads manage delivery."
        onChange={(value) => setField("operations", "responsibilities", value)}
      />
      <ChoiceGroup
        label="Current growth limitations"
        values={profile.operations.growthLimitations}
        options={[
          ["time", "Time"],
          ["staff", "Staff"],
          ["money", "Money"],
          ["demand", "Demand"],
          ["space", "Space"],
          ["technology", "Technology"],
          ["knowledge", "Knowledge"],
          ["other", "Other"],
        ]}
        onChange={(values) =>
          setField("operations", "growthLimitations", values)
        }
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextArea
          label="Seasonal or unusually busy periods"
          value={profile.operations.seasonalPeriods}
          onChange={(value) => setField("operations", "seasonalPeriods", value)}
        />
        <TextArea
          label="Parts of the business that take the most time"
          value={profile.operations.timeConsumingWork}
          onChange={(value) =>
            setField("operations", "timeConsumingWork", value)
          }
        />
      </div>
    </div>
  );
}

function Goals({ profile, setField }: SectionEditorProps) {
  const tried = profile.goals.triedStrategies;
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        This primary goal is linked to the Goals system. Updating it here never
        changes any task’s completion status.
      </div>
      <TextField
        label="Most important current goal"
        required
        value={profile.goals.primaryGoal}
        onChange={(value) => setField("goals", "primaryGoal", value)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          <span className="label">Desired completion date</span>
          <input
            type="date"
            className="field"
            value={profile.goals.targetDate}
            onChange={(event) =>
              setField("goals", "targetDate", event.target.value)
            }
          />
        </label>
        <TextField
          label="Available time, budget, employees, or other resources"
          value={profile.goals.availableResources}
          onChange={(value) => setField("goals", "availableResources", value)}
        />
      </div>
      <TextArea
        label="What does success look like?"
        value={profile.goals.successDefinition}
        helper="Use a concrete outcome where possible, such as 20 additional weekly orders by October."
        onChange={(value) => setField("goals", "successDefinition", value)}
      />
      <TextArea
        label="Biggest obstacle or challenge"
        required
        value={profile.goals.biggestObstacle}
        onChange={(value) => setField("goals", "biggestObstacle", value)}
      />
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label mb-0">Confirmed strategies already tried</p>
            <p className="text-xs text-slate-500">
              Only add actions the business actually tried—not recommendations.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() =>
              setField("goals", "triedStrategies", [
                ...tried,
                { strategy: "", result: "" },
              ])
            }
          >
            <Plus className="size-4" /> Add
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {tried.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <input
                className="field"
                aria-label={`Strategy ${index + 1}`}
                placeholder="What was tried?"
                value={item.strategy}
                onChange={(event) =>
                  setField(
                    "goals",
                    "triedStrategies",
                    tried.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, strategy: event.target.value }
                        : entry,
                    ),
                  )
                }
              />
              <input
                className="field"
                aria-label={`Result ${index + 1}`}
                placeholder="What happened?"
                value={item.result}
                onChange={(event) =>
                  setField(
                    "goals",
                    "triedStrategies",
                    tried.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, result: event.target.value }
                        : entry,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-red-700"
                aria-label={`Remove strategy ${index + 1}`}
                onClick={() =>
                  setField(
                    "goals",
                    "triedStrategies",
                    tried.filter((_, entryIndex) => entryIndex !== index),
                  )
                }
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <TagInput
        label="Solutions you do not want to use"
        values={profile.goals.excludedSolutions}
        placeholder="Add a boundary or excluded approach"
        onChange={(values) => setField("goals", "excludedSolutions", values)}
      />
    </div>
  );
}

function Advice({ profile, setField }: SectionEditorProps) {
  return (
    <div className="space-y-5">
      <ChoiceGroup
        label="Areas where you want help"
        values={profile.advice.helpAreas}
        options={[
          ["marketing", "Marketing"],
          ["finances", "Finances"],
          ["operations", "Operations"],
          ["hiring", "Hiring"],
          ["strategy", "Strategy"],
          ["retention", "Customer retention"],
          ["technology", "Technology"],
          ["other", "Other"],
        ]}
        onChange={(values) => setField("advice", "helpAreas", values)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Preferred detail level"
          value={profile.advice.detailLevel}
          options={[
            ["", "No preference"],
            ["quick", "Quick suggestions"],
            ["step_by_step", "Step-by-step guidance"],
            ["detailed", "Detailed analysis"],
          ]}
          onChange={(value) => setField("advice", "detailLevel", value)}
        />
        <SelectField
          label="Recommendation ambition"
          value={profile.advice.ambition}
          options={[
            ["", "No preference"],
            ["low_risk", "Low-risk"],
            ["balanced", "Balanced"],
            ["aggressive", "Aggressive"],
          ]}
          onChange={(value) => setField("advice", "ambition", value)}
        />
        <NumberField
          label="Time available for tasks each week (hours)"
          value={profile.advice.hoursPerWeek}
          onChange={(value) => setField("advice", "hoursPerWeek", value)}
        />
        <SelectField
          label="Primary priority"
          value={profile.advice.primaryPriority}
          options={[
            ["", "Select a priority"],
            ["growth", "Growth"],
            ["profitability", "Profitability"],
            ["stability", "Stability"],
            ["saving_time", "Saving time"],
          ]}
          onChange={(value) => setField("advice", "primaryPriority", value)}
        />
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label>
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className="field"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        type="number"
        min={0}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : Number(event.target.value))
        }
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  helper,
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        className="field"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && (
        <span className="mt-1 block text-xs text-slate-500">{helper}</span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChoiceGroup({
  label,
  values,
  options,
  onChange,
  className = "",
}: {
  label: string;
  values: string[];
  options: Array<[string, string]>;
  onChange: (values: string[]) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, text]) => {
          const selected = values.includes(value);
          return (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                selected
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected}
                onChange={() =>
                  onChange(
                    selected
                      ? values.filter((item) => item !== value)
                      : [...values, value],
                  )
                }
              />
              {text}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const value = draft.trim().replace(/,$/, "");
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft("");
  }
  return (
    <div>
      <label>
        <span className="label">
          {label}
          {required ? " *" : ""}
        </span>
        <div className="flex gap-2">
          <input
            className="field"
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add();
              }
            }}
            onBlur={add}
          />
          <button type="button" className="btn-secondary" onClick={add}>
            Add
          </button>
        </div>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
          >
            {value}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-slate-200"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
