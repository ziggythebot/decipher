// The Deconstruction Dozen — 12 sentences that unlock French grammar
// Based on Tim Ferriss's DiSSS methodology

export type DeconstructionSentence = {
  rank: number;
  english: string;
  french: string;
  pronunciation: string;
  patternRevealed: string;
  englishNotes: string;
};

export const FRENCH_DECONSTRUCTION_DOZEN: DeconstructionSentence[] = [
  {
    rank: 1,
    english: "The apple is red.",
    french: "La pomme est rouge.",
    pronunciation: "La pom ay roozh",
    patternRevealed: "Basic sentence structure (SVO)",
    englishNotes: "French is SVO like English — Subject-Verb-Object. Adjectives usually come AFTER the noun in French (rouge comes after pomme, not before).",
  },
  {
    rank: 2,
    english: "It is John's apple.",
    french: "C'est la pomme de Jean.",
    pronunciation: "Say la pom duh Zhon",
    patternRevealed: "Possessives — no apostrophe-S in French",
    englishNotes: "French has no 's for possession. Instead: [thing] + de + [owner]. 'John's apple' = 'the apple of John' (la pomme de Jean).",
  },
  {
    rank: 3,
    english: "I give John the apple.",
    french: "Je donne la pomme à Jean.",
    pronunciation: "Zhuh don la pom ah Zhon",
    patternRevealed: "Direct and indirect objects",
    englishNotes: "Direct object (la pomme) comes before the verb less often than in English. Indirect object marked with 'à' (to). Word order can shift with pronouns.",
  },
  {
    rank: 4,
    english: "We give him the apple.",
    french: "Nous lui donnons la pomme.",
    pronunciation: "Noo lwee doh-non la pom",
    patternRevealed: "Object pronouns (lui = him/her indirect)",
    englishNotes: "'Lui' = him OR her (indirect). Object pronouns come BEFORE the verb in French (lui donnons, not donnons lui). This is the opposite of English.",
  },
  {
    rank: 5,
    english: "He gives it to John.",
    french: "Il la donne à Jean.",
    pronunciation: "Eel la don ah Zhon",
    patternRevealed: "Direct object pronoun placement",
    englishNotes: "'La' replaces 'la pomme' (the apple, feminine). Direct object pronouns also go before the verb. La/le/les replace the noun based on gender.",
  },
  {
    rank: 6,
    english: "She gives it to him.",
    french: "Elle la lui donne.",
    pronunciation: "El la lwee don",
    patternRevealed: "Double pronouns — order is always: [direct] before [indirect]",
    englishNotes: "When you have two object pronouns, order is fixed: me/te/le/la/nous/vous THEN lui/leur. Always before the verb.",
  },
  {
    rank: 7,
    english: "Is the apple red?",
    french: "La pomme est-elle rouge?",
    pronunciation: "La pom ay-tel roozh?",
    patternRevealed: "Question formation (inversion)",
    englishNotes: "Formal questions: invert verb and subject pronoun, add hyphen. But in everyday speech, just raise your intonation: 'La pomme est rouge?' — or use 'Est-ce que': 'Est-ce que la pomme est rouge?'",
  },
  {
    rank: 8,
    english: "The apples are red.",
    french: "Les pommes sont rouges.",
    pronunciation: "Lay pom son roozh",
    patternRevealed: "Plural — adjectives and articles agree in number",
    englishNotes: "Both the article (les) and adjective (rouges) take plural form. Nouns add -s but it's usually silent. 'Les' marks plural; the -s on rouges is silent too.",
  },
  {
    rank: 9,
    english: "I must give it to him.",
    french: "Je dois la lui donner.",
    pronunciation: "Zhuh dwa la lwee doh-nay",
    patternRevealed: "Modal verbs (devoir = must/have to)",
    englishNotes: "Modal verbs (devoir=must, pouvoir=can, vouloir=want) + infinitive. The object pronouns still go before the main verb (la lui donner, not donner la lui).",
  },
  {
    rank: 10,
    english: "I want to give it to her.",
    french: "Je veux la lui donner.",
    pronunciation: "Zhuh vuh la lwee doh-nay",
    patternRevealed: "Vouloir (to want) + infinitive",
    englishNotes: "Vouloir conjugates, then infinitive follows unchanged. 'lui' is gender-neutral for indirect objects — works for both him and her.",
  },
  {
    rank: 11,
    english: "I'm going to know tomorrow.",
    french: "Je vais savoir demain.",
    pronunciation: "Zhuh vay sah-vwar duh-man",
    patternRevealed: "Near future tense (aller + infinitive)",
    englishNotes: "Near future: aller (conjugated) + infinitive. Used more often than formal future tense in everyday speech. 'Savoir' = to know facts/information (vs connaître = to know people/places).",
  },
  {
    rank: 12,
    english: "I can't eat the apple.",
    french: "Je ne peux pas manger la pomme.",
    pronunciation: "Zhuh nuh puh pa mon-zhay la pom",
    patternRevealed: "Negation (ne...pas sandwich) + pouvoir (can)",
    englishNotes: "Negation wraps the conjugated verb: ne [verb] pas. The 'ne' is often dropped in casual speech: 'Je peux pas'. Pouvoir = can/be able to.",
  },
];
