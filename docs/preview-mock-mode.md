# Preview Mock boundary

The existing Vercel project is already Git-connected with Production branch main. Git auto-deployments are disabled, Preview creation is blocked at project level, and the Preview workflow is manual-only. The feature branch has PORTAL_DATA_MODE=mock configured; that setting does not update existing deployments.

## Mode selection

| Trusted environment | PORTAL_DATA_MODE | Result |
| --- | --- | --- |
| production | absent, empty, or supabase | Existing Supabase runtime |
| preview | mock | Memory-only Mock runtime; live APIs return 403 |
| preview | absent, empty, supabase, or unknown | Initialization blocked; APIs return 503 |
| development / test | explicit mock | Memory-only Mock runtime; live APIs return 403 |
| development / test | explicit supabase | Existing live runtime; opt-in only |
| unknown environment | any | Initialization and live APIs blocked |

The build obtains its environment from VERCEL_ENV. VERCEL without VERCEL_ENV is unknown. Native Vite defaults to development. Server Functions independently read their deployment process environment; request headers, URL parameters, and browser storage cannot select the mode.

PORTAL_DATA_MODE is authoritative at build time and on the server. Vite reads this non-secret setting from the process or its mode-specific env file, with the process taking precedence, and supplies the resolved setting to its local API handlers. VITE_PORTAL_DATA_MODE is optional; when present it must exactly match PORTAL_DATA_MODE. A VITE-only setting or a mismatch blocks initialization. VITE_PORTAL_DATA_MODE does not authorize a server Function.

## Supabase target

Production keeps its existing fallback to the public Production project URL and publishable key when its env vars are absent. Development and test in explicit `supabase` mode must set both `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (browser) and `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` (local login handler); a missing value fails with `invalid_configuration` instead of silently reaching Production (`server/supabaseTarget.js`).

## Mock bundle contents

Runtime selection is a build-time constant: a Mock build never emits the live Supabase bootstrap or client chunk. `npm run check:mock-bundle -- <dist>` scans a built output for Supabase hosts, Auth/REST/Storage/Realtime paths and client symbols, and fails if any are present. The manual Preview workflow runs it on `.vercel/output/static` before deploying. Every file under `api/` is also covered by a test that loads it in Mock Preview and expects 403 with no client or network use, so newly added Functions must use the guard.

## Local Mock verification

```sh
VERCEL_ENV=preview PORTAL_DATA_MODE=mock VITE_PORTAL_DATA_MODE=mock npm run build
npm run check:mock-bundle -- dist
VERCEL_ENV=preview PORTAL_DATA_MODE=mock VITE_PORTAL_DATA_MODE=mock npm run preview -- --host 127.0.0.1 --port 5188 --strictPort
```

Use a fresh browser profile. The Mock banner must appear without a login form. The memory store resets on document reload and never imports existing browser records. It is not a replacement for persistent storage. Prompt reads return an empty synthetic list; prompt writes, imports, and live transport paths fail explicitly.

The mode is resolved before importing the runtime. Mock never imports the Supabase bootstrap or constructs its client, restores an Auth session, migrates data, subscribes to Realtime, or initializes live Storage/RPC. A failed Mock import displays an initialization error and does not select the live runtime. Direct client-module imports in Preview fail before createClient.

Live server entry points for portal login, prompts/Auth/OAuth/MCP, wiki administration, running operations, sheets, and task notifications reject Mock requests before operational work. The prompt upstream boundary independently rejects live calls. Production uses the existing Supabase runtime in supabaseBootstrap.js, including the reconnect action on startup failure. Local verification exercises client, login, and reconnect behavior with synthetic responses.

## Deployment gate

Local success is LOCAL_MOCK_PASS, not DEPLOYMENT_SAFE. Before a separately authorized Preview deployment, review these conditions:

1. Configure PORTAL_DATA_MODE=mock only for the intended Preview target and branch; optionally configure matching VITE_PORTAL_DATA_MODE. Confirm build and Functions see trustworthy VERCEL_ENV=preview. Keep Production mode absent or supabase.
2. Review and remove unnecessary Production identity/provider variables from Preview scope. The guard blocks their use, but their continued presence is unnecessary exposure.
3. Reconfirm the Git connection, Production branch, branch filters, and access protection. Keep git.deploymentEnabled=false and project Preview creation blocked during review. Do not change Production deployment behavior.
4. The Preview workflow uses workflow_dispatch only and excludes main and tags. A PR runs ordinary CI without deploying. Obtain separate approval before lifting the project Preview block or manually dispatching a deployment. CI success alone does not prove that a deployed build and its Functions are isolated.
5. After an explicitly approved deployment, verify the actual Preview build, direct server denials, network traffic, and Production regression behavior. Until then the deployment gate remains UNKNOWN/BLOCKED.

No operational configuration changes, migrations, data copying, or login attempts are part of local verification. Schema-only isolation on the shared Supabase project remains a separate later design task.
