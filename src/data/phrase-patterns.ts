export type Drill = {
  context: string;   // English situation
  frame: string;     // French sentence with ___ for the blank
  options: [string, string, string];
  correct: string;
};

export type PhrasePattern = {
  id: string;
  title: string;
  frame: string;        // The pattern template e.g. "Je voudrais ___"
  hook: string;         // One sentence on why this matters
  why: string;          // Slightly more detail
  examples: { fr: string; pronunciation: string; en: string }[];
  drills: Drill[];
};

export const PHRASE_PATTERNS: PhrasePattern[] = [
  {
    id: "je-voudrais",
    title: "Je voudrais ___",
    frame: "Je voudrais ___",
    hook: "The most useful phrase in French — polite, safe, works in every situation.",
    why: "Native speakers use 'je voudrais' (I would like) rather than 'je veux' (I want). It's more polite and less blunt. Master this and you can order, request, and ask for anything.",
    examples: [
      { fr: "Je voudrais un café, s'il vous plaît.", pronunciation: "zhuh voo-dreh uhn kah-fay, seel voo pleh", en: "I would like a coffee, please." },
      { fr: "Je voudrais la carte.", pronunciation: "zhuh voo-dreh lah kart", en: "I would like the menu." },
      { fr: "Je voudrais réserver une table.", pronunciation: "zhuh voo-dreh reh-zehr-vay ewn tahbl", en: "I would like to book a table." },
    ],
    drills: [
      { context: "You want a coffee at a café", frame: "Je voudrais ___, s'il vous plaît.", options: ["un café", "de la table", "au revoir"], correct: "un café" },
      { context: "You want to see the menu", frame: "Je voudrais ___.", options: ["la carte", "le bonjour", "un partir"], correct: "la carte" },
      { context: "You want to book a room", frame: "Je voudrais ___ une chambre.", options: ["réserver", "manger", "trouver"], correct: "réserver" },
      { context: "You want a glass of water", frame: "Je voudrais ___ d'eau, s'il vous plaît.", options: ["un verre", "un pain", "un kilo"], correct: "un verre" },
      { context: "You want to pay", frame: "Je voudrais ___, s'il vous plaît.", options: ["payer", "partir demain", "un taxi"], correct: "payer" },
    ],
  },
  {
    id: "cest",
    title: "C'est ___",
    frame: "C'est ___",
    hook: "Your Swiss army knife for describing and reacting — one phrase, infinite uses.",
    why: "'C'est' (it is / that is) is one of the most frequent phrases in French. Use it to describe things, react to situations, and ask about prices. It sounds natural in almost every context.",
    examples: [
      { fr: "C'est délicieux !", pronunciation: "say day-lee-syuh", en: "That's delicious!" },
      { fr: "C'est combien ?", pronunciation: "say kom-byehn", en: "How much is it?" },
      { fr: "C'est la gare.", pronunciation: "say lah gar", en: "That's the station." },
    ],
    drills: [
      { context: "The food is amazing", frame: "C'est ___!", options: ["délicieux", "bonjour", "chercher"], correct: "délicieux" },
      { context: "You want to know the price", frame: "C'est ___ ?", options: ["combien", "comment", "quand"], correct: "combien" },
      { context: "Pointing out the exit", frame: "C'est ___ sortie.", options: ["la", "le", "les"], correct: "la" },
      { context: "Something is too expensive", frame: "C'est trop ___.", options: ["cher", "bien", "grand"], correct: "cher" },
      { context: "You like what you see", frame: "C'est ___ !", options: ["parfait", "demain", "aller"], correct: "parfait" },
    ],
  },
  {
    id: "jai-besoin",
    title: "J'ai besoin de ___",
    frame: "J'ai besoin de ___",
    hook: "The direct way to say you need something — more urgent than 'je voudrais'.",
    why: "'J'ai besoin de' (I need) is stronger and more direct than 'je voudrais'. Use it when it's not optional — you genuinely need something. Works with nouns ('d'un taxi') and verbs ('d'appeler').",
    examples: [
      { fr: "J'ai besoin d'un taxi.", pronunciation: "zhay buh-zwehn duhn tak-see", en: "I need a taxi." },
      { fr: "J'ai besoin de l'addition.", pronunciation: "zhay buh-zwehn duh lah-dee-syohn", en: "I need the bill." },
      { fr: "J'ai besoin d'aide.", pronunciation: "zhay buh-zwehn dehd", en: "I need help." },
    ],
    drills: [
      { context: "You need a doctor urgently", frame: "J'ai besoin ___ médecin.", options: ["d'un", "de le", "du un"], correct: "d'un" },
      { context: "You need the bill", frame: "J'ai besoin ___ l'addition.", options: ["de", "du", "des"], correct: "de" },
      { context: "You need help", frame: "J'ai besoin ___.", options: ["d'aide", "de aller", "du pain"], correct: "d'aide" },
      { context: "You need to call someone", frame: "J'ai besoin ___ appeler.", options: ["d'", "de la", "du"], correct: "d'" },
      { context: "You need more time", frame: "J'ai besoin de plus de ___.", options: ["temps", "taxi", "table"], correct: "temps" },
    ],
  },
  {
    id: "ou-est",
    title: "Où est ___ ?",
    frame: "Où est ___ ?",
    hook: "Get this one right and you can find anything in any French city.",
    why: "'Où est' (where is) is your navigation essential. Pair it with any place noun and you're set. Note: 'où est' for one thing, 'où sont' for multiple things — but 'où est' covers 90% of what you need.",
    examples: [
      { fr: "Où est la gare ?", pronunciation: "oo ay lah gar", en: "Where is the station?" },
      { fr: "Où est le restaurant ?", pronunciation: "oo ay luh res-toh-rohn", en: "Where is the restaurant?" },
      { fr: "Où est la sortie ?", pronunciation: "oo ay lah sor-tee", en: "Where is the exit?" },
    ],
    drills: [
      { context: "Looking for the station", frame: "Où est ___ gare ?", options: ["la", "le", "les"], correct: "la" },
      { context: "Looking for the nearest pharmacy", frame: "Où est la ___ la plus proche ?", options: ["pharmacie", "sortie", "gare"], correct: "pharmacie" },
      { context: "Looking for the exit", frame: "Où est la ___ ?", options: ["sortie", "entrée", "toilette"], correct: "sortie" },
      { context: "Looking for the hotel", frame: "Où est ___ hôtel ?", options: ["l'", "la", "les"], correct: "l'" },
      { context: "Looking for the toilet", frame: "Où est ___ ?", options: ["la salle de bain", "le menu", "le prix"], correct: "la salle de bain" },
    ],
  },
  {
    id: "est-ce-que",
    title: "Est-ce que vous ___ ?",
    frame: "Est-ce que vous ___ ?",
    hook: "Turn any verb into a polite question. Use with strangers, always safe.",
    why: "'Est-ce que' is the question marker that turns any statement into a yes/no question without changing word order. Add 'vous' (formal you) and you're being appropriately polite with strangers, staff, and anyone you've just met.",
    examples: [
      { fr: "Est-ce que vous avez une table ?", pronunciation: "es-kuh voo zah-vay ewn tahbl", en: "Do you have a table?" },
      { fr: "Est-ce que vous parlez anglais ?", pronunciation: "es-kuh voo par-lay ohn-gleh", en: "Do you speak English?" },
      { fr: "Est-ce que vous acceptez les cartes ?", pronunciation: "es-kuh voo zak-sep-tay lay kart", en: "Do you accept cards?" },
    ],
    drills: [
      { context: "Asking if they speak English", frame: "Est-ce que vous ___ anglais ?", options: ["parlez", "avez", "êtes"], correct: "parlez" },
      { context: "Asking if they have a table", frame: "Est-ce que vous ___ une table ?", options: ["avez", "parlez", "voulez"], correct: "avez" },
      { context: "Asking if they accept cards", frame: "Est-ce que vous ___ les cartes ?", options: ["acceptez", "prenez", "aimez"], correct: "acceptez" },
      { context: "Asking if they have a room", frame: "Est-ce que vous ___ une chambre disponible ?", options: ["avez", "faites", "êtes"], correct: "avez" },
      { context: "Asking if they are open", frame: "Est-ce que vous ___ ouverts ?", options: ["êtes", "avez", "faites"], correct: "êtes" },
    ],
  },
  {
    id: "je-cherche",
    title: "Je cherche ___",
    frame: "Je cherche ___",
    hook: "For shopping, navigating, or finding anything — simple and universally understood.",
    why: "'Je cherche' (I'm looking for) is your go-to when you need something specific. Works in shops, streets, hotels, and markets. Locals know exactly how to respond to it.",
    examples: [
      { fr: "Je cherche la pharmacie.", pronunciation: "zhuh shehrsh lah far-mah-see", en: "I'm looking for the pharmacy." },
      { fr: "Je cherche un hôtel.", pronunciation: "zhuh shehrsh uhn oh-tel", en: "I'm looking for a hotel." },
      { fr: "Je cherche ce produit.", pronunciation: "zhuh shehrsh suh pro-dwee", en: "I'm looking for this product." },
    ],
    drills: [
      { context: "Looking for the pharmacy", frame: "Je cherche ___.", options: ["la pharmacie", "le menu", "l'addition"], correct: "la pharmacie" },
      { context: "Looking for a hotel", frame: "Je cherche ___ hôtel.", options: ["un", "la", "le"], correct: "un" },
      { context: "Looking for the exit", frame: "Je cherche la ___.", options: ["sortie", "carte", "table"], correct: "sortie" },
      { context: "Looking for the market", frame: "Je cherche ___ marché.", options: ["le", "la", "les"], correct: "le" },
      { context: "Looking for a taxi", frame: "Je cherche ___ taxi.", options: ["un", "le", "la"], correct: "un" },
    ],
  },
  {
    id: "pouvez-vous",
    title: "Pouvez-vous ___ ?",
    frame: "Pouvez-vous ___ ?",
    hook: "Polite requests with strangers — more formal than 'peux-tu', exactly right in most situations.",
    why: "'Pouvez-vous' (can you) is the polite form of asking someone to do something. Use it with anyone you've just met: shop staff, waiters, hotel staff, strangers on the street. It's respectful and gets results.",
    examples: [
      { fr: "Pouvez-vous répéter, s'il vous plaît ?", pronunciation: "poo-vay-voo ray-pay-tay, seel voo pleh", en: "Can you repeat, please?" },
      { fr: "Pouvez-vous m'aider ?", pronunciation: "poo-vay-voo meh-day", en: "Can you help me?" },
      { fr: "Pouvez-vous parler plus lentement ?", pronunciation: "poo-vay-voo par-lay ploo lont-mohn", en: "Can you speak more slowly?" },
    ],
    drills: [
      { context: "You didn't understand, ask them to repeat", frame: "Pouvez-vous ___, s'il vous plaît ?", options: ["répéter", "partir", "manger"], correct: "répéter" },
      { context: "You need help", frame: "Pouvez-vous ___ ?", options: ["m'aider", "parler anglais", "répéter"], correct: "m'aider" },
      { context: "They're speaking too fast", frame: "Pouvez-vous parler plus ___ ?", options: ["lentement", "vitement", "doucement"], correct: "lentement" },
      { context: "Ask them to write it down", frame: "Pouvez-vous ___ ça, s'il vous plaît ?", options: ["écrire", "dire", "montrer"], correct: "écrire" },
      { context: "Ask them to show you on the map", frame: "Pouvez-vous me ___ sur la carte ?", options: ["montrer", "donner", "trouver"], correct: "montrer" },
    ],
  },
  {
    id: "il-y-a",
    title: "Il y a ___",
    frame: "Il y a ___",
    hook: "'There is / there are' — essential for describing what exists around you.",
    why: "'Il y a' (there is / there are) doesn't change for singular or plural — same form for everything. It's used constantly to describe surroundings, ask about availability, and express duration ('il y a deux jours' = two days ago).",
    examples: [
      { fr: "Il y a un problème.", pronunciation: "eel ee ah uhn pro-blem", en: "There is a problem." },
      { fr: "Il y a une pharmacie près d'ici ?", pronunciation: "eel ee ah ewn far-mah-see preh dee-see", en: "Is there a pharmacy nearby?" },
      { fr: "Il y a combien de personnes ?", pronunciation: "eel ee ah kom-byehn duh pehr-son", en: "How many people are there?" },
    ],
    drills: [
      { context: "There's a problem", frame: "Il y a ___ problème.", options: ["un", "le", "de"], correct: "un" },
      { context: "Is there a pharmacy near here?", frame: "Il y a ___ pharmacie près d'ici ?", options: ["une", "un", "des"], correct: "une" },
      { context: "How many are there?", frame: "Il y a ___ de personnes ?", options: ["combien", "comment", "quand"], correct: "combien" },
      { context: "There are two options", frame: "Il y a ___ options.", options: ["deux", "beaucoup du", "une"], correct: "deux" },
      { context: "There's no room", frame: "Il n'y a ___ de place.", options: ["pas", "plus", "rien"], correct: "pas" },
    ],
  },
  {
    id: "je-naime-pas",
    title: "Je n'aime pas ___",
    frame: "Je n'aime pas ___",
    hook: "The negation pattern that covers every preference — works with nouns and verbs.",
    why: "French negation wraps the verb: ne...pas around the verb. 'Je n'aime pas' is the model for all negation with 'aimer'. In spoken French, the 'ne' is often dropped ('j'aime pas') — but knowing the full form is essential.",
    examples: [
      { fr: "Je n'aime pas le poisson.", pronunciation: "zhuh nem pah luh pwah-sohn", en: "I don't like fish." },
      { fr: "Je n'aime pas attendre.", pronunciation: "zhuh nem pah ah-tohndr", en: "I don't like waiting." },
      { fr: "Je n'aime pas ça.", pronunciation: "zhuh nem pah sah", en: "I don't like that." },
    ],
    drills: [
      { context: "You don't like fish", frame: "Je n'aime pas ___ poisson.", options: ["le", "un", "du"], correct: "le" },
      { context: "You don't like this dish", frame: "Je n'aime pas ___.", options: ["ça", "le menu", "le prix"], correct: "ça" },
      { context: "You don't like waiting", frame: "Je n'aime pas ___.", options: ["attendre", "manger ici", "partir"], correct: "attendre" },
      { context: "You don't like spicy food", frame: "Je n'aime pas la nourriture ___.", options: ["épicée", "froide", "chaude"], correct: "épicée" },
      { context: "You don't like crowds", frame: "Je n'aime pas ___ foule.", options: ["la", "une", "les"], correct: "la" },
    ],
  },
  {
    id: "je-vais",
    title: "Je vais ___",
    frame: "Je vais ___",
    hook: "The near future — replaces the future tense in 90% of spoken French.",
    why: "In everyday speech, French people use 'aller + infinitive' (je vais manger = I'm going to eat) far more than the actual future tense. Master this and you can talk about anything you're about to do. It's also 'I'm going to [place]' when followed by a location.",
    examples: [
      { fr: "Je vais prendre ça.", pronunciation: "zhuh veh prohndr sah", en: "I'm going to take that." },
      { fr: "Je vais réfléchir.", pronunciation: "zhuh veh ray-flay-sheer", en: "I'm going to think about it." },
      { fr: "Je vais revenir.", pronunciation: "zhuh veh ruh-vuh-neer", en: "I'm going to come back." },
    ],
    drills: [
      { context: "You're going to take this one", frame: "Je vais ___ ça.", options: ["prendre", "vouloir", "avoir"], correct: "prendre" },
      { context: "You need to think about it", frame: "Je vais ___.", options: ["réfléchir", "partir demain", "manger"], correct: "réfléchir" },
      { context: "You'll be right back", frame: "Je vais ___.", options: ["revenir", "rester", "dormir"], correct: "revenir" },
      { context: "You're going to pay now", frame: "Je vais ___ maintenant.", options: ["payer", "partir", "manger"], correct: "payer" },
      { context: "You're going to the station", frame: "Je vais ___ la gare.", options: ["à", "au", "en"], correct: "à" },
    ],
  },
  {
    id: "cest-combien",
    title: "C'est combien ?",
    frame: "C'est combien ___ ?",
    hook: "The most-used shopping phrase — know this and prices are never a mystery.",
    why: "'C'est combien' (how much is it) is your price-checking essential. Extend it with 'pour' (for) to ask about quantities or groups. Works in markets, taxis, restaurants, and everywhere money changes hands.",
    examples: [
      { fr: "C'est combien, s'il vous plaît ?", pronunciation: "say kom-byehn, seel voo pleh", en: "How much is it, please?" },
      { fr: "C'est combien pour deux personnes ?", pronunciation: "say kom-byehn poor duh pehr-son", en: "How much for two people?" },
      { fr: "C'est combien le kilo ?", pronunciation: "say kom-byehn luh kee-lo", en: "How much per kilo?" },
    ],
    drills: [
      { context: "Asking the price of something", frame: "C'est ___, s'il vous plaît ?", options: ["combien", "comment", "quand"], correct: "combien" },
      { context: "Asking price for two people", frame: "C'est combien ___ deux personnes ?", options: ["pour", "avec", "de"], correct: "pour" },
      { context: "Asking price per kilo", frame: "C'est combien ___ kilo ?", options: ["le", "un", "par"], correct: "le" },
      { context: "Asking price for a taxi ride", frame: "C'est combien ___ aller à l'aéroport ?", options: ["pour", "de", "à"], correct: "pour" },
      { context: "Asking the total", frame: "C'est combien ___ total ?", options: ["au", "en", "le"], correct: "au" },
    ],
  },
  {
    id: "je-peux",
    title: "Je peux ___ ?",
    frame: "Je peux ___ ?",
    hook: "Asking permission or offering help — works in both directions.",
    why: "'Je peux' (can I / may I) is the informal but completely acceptable way to ask permission. Slightly less formal than 'puis-je' (may I) which sounds stiff in everyday speech. Use 'je peux' with shopkeepers, friends, and most situations.",
    examples: [
      { fr: "Je peux voir ça ?", pronunciation: "zhuh puh vwahr sah", en: "Can I see that?" },
      { fr: "Je peux payer par carte ?", pronunciation: "zhuh puh pay-ay par kart", en: "Can I pay by card?" },
      { fr: "Je peux m'asseoir ici ?", pronunciation: "zhuh puh mah-swahr ee-see", en: "Can I sit here?" },
    ],
    drills: [
      { context: "Asking to see an item in a shop", frame: "Je peux ___ ça ?", options: ["voir", "prendre", "avoir"], correct: "voir" },
      { context: "Asking if you can pay by card", frame: "Je peux payer ___ carte ?", options: ["par", "avec la", "en"], correct: "par" },
      { context: "Asking to sit down", frame: "Je peux ___ ici ?", options: ["m'asseoir", "manger", "partir"], correct: "m'asseoir" },
      { context: "Asking to try something on", frame: "Je peux ___ ça ?", options: ["essayer", "garder", "acheter"], correct: "essayer" },
      { context: "Asking to take a photo", frame: "Je peux ___ une photo ?", options: ["prendre", "faire", "avoir"], correct: "prendre" },
    ],
  },
  {
    id: "on-peut",
    title: "On peut ___ ?",
    frame: "On peut ___ ?",
    hook: "Suggesting activities or asking what's possible — 'on' is informal 'we'.",
    why: "In spoken French, 'on' (one / we) is used constantly instead of 'nous'. 'On peut' (can we / is it possible to) is how you suggest things or ask about options. More natural than 'nous pouvons' in most contexts.",
    examples: [
      { fr: "On peut manger ici ?", pronunciation: "ohn puh mohn-zhay ee-see", en: "Can we eat here?" },
      { fr: "On peut voir le menu ?", pronunciation: "ohn puh vwahr luh muh-new", en: "Can we see the menu?" },
      { fr: "On peut réserver ?", pronunciation: "ohn puh ray-zehr-vay", en: "Can we book?" },
    ],
    drills: [
      { context: "Asking if you can eat here", frame: "On peut ___ ici ?", options: ["manger", "dormir", "partir"], correct: "manger" },
      { context: "Asking to see the menu", frame: "On peut voir ___ menu ?", options: ["le", "un", "la"], correct: "le" },
      { context: "Asking if you can book", frame: "On peut ___ ?", options: ["réserver", "commander", "payer"], correct: "réserver" },
      { context: "Asking if you can sit outside", frame: "On peut s'asseoir ___ ?", options: ["dehors", "ici", "là-bas"], correct: "dehors" },
      { context: "Asking if you can share a taxi", frame: "On peut ___ un taxi ?", options: ["partager", "prendre", "avoir"], correct: "partager" },
    ],
  },
  {
    id: "quest-ce-que",
    title: "Qu'est-ce que ___ ?",
    frame: "Qu'est-ce que ___ ?",
    hook: "Open questions — what is this, what do you have, what do you recommend.",
    why: "'Qu'est-ce que' (what is) is the most common open question structure in French. Unlike the grammar-heavy inversion form ('Que mangez-vous?'), 'qu'est-ce que' just tacks onto the front of a normal sentence — so you don't need to rearrange anything.",
    examples: [
      { fr: "Qu'est-ce que c'est ?", pronunciation: "kes-kuh say", en: "What is this?" },
      { fr: "Qu'est-ce que vous recommandez ?", pronunciation: "kes-kuh voo ruh-ko-mohn-day", en: "What do you recommend?" },
      { fr: "Qu'est-ce que vous avez comme desserts ?", pronunciation: "kes-kuh voo zah-vay kom day-sehr", en: "What desserts do you have?" },
    ],
    drills: [
      { context: "Pointing at something unknown", frame: "Qu'est-ce que ___?", options: ["c'est", "vous avez", "il y a"], correct: "c'est" },
      { context: "Asking for a recommendation", frame: "Qu'est-ce que vous ___ ?", options: ["recommandez", "avez", "faites"], correct: "recommandez" },
      { context: "Asking what they have for dessert", frame: "Qu'est-ce que vous avez ___ desserts ?", options: ["comme", "pour", "en"], correct: "comme" },
      { context: "Asking what's in the dish", frame: "Qu'est-ce qu'___ dans ce plat ?", options: ["il y a", "c'est", "vous avez"], correct: "il y a" },
      { context: "Asking what they have to drink", frame: "Qu'est-ce que vous avez ___ boissons ?", options: ["comme", "pour", "en"], correct: "comme" },
    ],
  },
  {
    id: "comment-dit-on",
    title: "Comment dit-on ___ ?",
    frame: "Comment dit-on ___ ?",
    hook: "Meta-language survival — ask how to say anything and locals will always help.",
    why: "'Comment dit-on' (how do you say) is your emergency phrase for when you don't know a word. Locals find it endearing when you try to use their language and ask for help. It shows effort and gets you the word you need.",
    examples: [
      { fr: "Comment dit-on 'bill' en français ?", pronunciation: "ko-mohn dee-tohn 'bill' ohn frohn-seh", en: "How do you say 'bill' in French?" },
      { fr: "Comment dit-on ça ?", pronunciation: "ko-mohn dee-tohn sah", en: "How do you say that?" },
      { fr: "Comment dit-on 'gluten-free' en français ?", pronunciation: "ko-mohn dee-tohn 'gluten-free' ohn frohn-seh", en: "How do you say 'gluten-free' in French?" },
    ],
    drills: [
      { context: "You don't know the word for 'bill'", frame: "Comment dit-on 'bill' ___ français ?", options: ["en", "au", "par"], correct: "en" },
      { context: "Pointing at something, asking what it's called", frame: "Comment dit-on ___ ?", options: ["ça", "ce", "cela"], correct: "ça" },
      { context: "Asking how to say 'thank you'", frame: "Comment dit-on 'thank you' ___ français ?", options: ["en", "au", "par"], correct: "en" },
      { context: "You forgot the word for 'station'", frame: "Comment dit-on ___ en français ?", options: ["'station'", "merci", "bonjour"], correct: "'station'" },
      { context: "Asking for the right way to say something", frame: "Comment ___ ça en français ?", options: ["dit-on", "parle-on", "faire-on"], correct: "dit-on" },
    ],
  },
];

export const PHRASE_PATTERN_IDS = PHRASE_PATTERNS.map((p) => p.id);

export function getPhrasePattern(id: string): PhrasePattern | undefined {
  return PHRASE_PATTERNS.find((p) => p.id === id);
}
