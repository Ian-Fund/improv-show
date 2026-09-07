# PF — troupe site

A show calendar as the front page, a cast page, a booking form, and a private
admin page where troupe members sign in and add dates. Adding a date emails the
whole troupe with an "Add to Google Calendar" button.

No build step. No `npm install`. The files you see are the files that ship.

```
index.html          the calendar (front page)
troupe.html         cast bios
book.html           booking inquiry form
admin.html          troupe login + show manager
assets/css/         one stylesheet
assets/js/config.js ← the only file you edit for content
assets/js/…         page scripts
api/                two serverless functions (email)
supabase/schema.sql the database
vercel.json         hosting config
```

---

## Brand

**Colour.** The poster yellow `#FFDA47` is set once, as `--brand` at the top of
`assets/css/styles.css`. Everything yellow on the site reads from it — buttons,
the monogram, the giant PF, the spotlight glow behind the page. Change that one
line and the whole site follows. Two shades sit next to it: `--brand-lift` for
button hovers and `--brand-deep` for the darker half of the glow.

**Type.** Headlines are set in Geraldton, the poster face, self-hosted from
`assets/fonts/` in all three weights — Medium, Bold, Black. They were converted
from your OTF originals; woff2 is only a container, so the outlines, kerning and
OpenType features are unchanged. Roughly 35 KB per weight.

The `@font-face` rules are at the top of `styles.css`, and the Black weight is
preloaded in each page's `<head>` because the front page paints with it. If you
ever add a weight, add a matching `@font-face` block.

There is no Google Fonts request anywhere — every font byte comes off your own
domain, which is faster and keeps the site free of third-party calls.

One licensing note: serving a font from a website needs a webfont licence, which
foundries sell separately from the desktop one. Worth confirming yours covers
web use before you point a domain at this.

**The mark.** A troupe name of three characters or fewer is treated as a logo,
not a headline: it gets the oversized yellow poster treatment on the front page
and a solid yellow monogram tile in the header. Give the show its own name in
`config.js` and the front page switches to a normal headline automatically.

**Favicon.** `assets/img/favicon.svg` — a yellow tile with the monogram. Edit the
letters and the hex there if the name changes.

---

## Try it right now

Double-click `index.html`. It opens with sample shows so you can see the layout,
and a yellow bar at the bottom tells you demo mode is on.

**Demo mode** lets you exercise the whole site before setting anything up.
Click **Show manager** in that bar (or open `admin.html`), type any email
address, and you are straight in — no link to click, no account. Add a date,
edit it, delete it, and watch the front page update. The booking form completes
too. Nothing is sent anywhere and nothing leaves your machine: shows live in
your browser's local storage, and **Reset demo data** puts everything back to
the samples.

It switches on only when both of these are true: you are on `localhost` or
opening the file directly, *and* Supabase is not configured yet. So it can never
appear on your live site, and the moment you paste in your real Supabase keys it
steps aside on its own. Nothing to remember to delete before deploying.

What demo mode does **not** prove: real magic-link login, the row-level security
policies, and the actual notification email. Those need the real Supabase
project — worth knowing, so a green light here is not mistaken for a green light
there.

If your browser blocks storage on local files (some Safari setups), serve the
folder and open `http://localhost:8000` instead:

```
python3 -m http.server 8000
```

---

## Step 1 — Put your details in

Open `assets/js/config.js`. Everything at the top is yours to change: troupe
name, show name, tagline, city, your regular venues, emails, social links, cast
bios, and the booking blurbs. This is the only file you need for content.

**Your venues.** `SITE.venues` holds the rooms you play regularly — name,
address, city, and a parking note each. Put the one you play most often first;
it becomes the default when you add a date. The parking text is written for an
audience member who has never been, so say where to leave the car, what it
costs, and anything that catches people out.

**Show length.** `SITE.defaultShowMinutes` is how long a show is assumed to run
when you leave the end time blank. It is set to 60. It decides the length of the
calendar event people add, and when a show stops counting as upcoming. If you
change it, change `SHOW_DEFAULT_MINUTES` in Vercel too so the emails agree.

