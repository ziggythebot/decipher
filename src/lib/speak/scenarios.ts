export const SPEAK_SCENARIOS = [
  { slug: "ordering_coffee", title: "Ordering Coffee", desc: "Cafe ordering basics and polite requests." },
  { slug: "meeting_someone", title: "Meeting Someone", desc: "Introductions and short networking exchanges." },
  { slug: "shopping", title: "Market Shopping", desc: "Asking prices, quantities, and payment." },
  { slug: "asking_directions", title: "Asking Directions", desc: "Navigation language in city contexts." },
  { slug: "restaurant", title: "Restaurant", desc: "Menu, preferences, and ordering dinner." },
] as const;

export type SpeakScenarioSlug = (typeof SPEAK_SCENARIOS)[number]["slug"];

export const SPEAK_SCENARIO_SLUGS = new Set<string>(
  SPEAK_SCENARIOS.map((scenario) => scenario.slug)
);
