# vinext-starter

## Vivad SPARK workspace

The application combines strategy deployment, quality-event reporting, video
training, and **VivaDocs** visual work instructions. VivaDocs is available at
`/vivadocs` and includes a dashboard, searchable SOP library, controlled status
transitions, an approval queue, a touch-friendly operator player, a skills
matrix, and an append-only activity view.

The workspace includes seeded SOPs and competency records so the module is
immediately explorable. New SOPs, their ordered steps, and associated images are
stored in Netlify Database (Postgres). Operator progress and demonstration-only
state continue to use the current browser's `localStorage`.

### VivaDocs architecture and assumptions

- `app/vivadocs/page.tsx` owns the interactive module and demonstration records.
- `lib/vivadocs-store.ts` persists user-created VivaDocs content in Netlify Database.
- `netlify/database/migrations/` contains the Postgres schema Netlify applies during deploys.
- `app/globals.css` contains the responsive Vivad SPARK design system.
- Document states follow Draft → In review → Approved → Published.
- Published SOPs can be completed step-by-step and create a local audit event.
- The current user is represented by the seeded owner profile for demonstration.

### Threat model

The demonstration stores no secrets or sensitive production records. Browser
storage is user-controlled and must not be treated as an authorisation boundary.
Before real deployment, enforce organisation membership and role checks on every
server operation, validate uploads by content and size, use signed media URLs,
protect mutations against CSRF and abuse, make published revisions immutable in
database transactions, and retain audit events in append-only server storage.

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with Netlify Postgres storage
for VivaDocs and Cloudflare Stream for training videos.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional bindings for the separate ChatGPT Sites deployment
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` describes the Netlify Postgres VivaDocs tables
- `drizzle.config.ts` generates Postgres migrations into Netlify's migration directory

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/)
