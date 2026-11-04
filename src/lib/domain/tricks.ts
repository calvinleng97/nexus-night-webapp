/**
 * Which Riftbound cards a player should watch for in a combat.
 *
 * Researched from the full card pool (Origins through Vendetta, plus promos
 * and Proving Grounds) as listed by api.riftcodex.com, November 2026.
 *
 * A combat trick is a card with [Action] or [Reaction] timing — on the card,
 * or on an ability of a unit or gear — whose effect can change how a combat
 * goes: Might up or down, damage, kills, stuns, Shield/Tank/Assault, damage
 * or death prevention, moving or bouncing units, adding units to the fight,
 * stealing a unit, or removing the Equipment a unit is wearing. Pure counters,
 * card draw, rune/energy abilities, and effects that only reach the base
 * (tokens, recursion) are left out.
 *
 * Hidden cards are those with the [Hidden] keyword themselves, not cards that
 * merely refer to it. A card can be both.
 */

import type { DeckCard } from "./types";

export type Speed = "action" | "reaction";

export const COMBAT_TRICKS: Record<string, Speed> = {
  "Against the Odds": "reaction",
  "Alpha Strike": "action",
  "Angle Shot": "reaction",
  "Arcane Shift": "action",
  "Azir, Ascendant": "action",
  "Back Off": "action",
  "Back to Back": "reaction",
  "Bellows Breath": "action",
  "Blast of Power": "action",
  "Block": "action",
  "Blood Money": "action",
  "Blood Rush": "action",
  "Bonds of Strength": "reaction",
  "Bullet Time": "action",
  "Call to Glory": "reaction",
  "Cannon Barrage": "reaction",
  "Challenge": "action",
  "Cleave": "action",
  "Combat Experience": "reaction",
  "Consuming Curse": "action",
  "Convergent Mutation": "reaction",
  "Counter Strike": "reaction",
  "Crescent Strike": "action",
  "Danger Zone": "reaction",
  "Deathgrip": "reaction",
  "Decisive Strike": "action",
  "Decree of Focus": "reaction",
  "Decree of Insight": "reaction",
  "Decree of Rage": "action",
  "Defiant Dance": "reaction",
  "Disintegrate": "action",
  "Divining Shells": "action",
  "Dominus": "action",
  "Drag Under": "action",
  "Eclipse": "reaction",
  "Emperor's Divide": "action",
  "En Garde": "reaction",
  "Existential Dread": "action",
  "Ezreal, Dashing": "action",
  "Facebreaker": "action",
  "Factory Recall": "action",
  "Falling Comet": "action",
  "Feral Strength": "reaction",
  "Fight or Flight": "action",
  "Final Spark": "action",
  "Flash": "reaction",
  "Flurry of Blades": "reaction",
  "Forgotten Signpost": "action",
  "Fox-Fire": "action",
  "Friendship": "reaction",
  "Frigid Touch": "reaction",
  "Gentlemen's Duel": "action",
  "Get Excited!": "action",
  "Grand Strategem": "action",
  "Grim Resolve": "action",
  "Gust": "reaction",
  "Guttural Roar": "action",
  "Here to Help": "action",
  "Heroic Charge": "action",
  "Hextech Ray": "action",
  "Hidden Blade": "action",
  "Highlander": "reaction",
  "Imperial Decree": "action",
  "Incinerate": "action",
  "Janna, Savior": "reaction",
  "Keeper's Verdict": "action",
  "Ki Barrier": "reaction",
  "Last Breath": "action",
  "Last Stand": "action",
  "Lotus Trap": "reaction",
  "Marching Orders": "action",
  "Mesmerize": "reaction",
  "Monster Harpoon": "action",
  "Moonfall": "action",
  "Moonlight Affliction": "reaction",
  "Noxian Guillotine": "action",
  "Overt Operation": "action",
  "Portal Rescue": "action",
  "Possession": "action",
  "Primal Strength": "action",
  "Punch First": "action",
  "Rebuke": "action",
  "Relentless Pursuit": "action",
  "Rengar, Pouncing": "reaction",
  "Resonating Strike": "reaction",
  "Retreat": "reaction",
  "Ride The Wind": "action",
  "Riposte": "reaction",
  "Rune Prison": "action",
  "Ruthless Strike": "action",
  "Salvage": "action",
  "Shadow": "action",
  "Shakedown": "reaction",
  "Shen, Kinkou": "reaction",
  "Shock Blast": "action",
  "Siphon Power": "reaction",
  "Sky Splitter": "action",
  "Smite": "action",
  "Smoke Screen": "reaction",
  "Smoke and Mirrors": "action",
  "Stand United": "action",
  "Star-Crossed": "reaction",
  "Stupefy": "reaction",
  "Sudden Storm": "action",
  "Switcheroo": "action",
  "Tactical Retreat": "reaction",
  "Thermo Beam": "action",
  "Thrill of the Hunt": "reaction",
  "Thwonk!": "action",
  "Unyielding Spirit": "reaction",
  "Vault Breaker": "action",
  "Void Seeker": "action",
  "Wages of Pain": "action",
  "Wind and Ghosts": "action",
  "Zed, Without a Sound": "action",
  "Zenith Blade": "action",
};