Already filled in: the name PF, Austin TX, and a placeholder tagline. Still
marked with `← yours`: your booking and general email addresses, your Instagram
handle, your home venue, and the cast.

One exception to "config.js is the only content file": the `<meta>` description
and the Open Graph tags in each page's `<head>` are plain HTML, since search
engines and link previews read them before any JavaScript runs. If the troupe
name or city ever changes, update those four files too.

Cast photos: drop image files into `assets/img/` and put the filename in each
performer's `photo` field. Square images look best. Leave it blank and you get a
tidy initials tile instead.

## Step 2 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com), make a free account, create a project.
2. In the left sidebar open **SQL Editor** → **New query**.
3. Paste the entire contents of `supabase/schema.sql` and hit **Run**.
   Before you run it, edit the last block at the bottom to list your actual
   troupe members' email addresses.
4. Go to **Project Settings → API** and copy two values:
   - **Project URL**
   - the **anon / public** key
5. Paste both into the `SUPABASE` block in `assets/js/config.js`.

The anon key is meant to be public — it ships in the page on every Supabase site.
What actually protects your data is the row-level security in the schema: the
world can read published shows, and only email addresses in the
`troupe_members` table can add, edit, or delete anything.

### Adding or removing troupe members later

Supabase dashboard → **Table Editor** → `troupe_members` → add a row with their
email. That is the whole process. Removing the row removes their access.

## Step 3 — Set up email with Resend

1. Sign up at [resend.com](https://resend.com) (free tier is 3,000 emails/month —
   you will use maybe twenty).
2. Add your domain and follow their DNS steps. If you do not have a domain yet,
   Resend gives you a test sender you can use to try things out.
3. Create an **API key** and copy it.

## Step 4 — Deploy to Vercel

