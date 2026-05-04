"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Idea = {
  title:      string;
  category:   string;
  potential:  string;
  effort:     "Low" | "Medium" | "High";
  timeline:   string;
  description:string;
  tools:      string;
};

const IDEAS: Idea[] = [
  // ── Invest ──────────────────────────────────────────────────────
  {
    title:       "ETF / Index Funds",
    category:    "Invest",
    potential:   "7–10% / year",
    effort:      "Low",
    timeline:    "Ongoing",
    description: "Put a fixed % of monthly savings into a low-cost global ETF (MSCI World, S&P 500). Compounding over 5–10 years is the highest ROI per hour of effort of any strategy here. XTB and Degiro are available in Poland.",
    tools:       "XTB · Degiro · Finax",
  },
  {
    title:       "Polish Treasury Bonds",
    category:    "Invest",
    potential:   "6–8% / year",
    effort:      "Low",
    timeline:    "1–4 years",
    description: "EDO (10-year inflation-linked) or COI (4-year) bonds issued by the Polish government. Inflation protection, state-backed, no broker fees. Good for the PLN portion you want to keep safe.",
    tools:       "obligacjeskarbowe.pl",
  },
  {
    title:       "Real Estate Crowdfunding",
    category:    "Invest",
    potential:   "8–14% / year",
    effort:      "Low",
    timeline:    "1–5 years",
    description: "Invest in property projects with as little as €50. Platforms pool capital for residential or commercial builds; you earn interest or a share of sale proceeds. Illiquid — treat as 2–5 year money.",
    tools:       "Estateguru · Crowdway · Ista Capital",
  },
  // ── Build ────────────────────────────────────────────────────────
  {
    title:       "Micro-SaaS",
    category:    "Build",
    potential:   "$200–3 000 / mo",
    effort:      "High",
    timeline:    "2–6 months",
    description: "Pick one painful niche problem (invoice automation, time tracking, niche API wrapper) and ship the simplest version. Charge $9–$49/mo. Even 30 paying customers cover a month of expenses. This is the highest upside path for a developer.",
    tools:       "Next.js · Stripe · Lemon Squeezy",
  },
  {
    title:       "Chrome / Browser Extension",
    category:    "Build",
    potential:   "$100–2 000 / mo",
    effort:      "Medium",
    timeline:    "3–8 weeks",
    description: "Extensions solve micro-problems at the browser layer — tab management, AI writing helpers, page scrapers. Distribution is free (Chrome Web Store). Monetise with a one-time purchase or a simple subscription via Paddle.",
    tools:       "Plasmo · WXT · Paddle",
  },
  {
    title:       "API Product on RapidAPI",
    category:    "Build",
    potential:   "$50–1 500 / mo",
    effort:      "Medium",
    timeline:    "2–6 weeks",
    description: "Wrap a useful computation (text extraction, currency conversion, geocoding, NLP) as a REST API. List on RapidAPI or APILayer. Usage-based billing means revenue scales with customers without you doing anything.",
    tools:       "FastAPI · RapidAPI · APILayer",
  },
  {
    title:       "Digital Templates & Tools",
    category:    "Build",
    potential:   "$100–1 500 / mo",
    effort:      "Low",
    timeline:    "1–3 weeks",
    description: "Notion dashboards, Figma UI kits, spreadsheet finance trackers — anything a professional buys to save time. Create once, sell forever. Your SpendWisely data model could literally become a Notion template someone pays for.",
    tools:       "Gumroad · Lemon Squeezy · Notion",
  },
  // ── Freelance leverage ───────────────────────────────────────────
  {
    title:       "Raise Your Rate 30%",
    category:    "Freelance",
    potential:   "+30% income",
    effort:      "Low",
    timeline:    "Immediate",
    description: "Most freelancers undercharge. A 30% rate increase loses ~15% of clients but net income stays flat or rises — and you work less. Present as annual review. If your current clients say yes, your rate was too low.",
    tools:       "Just ask",
  },
  {
    title:       "Productised Service",
    category:    "Freelance",
    potential:   "$500–5 000 / mo",
    effort:      "Medium",
    timeline:    "2–8 weeks",
    description: "Package your most repeatable client work into a fixed-scope, fixed-price product: 'Landing page in 5 days for $800', 'Code review sprint for $300'. Sell it on your website or Contra. Predictable revenue, no scope creep.",
    tools:       "Contra · Toptal · Personal site",
  },
  // ── Content ──────────────────────────────────────────────────────
  {
    title:       "Technical Newsletter",
    category:    "Content",
    potential:   "$500–5 000 / mo",
    effort:      "Medium",
    timeline:    "6–18 months",
    description: "Write about what you already know — dev tools, finance automation, freelance strategy. At 5k subscribers: tool sponsorships pay $300–800/issue. At 10k: $1 000–2 000/issue. Beehiiv has a built-in ad network.",
    tools:       "Beehiiv · Substack · ConvertKit",
  },
  {
    title:       "Technical YouTube",
    category:    "Content",
    potential:   "$500–8 000 / mo",
    effort:      "High",
    timeline:    "9–18 months",
    description: "Dev tutorials, tool comparisons, build-in-public. Monetises via ads, sponsorships, and course sales. Long runway but the asset compounds — old videos keep earning. 20k subscribers is typically the inflection point.",
    tools:       "YouTube · Descript · Sponsorkit",
  },
  // ── Passive ──────────────────────────────────────────────────────
  {
    title:       "Marketplace Code Assets",
    category:    "Passive",
    potential:   "$50–800 / mo",
    effort:      "Medium",
    timeline:    "Ongoing",
    description: "Sell themes, plugins, boilerplates or code snippets on Envato, CodeCanyon or Gumroad. One solid Next.js starter kit or admin template can earn $200–500/mo indefinitely after launch.",
    tools:       "Envato · CodeCanyon · Gumroad",
  },
  {
    title:       "P2P Lending",
    category:    "Passive",
    potential:   "8–14% / year",
    effort:      "Low",
    timeline:    "Ongoing",
    description: "Lend to businesses or consumers through platforms with buyback guarantees. Higher risk than bonds, higher yield. Diversify across 50+ loans. Mintos and PeerBerry are both accessible from Poland.",
    tools:       "Mintos · PeerBerry",
  },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Invest:    { bg: "oklch(0.95 0.05 148)", text: "oklch(0.44 0.165 158)" },
  Build:     { bg: "oklch(0.95 0.05 265)", text: "oklch(0.40 0.175 265)" },
  Freelance: { bg: "oklch(0.95 0.05 90)",  text: "oklch(0.55 0.170 70)"  },
  Content:   { bg: "oklch(0.95 0.05 300)", text: "oklch(0.50 0.185 300)" },
  Passive:   { bg: "oklch(0.95 0.04 75)",  text: "oklch(0.45 0.015 255)" },
};

const EFFORT_DOT: Record<string, string> = {
  Low:    "oklch(0.62 0.175 148)",
  Medium: "oklch(0.70 0.145 90)",
  High:   "oklch(0.56 0.200 25)",
};

const CATEGORIES = ["Invest", "Build", "Freelance", "Content", "Passive"];

export function EarnTab() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Ranked by effort-to-return ratio. As a self-employed developer with consistent income,
          the fastest lever is usually a mix of <strong>investing surplus</strong> and
          one <strong>build project</strong> that earns while you sleep.
        </p>
      </div>

      {CATEGORIES.map((cat) => {
        const ideas = IDEAS.filter((i) => i.category === cat);
        const colors = CATEGORY_COLORS[cat];
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: colors.bg, color: colors.text }}
              >
                {cat}
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ideas.map((idea) => (
                <Card key={idea.title} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-[15px] leading-snug">{idea.title}</CardTitle>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold tabular-nums" style={{ color: colors.text }}>
                          {idea.potential}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{idea.timeline}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {idea.description}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-muted-foreground">{idea.tools}</p>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: EFFORT_DOT[idea.effort] }}
                        />
                        <span className="text-[11px] text-muted-foreground">{idea.effort} effort</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
