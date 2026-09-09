# BMW Swipe

Tinder-style car finder for BMW. Swipe through cars to find your match based on specs, price range, and preferences.

## How it works

Browse BMW models with a swipe interface. Swipe right on cars you like, left on ones you don't. The app tracks your preferences (engine type, body style, price range) and starts surfacing better matches as you go.

## Interactive V8 engine

`/engine` is a 3D, procedurally modelled 90° cross-plane V8 (4.4 L, 89 × 88.3 mm, DOHC 32-valve, firing order 1-5-4-8-6-3-7-2). Every moving part follows real slider-crank kinematics: the crank, rods, pistons, valves and camshafts are all driven from a single crank angle. Orbit and zoom, change engine speed and slow motion, scrub the crank angle, explode the assembly, switch the castings to X-ray, hide individual parts, and click any part for a description and specs. The bar at the bottom shows which stroke each cylinder is on and which cylinder is firing.

## Stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion (swipe gestures)
- **3D:** three.js via @react-three/fiber and @react-three/drei, zustand for viewer state

## Running it

```bash
npm install && npm run dev
```

Opens on `http://localhost:3000`.

## Why I built this

Wanted to build something with gesture-based UI. Car browsing felt like a natural fit for the swipe mechanic since you're making quick yes/no decisions based on visuals and a few key specs. The interesting part was getting the swipe physics to feel right — velocity, acceleration, snap-back thresholds.
