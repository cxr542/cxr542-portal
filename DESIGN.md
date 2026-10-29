# cxr542 Portal Design System

## 1. Product intent

`cxr542-ai-portal` is a compact personal project board. It prioritizes status visibility and direct access to individual tools without changing the surrounding portal shell.

## 2. Foundations

- Base surface: `#f3f5fb`; elevated surfaces: white and soft slate gradients.
- Primary text: `#0f172a`; secondary text: `#475569`; supporting text: `#64748b`.
- Status accents: blue `#2563eb` (active), violet `#7c3aed` (experiments), amber `#d97706` (paused), slate `#475569` (ideas).
- Favorite accent: yellow `#facc15`, reserved for selected favorite actions in the dark portal menu.
- Sidebar: deep navy `#0f1324` with pale indigo text.
- Typography: the browser system sans-serif stack defined in `src/index.css`; headings use tight letter spacing and high weight.

## 3. Layout and spacing

- The desktop shell is a sidebar and content grid. Mobile retains the existing compact portal navigation surface; no overlay or fixed drawer is introduced.
- Spacing uses a 4px rhythm. Card padding is 16px, section gaps are 14px to 16px, and compact controls use 8px to 12px inner spacing.
- Cards have 14px to 16px radii, subtle 1px borders, and restrained soft shadows.

## 4. Interaction

- Buttons use clear hover and keyboard focus states. Small icon-only controls retain a minimum 40px touch target.
- Project actions are explicit buttons; nested controls stop propagation from any enclosing project action.
- Toast feedback is brief, non-blocking, and anchored away from navigation.

## 5. Reusable components

- Project card: status, title, description, next action, open action, and optional favorite toggle.
- Favorite tool item: icon, label, and direct project navigation inside the existing portal menu surface.
- Empty state: concise muted copy, without replacing existing project board sections.

## 6. Responsive behavior

- Board grids become one column below 760px.
- Favorite controls stay at least 40px square at every breakpoint.
- Navigation uses existing responsive shell rules; this feature does not add a slide-out navigation pattern.

## 7. Accessibility

- Icon-only favorite buttons expose their state and action with an accessible label and `aria-pressed`.
- Favorite collections use named navigation landmarks or labelled sections.
- Toast messages use `role="status"` and `aria-live="polite"`.

## 8. Cloud access states

- The cloud access panel reuses white surfaces, slate text, blue actions, 16px radii and the 4px spacing rhythm. It is at most 400px wide with 24px padding, and 16px outer gutters on phones.
- Login fields have visible labels, username/password autocomplete, 44px minimum controls and visible focus rings. Errors use an assertive live region; progress uses a polite status.
- The account toolbar exposes migration, save status, and sign out. A failed or conflicting write keeps an unsaved indicator visible until retry or explicit reload. The browser's unload prompt protects pending writes.
- Loading and login cover underlying personal content. Auth changes clear all in-memory data before any other account can load.

- The personal portal uses a single ID/password account. No public sign-up action is displayed. Credential errors do not reveal the internal account email.

## 9. Approved workspace redesign
The approved interactive reference is ../design-previews/portal-workspace (mode-light.png, mode-dark.png). Replace project-status home with a daily workspace, grouped 232px sidebar, 72px sticky toolbar, 40px desktop gutters, mobile drawer and bottom navigation. Light is Cloud Blue (#f7f8fe canvas, #eef1fb sidebar, #4c62aa accent); dark is Black Red (#101014 canvas, #141419 sidebar, #1c1c23 surfaces, #ff7186 accent, #b72d46 primary). Use pastel mint/blue/peach/lilac tool tiles, original dimensional SVG tool icons and original bear mascot. State uses tonal fill, no decorative edge stripes. 44px targets, native dialogs, Escape/focus management, reduced motion.
Keep existing authentication and cloud write/revision contract. Theme and favourites use PortalStorage (Supabase settings). Recent activity derives from actual loaded records; running panel reports actual current-month completed races/runs, never demo figures. Quick capture writes a valid idea-bank record and reports success only after await. Existing tools and route IDs remain. Menu names/order/font settings and release notes remain accessible. AI office embeds licensed original canvas demo with explicit demo labels and network-isolated scripts-only iframe; no personal logs sent to hosting. Local live collection is a separate read-only service.

## 10. Integrated tool presentation
Preserve standalone tools and authenticated storage contracts; improve portal-hosted presentation through a same-origin embedded mode. Scope: shared project-shell tools (today-shoes, marathon-log, how-many-points, idea-bank, prompt-collection, who-are-you, vision-font, gemini-tuner); Wiki and AI office keep specialized embeds. Parent owns navigation, title and scrolling. Child internal sidebar becomes a wrapping horizontal section navigation using the original nodes/listeners; app banner, duplicate portal links and mobile bottom tabs disappear only in portal mode. Child background matches parent, cards use surface tokens, Cloud Blue/Black Red sync without reloading forms. Original exports, imports, API-key controls and data operations remain reachable. Child cloud state/retry stays visible inline. Frame height is measured by ResizeObserver with origin/source-checked messages; navigation resizes after content changes. Avoid generic page-height dependency loops; dynamic overlays may scroll within themselves. Standalone documents retain their original layout. No new schema/auth behavior.

## 11. Tool overflow action
Move standalone opening from a permanently visible header link into a native details/summary “더보기” control shared by all integrated tools. 44px summary target, neutral one-pixel popup border, surface tokens, visible keyboard focus. Escape closes and returns focus; outside pointer and focus leaving close it. Keep original target and noopener/noreferrer. No tool reload or data changes.

## 12. Theme selection in tool overflow
Tool overflow includes a labelled native radio group for portal-wide light (Cloud Blue) and dark (Black Red), followed by the standalone link. Share Workspace state through React context so header toggle, persisted Supabase setting and child theme bridge have one source of truth. Changing mode does not change frame source or remount it. 44px radio labels; neutral rules and selected tonal wash; popup width 240px fits phone gutters. Keep Escape/outside-close behavior.