1. Put this folder in a GitHub repo.
2. At [vercel.com](https://vercel.com), **Add New → Project**, import the repo.
3. Framework preset: **Other**. Leave the build command empty — there is nothing
   to build.
4. Before you deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_ANON_KEY` | your Supabase anon key |
   | `RESEND_API_KEY` | your Resend API key |
   | `MAIL_FROM` | `Troupe Calendar <shows@yourdomain.com>` |
   | `TROUPE_EMAILS` | `you@x.com, member2@x.com, member3@x.com` |
   | `BOOKING_EMAILS` | *(optional)* where booking inquiries go, if not everyone |
   | `SITE_TIMEZONE` | *(optional)* e.g. `America/Chicago`, used in emails |
   | `SITE_NAME` | *(optional)* `PF` — appears in the notification subject |
   | `TURNSTILE_SECRET` | *(optional)* turns on spam protection, see Security |

5. Deploy. Add your custom domain under **Settings → Domains** when you have one.

### One more Supabase setting

In Supabase, **Authentication → URL Configuration**, set the **Site URL** to your
live domain and add it to **Redirect URLs**. Otherwise the login links will keep
pointing at localhost.

---

## Day to day

**Adding a show.** Go to `yourdomain.com/admin`, type your email, and click the
link Supabase emails you. Then **+ Add a date**, fill in the form, save. Everyone
on `TROUPE_EMAILS` gets an email with the details and a Google Calendar button.

**Venues.** The **Where** dropdown lists your regular rooms. Pick one and the
venue, address, city and parking note fill themselves in — all still editable,
so a one-off change (a different door, a lot that closed for the night) is just
typing over what it filled. Pick **Somewhere else…** for a festival or a
one-off and the fields clear for you to type from scratch.

**Parking.** Each show carries its own parking note rather than looking it up
live. That means old dates keep the note that was true at the time, and a
one-off venue can have parking info even though it is not in your list. Change
a venue's parking in `config.js` and it applies to dates you add from then on;
to update a date already on the books, edit it and retype the note. Parking
appears as a tuck-away line on each show card, spelled out on the featured show,
and inside the calendar event people add to their phones.

Untick **Show this on the public calendar** to save a date the public should not
see yet — it stays in the admin list and goes live the moment you tick it.

Untick **Email the troupe** if you are backfilling old dates and do not want to
spam anyone.

**Past shows** drop off the top of the front page automatically once they end and
move into the collapsed "Past shows" section. There is nothing to clean up.

**Editing or deleting** a date never sends an email — only new dates do.

---

## Security

Short version: the sensitive parts are enforced at the database level, not just
in the UI, and the site holds nothing worth stealing beyond your show list.

**What protects what.**

- The Supabase anon key in `config.js` is public by design — it ships in the
  page on every Supabase site. Access is decided by the row-level security
  policies in `schema.sql`, which a browser cannot talk its way around.
- There is no service-role key anywhere in this project. That is the key that
  bypasses every policy, and it never leaves your Supabase dashboard.
- `/api/notify-show` checks the caller's session, confirms they are on the
  troupe list, then re-reads the show from the database rather than trusting
  what the browser sent. A member cannot make it email something you never
  saved.
- `is_troupe_member()` lives in a `private` schema, which is not exposed over
  the API, so it cannot be called as an endpoint.
- Visitors can read published shows and nothing else — not hidden dates, not
  who created a row, not the member list.
- Every page is served with a Content-Security-Policy allowing scripts only
  from your own domain plus the two CDNs the site actually uses. If a script
  tag were ever injected into a page, the browser would refuse to run it.
- Ticket links are validated twice, by a database constraint and again in the
  page, so only plain `http(s)` URLs can become a link. That closes off
  `javascript:` links, which HTML escaping alone does not.

**The realistic risks, in order.**

1. **A troupe member's email gets compromised.** Login is a magic link, so
   whoever controls the inbox controls the account, and any member can edit or
   delete any show. This is the most likely way things go wrong. Two things
   help: keep the member list short and remove people when they leave, and
   turn on Point-in-Time Recovery in Supabase so a bad delete is reversible.
2. **Booking form spam.** `/api/inquiry` has to be open to the world. There is
   a honeypot field and best-effort flood control, but the real fix is
   Cloudflare Turnstile, which is free and already wired in. Create a widget,
   put the site key in `config.js` and the secret in `TURNSTILE_SECRET` on
   Vercel, and unverified submissions stop being accepted. Worth doing before
   you promote the site anywhere.
3. **supabase-js loads from jsdelivr at an unpinned `@2` version**, so you
   inherit whatever they publish next. To remove that exposure, serve it
   yourself:

   ```
   mkdir -p assets/js/vendor
   curl -L https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 \
     -o assets/js/vendor/supabase.js
   ```

   Then point the `<script src>` in all four HTML files at
   `assets/js/vendor/supabase.js` and drop `https://cdn.jsdelivr.net` from
   `script-src` in `vercel.json`. Ten minutes, and the site depends on nothing
   outside your own domain.

**Two Supabase settings to leave switched on.** Under Authentication →
Providers → Email keep **Confirm email**, and under Authentication → Settings
keep **Secure email change**. Access is keyed to the email address on the
account, so those two are what stop someone from claiming a member's address.

**What this site does not hold.** No passwords, no payment details, no customer
records — ticketing happens on someone else's site. Booking inquiries pass
through to your inbox rather than being stored. The worst realistic outcome of
a break-in is a defaced show calendar, not a data breach you would have to
disclose to anyone.

---

## If something misbehaves

**"Not on the troupe list" after signing in.** The email you signed in with is not
in `troupe_members`. Add it in the Supabase table editor, then reload.

**The date saves but the email does not go.** The page will tell you so and hand
you the calendar link anyway, so you never lose the date. Check the Vercel
function logs (**Deployments → your deployment → Functions**) — it is almost
always a missing environment variable or a Resend domain that is not verified yet.

**Login link opens to a blank or wrong page.** That is the Supabase Site URL
setting above.

**Calendar is empty on the live site but has shows in admin.** Check
`is_published` on those rows.

---

## What it costs

Nothing, at your scale. Supabase free tier, Resend free tier, Vercel hobby tier.
A domain is the only real cost, around $12 a year.
