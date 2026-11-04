/**
 * Which Riftbound cards a player should watch for in a combat.
 *
 * First researched from api.riftcodex.com (Origins through Vendetta), then
 * completed in November 2026 against every card's rules text on the League
 * wiki — the source `npm run sync:cards` uses, which also has the newest set.
 * The wiki tags each card's timing ([Action]/[Reaction]) and effects
 * (Modifier, Kill, Stun, Shield, Nonstandard Movement, …), so the pass was:
 * every timed card with a combat effect, then the criteria below by hand.
 *
 * A combat trick is a card with [Action] or [Reaction] timing — on the card,
 * or on an ability of a unit or gear — whose effect can change how a combat
 * goes: Might up or down, damage, kills, stuns, Shield/Tank/Assault, damage
 * or death prevention, moving or bouncing units, adding units to the fight,
 * stealing a unit, or removing the Equipment a unit is wearing. Pure counters,
 * card draw, rune/energy abilities, and effects that only reach the base
 * (tokens, recursion) are left out, as are Legends' abilities: a Legend is
 * always face up on the table, so it is never a surprise.
 *
 * Hidden cards are those with the [Hidden] keyword themselves, not cards that
 * merely refer to it. A card can be both.
 */

import type { DeckCard } from "./types";

export type Speed = "action" | "reaction";

export const COMBAT_TRICKS: Record<string, Speed> = {
  "Against the Odds": "reaction",
  "Alpha Strike": "action",
  "An Offer You Can't Refuse": "action",
  "Angle Shot": "reaction",
  "Arcane Shift": "action",
  "Azir, Ascendant": "action",
  "Back Off": "action",
  "Back to Back": "reaction",
  "Battle Preparations": "reaction",
  "Bellows Breath": "action",
  "Blast of Power": "action",
  "Block": "action",
  "Blood Money": "action",
  "Blood Rush": "action",
  "Bonds of Strength": "reaction",
  "Brawl": "action",
  "Bullet Time": "action",
  "Call to Glory": "reaction",
  "Cannon Barrage": "reaction",
  "Challenge": "action",
  "Cleave": "action",
  "Combat Experience": "reaction",
  "Consult the Heavens": "reaction",
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
  "Discipline": "reaction",
  "Disintegrate": "action",
  "Divining Shells": "action",
  "Dominus": "action",
  "Drag Under": "action",
  "Eclipse": "reaction",
  "Ekko, Revolutionary": "action",
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
  "For Demacia!": "reaction",
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
  "High Note": "reaction",
  "Highlander": "reaction",
  "Hold 'Em": "action",
  "Imperial Decree": "action",
  "Improvised Projectile": "action",
  "Incinerate": "action",
  "Janna, Savior": "reaction",
  "Keeper's Verdict": "action",
  "Ki Barrier": "reaction",
  "Ki Burst": "action",
  "Last Breath": "action",
  "Last Caress": "reaction",
  "Last Stand": "action",
  "Lost to the Sands": "action",
  "Lotus Trap": "reaction",
  "Marching Orders": "action",
  "Mesmerize": "reaction",
  "Monster Harpoon": "action",
  "Moonfall": "action",
  "Moonlight Affliction": "reaction",
  "Noxian Guillotine": "action",
  "Ntofo Strikes": "action",
  "One-Two Punch": "action",
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
  "Satchel Charge": "action",
  "Scorched Earth": "action",
  "Shadow": "action",
  "Shakedown": "reaction",
  "Shen, Kinkou": "reaction",
  "Shock Blast": "action",
  "Siphon Power": "reaction",
  "Siren's Song": "reaction",
  "Sky Splitter": "action",
  "Smite": "action",
  "Smoke and Mirrors": "action",
  "Smoke Screen": "reaction",
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
  "Ava Achiever",
  "Back Off",
  "Bedeviling Stranger",
  "Blastcone Fae",
  "Block",
  "Bone Skewer",
  "Bushwhack",
  "Consult the Past",
  "Demon Shade",
  "Disciple of Shen",
  "Edge of Night",
  "Elnuk Herd",
  "Ember Monk",
  "Emperor's Divide",
  "Evelynn, Entrancing",
  "Facebreaker",
  "Fight or Flight",
  "Fox-Fire",
  "Guards!",
  "Guerilla Warfare",
  "Gutter Guardian",
  "Here to Help",
  "Hidden Blade",
  "Hostile Takeover",
  "Keeper of Masks",
  "Kennen, Keeper of Balance",
  "Lotus Trap",
  "Mischievous Marai",
  "Momentary Companion",
  "Noxus Saboteur",
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
  "Teemo, Swift Scout",
  "Temporal Breach",
  "The Waters' Wage",
  "Tideturner",
  "Tornado Warrior",
  "Wages of Pain",
  "Windsinger",
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
