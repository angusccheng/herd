# herd

Herd is a concert logging and ranking app for building a personal taste profile from shows you have attended. Users log a show, place it into a ranked list through lightweight comparisons, and can edit notes or rerank later.

## Features

- Add concerts with artist, venue, city, date, optional tour/event name, notes, and sentiment.
- API-backed search using Spotify for artists, Ticketmaster for venues/current events/cities, and setlist.fm for historical concert lookup.
- Binary-comparison ranking flow that recalculates scores across the relevant sentiment bucket.
- Concert detail pages with editable notes and reranking.
- Soft mobile-friendly UI with bottom navigation for rankings, add, and profile.

## Stack

- Next.js App Router
- React
- Supabase
- Spotify Web API
- Ticketmaster Discovery API
- setlist.fm API

## Environment

Create `.env.local` from `.env.example` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
TICKETMASTER_API_KEY=...
SETLISTFM_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

These API keys are used server-side by the search route. Do not commit `.env.local`.

## Database

Run the Supabase migrations in `supabase/migrations` before using the app with a fresh database.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run build
```
