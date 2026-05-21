# 川上 (River of Time)

Expo + React Native timeline-based personal management app with Supabase backend and DeepSeek AI.

## Tech Stack
- Frontend: Expo (React Native) + `timeline.html` (standalone web preview)
- Backend: Supabase (PostgreSQL) + Edge Functions
- AI: DeepSeek API (text), Qwen-VL (vision), local Python proxy for dev

## Quick Start
```bash
# Web preview (fastest iteration)
open timeline.html

# AI proxy (required for AI features)
python proxy-server.py

# Expo mobile
npx expo start
```

## Project Structure
```
app/              Expo Router pages
components/       Shared React Native components
hooks/            Zustand stores
services/         AI proxy, Supabase client
types/            TypeScript type definitions
supabase/         Migrations, Edge Functions
static/           Static JS files for web preview
```

## Testing
```bash
npx jest
```

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
