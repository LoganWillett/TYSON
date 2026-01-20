# TYSON — Strength Training Companion (v4)

TYSON is a local, browser-saved strength coach + tracker:
- Turns your goal/time/equipment into a weekly plan
- Helps you avoid pre-fatigue and accidental muscle overlap
- Tracks volume vs targets and strength trend (e1RM)
- Includes planning tools (breaks, cardio timing, PR test planning, volume landmarks)

Everything is stored in browser localStorage (device-specific).

## Run locally
Requires Node 18+.

```bash
npm install
npm run dev
```

## Build (e.g., GitHub Pages)
```bash
npm run build
```
Deploy the `dist/` folder. (Vite base is set to `./`.)

## Tools included
- Break Planner
- Concurrent Training (strength + cardio spacing)
- PR Test Planner (7-day taper + warm-ups)
- Volume Landmarks (weekly sets vs targets)
- Order & Overlap Checker (compound-first suggestions)
- PRs & Milestones (best e1RM, heaviest set, recent PR events)

## Core formulas
- Estimated 1RM (Epley default): `e1RM = weight * (1 + reps / 30)`
- Effective sets: primary muscles `+1.0` per set; secondary muscles `+0.5` per set
- Double progression: hit top of rep range at <= RPE 8 then add ~2-5% next time

Educational tool only; not medical advice.
