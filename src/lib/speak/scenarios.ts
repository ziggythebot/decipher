export type ScenarioMission = {
  /** Key words for this scenario with their English meaning */
  targetWords: { word: string; meaning: string }[];
  /** One-sentence description of the tutor's opening move */
  openingMove: string;
  /** 2–3 starter phrases shown as tappable chips during the call */
  hintChips: string[];
};

export const SCENARIO_MISSIONS: Record<string, ScenarioMission> = {
  road_rage: {
    targetWords: [
      { word: "putain", meaning: "fuck (general expletive)" },
      { word: "casse-toi", meaning: "piss off" },
      { word: "tu me fais chier", meaning: "you're pissing me off" },
      { word: "bordel", meaning: "fucking mess" },
      { word: "calme-toi", meaning: "calm down" },
    ],
    openingMove: "Jean-Pierre is already furious. Try to survive the journey.",
    hintChips: ["Calmez-vous !", "Désolé, désolé…", "Putain, vous avez raison !"],
  },
  struggle_bus: {
    targetWords: [],
    openingMove: "Your tutor will weave your trickiest vocab words into natural conversation so they finally stick.",
    hintChips: ["Je ne sais pas…", "Comment dit-on…?", "Encore une fois ?"],
  },
  ordering_coffee: {
    targetWords: [
      { word: "un café", meaning: "a coffee" },
      { word: "le lait", meaning: "milk" },
      { word: "le sucre", meaning: "sugar" },
      { word: "combien", meaning: "how much" },
      { word: "s'il vous plaît", meaning: "please" },
    ],
    openingMove: "Your tutor is the waiter. They'll greet you and ask what you'd like.",
    hintChips: ["Je voudrais un café…", "C'est combien ?", "Merci beaucoup !"],
  },
  meeting_someone: {
    targetWords: [
      { word: "je m'appelle", meaning: "my name is" },
      { word: "travailler", meaning: "to work" },
      { word: "enchanté(e)", meaning: "nice to meet you" },
      { word: "intéressant", meaning: "interesting" },
      { word: "à bientôt", meaning: "see you soon" },
    ],
    openingMove: "Your tutor will introduce themselves and ask what you do for work.",
    hintChips: ["Je m'appelle…", "Je travaille dans…", "Enchanté(e) !"],
  },
  shopping: {
    targetWords: [
      { word: "je cherche", meaning: "I'm looking for" },
      { word: "combien", meaning: "how much" },
      { word: "acheter", meaning: "to buy" },
      { word: "un kilo", meaning: "one kilogram" },
      { word: "c'est tout", meaning: "that's all" },
    ],
    openingMove: "Your tutor is the market vendor. They'll ask what you're looking for.",
    hintChips: ["Je cherche…", "C'est combien ?", "Je voudrais un kilo…"],
  },
  asking_directions: {
    targetWords: [
      { word: "où est", meaning: "where is" },
      { word: "à gauche", meaning: "to the left" },
      { word: "à droite", meaning: "to the right" },
      { word: "tout droit", meaning: "straight ahead" },
      { word: "près de", meaning: "near" },
    ],
    openingMove: "Your tutor will notice you look lost and offer to help.",
    hintChips: ["Où est… ?", "À gauche ou à droite ?", "Merci !"],
  },
  restaurant: {
    targetWords: [
      { word: "le menu", meaning: "the menu" },
      { word: "je voudrais", meaning: "I would like" },
      { word: "recommander", meaning: "to recommend" },
      { word: "végétarien", meaning: "vegetarian" },
      { word: "l'addition", meaning: "the bill" },
    ],
    openingMove: "Your tutor is the waiter. They'll welcome you and offer the menu.",
    hintChips: ["Je voudrais…", "Qu'est-ce que vous recommandez ?", "L'addition, s'il vous plaît."],
  },
};

export const SPEAK_SCENARIOS = [
  { slug: "struggle_bus", title: "Struggle Bus", desc: "Drill your trickiest words in real conversation." },
  { slug: "ordering_coffee", title: "Ordering Coffee", desc: "Cafe ordering basics and polite requests." },
  { slug: "meeting_someone", title: "Meeting Someone", desc: "Introductions and short networking exchanges." },
  { slug: "shopping", title: "Market Shopping", desc: "Asking prices, quantities, and payment." },
  { slug: "asking_directions", title: "Asking Directions", desc: "Navigation language in city contexts." },
  { slug: "restaurant", title: "Restaurant", desc: "Menu, preferences, and ordering dinner." },
] as const;

export type SpeakScenarioSlug = (typeof SPEAK_SCENARIOS)[number]["slug"];

export const SPEAK_SCENARIO_SLUGS = new Set<string>([
  ...SPEAK_SCENARIOS.map((scenario) => scenario.slug),
  "road_rage",
]);
