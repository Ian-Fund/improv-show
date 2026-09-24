/* ============================================================
   CONFIG — this is the only file you need to edit for content.
   ============================================================ */

const SITE = {
  // --- Identity -------------------------------------------------
  troupeName: "PF",
  showName: "Improv Show", // set this if the show has its own name
  tagline: "Longform improv in Austin, Texas.",
  blurb:
    "PF is a longform improv troupe out of Austin. No script, no net, no idea " +
    "what happens next. One suggestion from the audience and the whole show " +
    "gets built in front of you.",

  city: "Austin, TX",

  // How long a show runs when you leave the end time blank.
  defaultShowMinutes: 60,

  // How many shows each list adds when the visitor presses "Show more".
  // Set to 2 for testing. Change it to 5 before launch.
  showsPerPage: 5,

  // --- Venues ---------------------------------------------------
  // The rooms you play regularly. Picking one in the show form fills in
  // the address and the parking note, so you type it once and never again.
  // Put the one you play most often first — it is the default.
  // Parking text shows on the public show cards, so write it for an
  // audience member who has never been: where to leave the car, what it
  // costs, and anything that catches people out.
  venues: [
    {
      name: "Coldtowne Theater",
      address: "1700 East 2nd St",
      city: "Austin, TX",
      parking:
        "Free parking lot attached to the venue. Street parking available in the " +
        "surrounding blocks.",
    },
    {
      name: "Fallout Theater",
      address: "616 Lavaca St",
      city: "Austin, TX",
      parking:
        "Street parking is free in the evenings. Paid garage on the same block.",
    },
    {
      name: "Factory on 5th",
      address: "3409 E 5th St",
      city: "Austin, TX",
      parking: "Free street parking on the surrounding blocks.",
    },
  ],

  // --- Contact --------------------------------------------------
  bookingEmail: "booking@improvshowatx.com",
  generalEmail: "booking@improvshowatx.com",

  // --- Social (leave "" to hide the link) -----------------------
  social: {
    instagram: "https://www.instagram.com/improvshowatx/",
    tiktok: "",
    youtube: "",
    facebook: "",
  },

  // --- Cast -----------------------------------------------------
  // photo: drop a file in assets/img/ and put its filename here.
  // Leave photo blank and you get a nice initials tile instead.
  cast: [
    {
      name: "Ian Fund",
      role: "",
      photo: "ian-fund.webp",
      bio: "Ian started improvising in 2023. He's found a duo show to be the most intriguing because of the intimacy, space, and creativity it requires.",
    },
    {
      name: "Chandler Palmer",
      role: "",
      photo: "chandler-palmer.webp",
      bio: "Chandler is too cool to have sent in a bio yet. But just you wait... it's coming.",
    },
  ],

  // --- Booking pitch --------------------------------------------
  bookingTypes: [
    {
      title: "Corporate events",
      text: "Holiday parties, offsites, conference receptions. Clean by default, custom to your company if you want it.",
    },
    {
      title: "Private parties",
      text: "Birthdays, weddings, anniversaries. We will build a set around the guest of honor.",
    },
    {
      title: "Festivals & venues",
      text: "We travel. Send dates and we will tell you fast whether we can make it.",
    },
    {
      title: "Workshops",
      text: "Improv fundamentals for teams who would rather laugh than do a trust fall.",
    },
  ],
};

/* ============================================================
   SUPABASE — fill these in after you create your project.
   These two values are safe to be public; the anon key is
   designed to be published. Real protection comes from the
   row level security policies in supabase/schema.sql.
   Leave them blank and the site runs on the sample shows below.
   ============================================================ */

/* Optional spam protection for the booking form. Leave blank and the form
   works with just the honeypot. To turn it on: make a free Cloudflare
   Turnstile widget, put the SITE key here, and set TURNSTILE_SECRET in
   Vercel's environment variables. Both halves are needed. */
const TURNSTILE_SITE_KEY = "0x4AAAAAAEsCTGE6M3__jmSN";

const SUPABASE = {
  url: "https://svcsnxmnsxmaybohdlmp.supabase.co", // e.g. "https://abcdefgh.supabase.co"
  anonKey: "sb_publishable_bMdPL374Z947JyGhLwSsRQ_QHpdDWIj", // e.g. "eyJhbGciOi..."
};

/* ============================================================
   SAMPLE SHOWS — used only while Supabase is not configured,
   so you can see the site working right now. Once you connect
   Supabase these are ignored entirely.
   ============================================================ */

const SAMPLE_SHOWS = [
  {
    id: "sample-1",
    title: "Friday Night Longform",
    starts_at: onWeekday(5, 0, 20, 0),
    ends_at: onWeekday(5, 0, 21, 30),
    venue: "Coldtowne Theater",
    address: "1700 East 2nd St",
    city: "Austin, TX",
    price: "$12",
    ticket_url: "https://example.com/tickets",
    description:
      "Our house show. One suggestion, forty-five minutes, no idea where it goes.",
    lineup: "The full troupe, plus a guest team we like.",
    parking:
      "Free parking lot attached to the venue. Street parking available in the " +
      "surrounding blocks.",
    is_published: true,
  },
  {
    id: "sample-2",
    title: "Improv Jam — All Levels Welcome",
    starts_at: onWeekday(3, 1, 19, 0),
    ends_at: onWeekday(3, 1, 20, 30),
    venue: "Coldtowne Theater",
    address: "1700 East 2nd St",
    city: "Austin, TX",
    price: "Free",
    ticket_url: "",
    description: "Put your name in the hat and get onstage with us.",
    lineup: "",
    parking:
      "Free parking lot attached to the venue. Street parking available in the " +
      "surrounding blocks.",
    is_published: true,
  },
  {
    id: "sample-3",
    title: "Late Night Cage Match",
    starts_at: onWeekday(6, 2, 22, 0),
    ends_at: onWeekday(6, 2, 23, 30),
    venue: "Fallout Theater",
    address: "616 Lavaca St",
    city: "Austin, TX",
    price: "$15",
    ticket_url: "https://example.com/tickets",
    description: "Two teams, one winner, audience decides. Ends when it ends.",
    lineup: "",
    parking:
      "Street parking is free in the evenings. Paid garage on the same block.",
    is_published: true,
  },
  {
    id: "sample-past-1",
    title: "Season Opener",
    starts_at: onWeekday(5, -2, 20, 0),
    ends_at: onWeekday(5, -2, 21, 30),
    venue: "Factory on 5th",
    address: "3409 E 5th St",
    city: "Austin, TX",
    parking: "Free street parking on the surrounding blocks.",
    price: "$12",
    ticket_url: "",
    description: "",
    lineup: "",
    is_published: true,
  },
  {
    id: "sample-past-2",
    title: "Summer Festival Set",
    starts_at: onWeekday(6, -6, 18, 0),
    ends_at: onWeekday(6, -6, 19, 0),
    venue: "The Institution Theater",
    address: "",
    city: "San Marcos, TX",
    price: "",
    ticket_url: "",
    description: "",
    lineup: "",
    is_published: true,
  },
];

// Helper so the sample shows are always relative to today, and always land
// on a sensible night of the week. dow: 0 = Sunday ... 6 = Saturday.
// weekOffset 0 = the next one coming up, negative = weeks in the past.
function onWeekday(dow, weekOffset, hour, minute) {
  const d = new Date();
  let delta = (dow - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta + weekOffset * 7);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
