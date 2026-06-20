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
