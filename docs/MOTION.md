# Motion guidelines

Source of truth: src/styles/base.css and existing reduced-motion behavior.

| Use | Duration at scale 1 |
|---|---|
| Hover, press, toggle | 120 ms |
| Menus, toast, state | 200 ms |
| Space/panel entry | 280 ms |
| Mode/theme/wallpaper | 480 ms |

Ease out: cubic-bezier(.2,.7,.2,1); ease in/out: cubic-bezier(.6,0,.3,1). Theme motion scale applies throughout. Prefer opacity and transform; preserve focus and avoid layout jumps.
Honor prefers-reduced-motion. Never add essential information only in animation, autoplay sound, strobe or perpetual decorative movement.

Demo capture: 1280×800, synthetic state, clear pointer pauses. Show Space open, mode switch, command search and personalization. Short loop 8–12 seconds; tour 20–30 seconds. Export muted WebM master and GIF derivative; do not invent interface behavior or speed up loading claims.

