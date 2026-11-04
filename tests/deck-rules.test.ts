import { describe, expect, it } from "vitest";
import { poolByName, type PoolCard } from "@/lib/domain/card-pool";
import { parseDecklist } from "@/lib/domain/deck";
import { canChampion, checkBuild, fitsLegend, type Build } from "@/lib/domain/deck-rules";
import type { DeckCard } from "@/lib/domain/types";

/** Real lists from the group (the same ones card-images.test.ts uses). */
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

const pool = poolByName();
const card = (name: string): PoolCard => {
  const c = pool.get(name);
  if (!c) throw new Error(`not in the pool: ${name}`);
  return c;
};
const rows = (cards: DeckCard[]) => cards.map((c) => ({ card: card(c.name), count: c.count }));

function buildOf(source: string): Build {
  const parsed = parseDecklist(source);
  if (!parsed.ok) throw new Error(parsed.error);
  const d = parsed.deck;
  return {
    legend: d.legend ? card(d.legend) : null,
    champion: d.champions[0] ? card(d.champions[0].name) : null,
    main: rows(d.mainDeck),
    battlefields: rows(d.battlefields),
    runes: rows(d.runes),
    sideboard: rows(d.sideboard),
  };
}

describe("deck rules against real lists", () => {
  for (const [name, source] of Object.entries(LISTS)) {
    it(`finds the ${name} list fully legal`, () => {
      const failing = checkBuild(buildOf(source)).filter((c) => !c.ok);
      expect(failing).toEqual([]);
    });
  }
});

describe("deck rules", () => {
  const azir = () => buildOf(LISTS.azir!);

  it("counts the Chosen Champion toward the 40", () => {
    const b = azir();
    const main = checkBuild(b).find((c) => c.id === "main")!;
    expect(main.detail).toBe("40 / 40");
    const without = checkBuild({ ...b, champion: null });
    expect(without.find((c) => c.id === "main")).toMatchObject({ ok: false, detail: "39 / 40" });
    expect(without.find((c) => c.id === "champion")!.ok).toBe(false);
  });

  it("flags off-domain cards, another champion's Signature, and a wrong Chosen Champion", () => {
    const legend = card("Azir, Emperor of the Sands");
    expect(fitsLegend(card("Defy"), legend)).toBe(true); // Calm
    expect(fitsLegend(card("Stupefy"), legend)).toBe(false); // Mind
    expect(fitsLegend(card("Blade of the Exile"), legend)).toBe(false); // Riven's Signature
    expect(canChampion(card("Azir, Sovereign"), legend)).toBe(true);
    expect(canChampion(card("Riven, Broken Blade"), legend)).toBe(false);

    const b = azir();
    // Riven, Broken Blade is Calm, so it fits Azir's domains: it's the
    // Chosen Champion check that catches it, as another champion.
    const checks = checkBuild({ ...b, champion: card("Riven, Broken Blade") });
    expect(checks.find((c) => c.id === "champion")!.ok).toBe(false);
    // A Mind card in the main deck is outside Azir's Calm/Order.
    const offDomain = checkBuild({ ...b, main: [...b.main, { card: card("Stupefy"), count: 1 }] });
    expect(offDomain.find((c) => c.id === "domains")?.label).toContain("Stupefy");
  });

  it("flags a 4th copy, a repeated Battlefield, and an oversized sideboard", () => {
    const b = azir();
    b.main = b.main.map((r) => (r.card.name === "Defy" ? { ...r, count: 4 } : r));
    b.battlefields = [{ card: card("Hall of Legends"), count: 2 }, { card: card("Seat of Power"), count: 1 }];
    b.sideboard = [...b.sideboard, { card: card("Defy"), count: 3 }]; // 10 + 3 > 10
    const failing = checkBuild(b).filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(["copies", "battlefields", "sideboard", "main"]));
  });

  it("knows every real list's cards, so editing one loses nothing", () => {
    for (const source of Object.values(LISTS)) expect(() => buildOf(source)).not.toThrow();
  });
});