export const HIDDEN_CARDS: readonly string[] = [
  "Back Off",
  "Blastcone Fae",
  "Block",
  "Bone Skewer",
  "Bushwhack",
  "Consult the Past",
  "Disciple of Shen",
  "Edge of Night",
  "Emperor's Divide",
  "Evelynn, Entrancing",
  "Facebreaker",
  "Fight or Flight",
  "Fox-Fire",
  "Guards!",
  "Here to Help",
  "Hidden Blade",
  "Hostile Takeover",
  "Keeper of Masks",
  "Kennen, Keeper of Balance",
  "Lotus Trap",
  "Mischievous Marai",
  "Pakaa Cub",
  "Pyke, Dockside Butcher",
  "Pyke, Returned",
  "Resonating Strike",
  "Smoke and Mirrors",
  "Spiderling",
  "Sprite Call",
  "Stand United",
  "Sudden Storm",
  "Switcheroo",
  "Teemo, Scout",
  "Teemo, Strategist",
  "Temporal Breach",
  "Tideturner",
  "Tornado Warrior",
  "Wages of Pain",
  "Zhonya's Hourglass",
];

/**
 * Decklists and the card database disagree on punctuation — "Azir, Ascendant"
 * vs "Azir - Ascendant", "Get Excited" vs "Get Excited!" — so names are
 * compared by their letters and digits alone.
 */
export function cardKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TRICK_SPEED = new Map(Object.entries(COMBAT_TRICKS).map(([n, s]) => [cardKey(n), s]));
const HIDDEN = new Set(HIDDEN_CARDS.map(cardKey));

export interface WatchCard extends DeckCard {
  /** Only in the sideboard, so it may not be in the deck this game. */
  sideboard: boolean;
  speed?: Speed;
}

interface DeckLike {
  champions?: DeckCard[];
  mainDeck?: DeckCard[];
  sideboard?: DeckCard[];
}

/** A deck's combat tricks and Hidden cards, deck cards before sideboard ones. */
export function deckWatchlist(deck: DeckLike): { tricks: WatchCard[]; hidden: WatchCard[] } {
  const tricks: WatchCard[] = [];
  const hidden: WatchCard[] = [];
  const sources: [DeckCard[], boolean][] = [
    [deck.champions ?? [], false],
    [deck.mainDeck ?? [], false],
    [deck.sideboard ?? [], true],
  ];
  for (const [cards, sideboard] of sources)
    for (const c of cards) {
      const key = cardKey(c.name);
      const speed = TRICK_SPEED.get(key);
      if (speed) tricks.push({ ...c, sideboard, speed });
      if (HIDDEN.has(key)) hidden.push({ ...c, sideboard });
    }
  return { tricks, hidden };
}
