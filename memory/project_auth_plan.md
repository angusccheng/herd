---
name: project-auth-plan
description: Auth strategy for Herd — magic link now, Google OAuth + Spotify connect later
metadata:
  type: project
---

Implementing Supabase Auth with magic link (email) as the first method.

**Why:** App currently uses a hardcoded PLACEHOLDER_USER_ID; real per-user data isolation requires auth.

**Planned future additions:**
- Google OAuth (Supabase OAuth provider)
- Spotify "connect" (like Discord connected accounts) — link Spotify account to profile for features, not as primary auth

**How to apply:** Keep auth architecture open to adding OAuth providers easily. Spotify connect should be a separate flow from primary auth (store spotify tokens on the user's profile, not as auth method).
