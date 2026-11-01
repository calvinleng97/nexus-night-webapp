import type { Metadata } from "next";
import { loadConfig } from "@/lib/config";
import { Bullets, Clause, Legal } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy — Nexus Night",
  description: "What this app stores about you, and why.",
};

export default function PrivacyPage() {
  const cfg = loadConfig();
  const contact = cfg.site.contactEmail;

  return (
    <Legal title="Privacy" updated="1 November 2026">
      <Clause heading="What this is">
        <p>
          {cfg.site.name} is a small, privately run app for organising card-game nights among
          friends. It is operated by one person on their own server. It is not a company, and
          there is no business model behind it.
        </p>
      </Clause>

      <Clause heading="What Google gives us when you sign in">
        <p>
          Signing in uses Google&apos;s standard OAuth, requesting only the basic profile scopes
          (<code className="font-mono text-xs text-fg">openid</code>,{" "}
          <code className="font-mono text-xs text-fg">email</code>,{" "}
          <code className="font-mono text-xs text-fg">profile</code>). From that we receive and
          store:
        </p>
        <Bullets
          items={[
            "your display name",
            "your email address",
            "the URL of your Google profile picture",
            "your Google account identifier, which we store only as a one-way hash",
          ]}
        />
        <p>
          We never receive your Google password, and we have no access to Gmail, Drive, Contacts
          or anything else in your account.
        </p>
      </Clause>

      <Clause heading="What the app records as you use it">
        <Bullets
          items={[
            "the leagues you belong to and the events you join",
            "who you were paired against each round, and the game scores reported for those matches",
            "a timestamped log of actions such as joining, reporting a result, or confirming one",
          ]}
        />
        <p>
          Other players in a league can see your name, your results, and your rating. That is the
          point of the app.
        </p>
      </Clause>

      <Clause heading="Where it is kept">
        <p>
          Everything is stored as ordinary files on the operator&apos;s own server. Nothing is sent
          to any third party. There is no analytics, no advertising, no tracking pixels, and no
          profiling. The only cookie set is the one that keeps you signed in.
        </p>
      </Clause>

      <Clause heading="How long it is kept, and how to get rid of it">
        <p>
          Your account and results are kept while the league is running, so standings and
          historical ratings stay correct. You can ask the operator to delete your account at any
          time. Match results already recorded may remain in an event&apos;s history, since removing
          them would change other players&apos; records.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          If this ever changes meaningfully, the date at the top of this page changes with it.
        </p>
      </Clause>

      <Clause heading="Contact">
        {contact ? (
          <p>
            Write to <span className="font-mono text-fg">{contact}</span> about anything on this
            page, including deleting your data.
          </p>
        ) : (
          <p>
            Contact whoever invited you to this league — they run this server and can delete your
            data on request.
          </p>
        )}
      </Clause>
    </Legal>
  );
}
