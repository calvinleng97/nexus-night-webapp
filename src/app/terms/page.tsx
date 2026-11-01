import type { Metadata } from "next";
import { loadConfig } from "@/lib/config";
import { Bullets, Clause, Legal } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms — Nexus Night",
  description: "The terms for using this privately run app.",
};

export default function TermsPage() {
  const cfg = loadConfig();
  const contact = cfg.site.contactEmail;

  return (
    <Legal title="Terms of use" updated="1 November 2026">
      <Clause heading="What you are using">
        <p>
          {cfg.site.name} is a hobby project run by one person for their friends, to pair and
          score card-game nights. It is offered free of charge and as-is.
        </p>
      </Clause>

      <Clause heading="No guarantees">
        <p>
          There is no uptime commitment, no support obligation, and no warranty of any kind. The
          server may go down, and data may be lost. Do not rely on this app for anything that
          matters beyond a games night.
        </p>
      </Clause>

      <Clause heading="Using it reasonably">
        <Bullets
          items={[
            "Report results honestly; your opponent has to confirm them, and managers can override them.",
            "Do not share a league's join code with people the league would not want.",
            "Do not attempt to break into, overload, or scrape the service.",
          ]}
        />
      </Clause>

      <Clause heading="The operator's discretion">
        <p>
          The person running this server can remove a player from a league, correct or delete a
          result, or close an account, without notice. League managers can do the same within
          their own league.
        </p>
      </Clause>

      <Clause heading="Your data">
        <p>
          How your information is handled is described on the{" "}
          <a href="/privacy" className="text-accent underline underline-offset-2">
            privacy page
          </a>
          .
        </p>
      </Clause>

      <Clause heading="Not affiliated with Riot Games">
        <p>
          This is an unofficial, fan-made tool. It is not created by, endorsed by, or associated
          with Riot Games, and it is not an official part of any organised-play programme.
          All trademarks belong to their respective owners.
        </p>
      </Clause>

      <Clause heading="Contact">
        {contact ? (
          <p>
            Questions go to <span className="font-mono text-fg">{contact}</span>.
          </p>
        ) : (
          <p>Questions go to whoever invited you to this league.</p>
        )}
      </Clause>
    </Legal>
  );
}
