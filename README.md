# BMW Swipe

Tinder-style car finder for BMW. Swipe through cars to find your match based on specs, price range, and preferences.

## How it works

Browse BMW models with a swipe interface. Swipe right on cars you like, left on ones you don't. The app tracks your preferences (engine type, body style, price range) and starts surfacing better matches as you go.

## Stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion (swipe gestures)

## Running it

```bash
npm install && npm run dev
```

Opens on `http://localhost:3000`.

## Why I built this

Wanted to build something with gesture-based UI. Car browsing felt like a natural fit for the swipe mechanic since you're making quick yes/no decisions based on visuals and a few key specs. The interesting part was getting the swipe physics to feel right — velocity, acceleration, snap-back thresholds.
