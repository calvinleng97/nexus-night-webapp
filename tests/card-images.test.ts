import { describe, expect, it } from "vitest";
import { CARD_FILES, cardImage } from "@/lib/domain/card-images";
import { parseDecklist } from "@/lib/domain/deck";

/** Real lists from the group, covering Origins through the newest set. */
const LISTS: Record<string, string> = {
  azir: `Legend:
1 Azir, Emperor of the Sands

Champion:
1 Azir, Sovereign

MainDeck:
3 Arise!
3 B.F. Sword
1 Back Off
3 Brutalizer
1 Charm
2 Deathgrip
3 Defy
3 Discipline
3 Doran's Shield
1 Emperor's Divide
1 En Garde
3 Eye of the Herald
2 Guards!
1 Hand Hammer
3 Hidden Blade
1 Kennen, Keeper of Balance
3 Soul Sword
2 Vi, Peacekeeper

Battlefields:
1 Hall of Legends
1 Seat of Power
1 Trifarian War Camp

Runes:
6 Calm Rune
6 Order Rune

Sideboard:
2 Cull the Weak
1 Decree of Focus
2 Decree of Unity
1 Hand Hammer
1 Not So Fast
1 Sacred Shears
1 Salvage
1 Tomb-Raider Barbara`,
  rumble: `Legend:
1 Rumble, Mechanized Menace

Champion:
1 Rumble, Hotheaded

MainDeck:
1 Bellows Breath
2 Brynhir Thundersong
3 Bubble Bot
2 Cleave
1 Cloth Armor
2 Deadly Flourish
1 Eclipse
2 Falling Star
2 Ferrous Forerunner
3 Forecaster
3 Gem Jammer
2 Patched Porobot
3 Production Surge
1 Rumble, Hotheaded
2 Singularity
3 Stupefy
3 Temporal Breach
3 Thousand-Tailed Watcher

Battlefields:
1 Frozen Fortress
1 Rockfall Path
1 Void Gate

Runes:
5 Fury Rune
7 Mind Rune

Sideboard:
1 Against the Odds
1 Bellows Breath
2 Brittle Steel
1 Brynhir Thundersong
2 Decree of Insight
1 Falling Star
1 Ferrous Forerunner
1 Thermo Beam`,
  riven: `Legend:
1 Riven, The Exile

Champion:
1 Riven, Broken Blade

MainDeck:
3 Astral Heron
2 Battle Preparations
2 Bedeviling Stranger
3 Blade of the Exile
2 Blitzcrank, Impassive
3 Defy
3 Discipline
2 Gust
1 Not So Fast
1 Rebuke
2 Reckless Innovator
3 Scuttle Crab
1 Star-Crossed
3 Stellacorn Herder
2 Switcheroo
3 Tideturner
3 Zhonya's Hourglass

Battlefields:
1 Emperor's Dais
1 Rakelstake
1 Star Spring

Runes:
5 Calm Rune
7 Chaos Rune

Sideboard:
2 An Offer You Can't Refuse
1 Baron Nashor
2 Decree of Focus
1 Hush
1 Not So Fast
1 Rebuke
1 Star-Crossed
1 Tomb-Raider Barbara`,
};

describe("cardImage", () => {
  for (const [name, source] of Object.entries(LISTS)) {
    it(`has a picture for every card in the ${name} list`, () => {
      const parsed = parseDecklist(source);
      if (!parsed.ok) throw new Error(parsed.error);
      const deck = parsed.deck;
      const cards = [
        ...deck.champions,
        ...deck.mainDeck,
        ...deck.battlefields,
        ...deck.runes,
        ...deck.sideboard,
      ].map((c) => c.name);
      const missing = cards.filter((c) => cardImage(c) === null);
      expect(missing).toEqual([]);
      expect(cardImage(deck.legend!, { legend: true })).not.toBeNull();
    });
  }

  it("points at our own stored copy, inside the configured image pattern", () => {
    expect(cardImage("Defy")).toEqual({ src: "/card-art/RB_card_OGN-045.png", landscape: false });
  });

  it("lists every card file, and only real ones", () => {
    expect(CARD_FILES.has("RB_card_OGN-045.png")).toBe(true);
    // Landscape markers are not part of the file name.
    expect(CARD_FILES.has("RB_card_UNL-205.png")).toBe(true);
    expect(CARD_FILES.has("RB_card_UNL-205:l.png")).toBe(false);
    expect(CARD_FILES.has("../../etc/passwd")).toBe(false);
  });

  it("finds Legends under their title alone, and marks battlefields landscape", () => {
    expect(cardImage("Riven, The Exile", { legend: true })?.src).toContain("RB_card_");
    expect(cardImage("Emperor's Dais")?.landscape).toBe(true);
  });

  it("has nothing for a card that does not exist", () => {
    expect(cardImage("Definitely Not A Card")).toBeNull();
  });
});
