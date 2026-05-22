# 川上 — Design System

FrsionOS-inspired cloud platform aesthetic: glassmorphism, 3D layered depth, soft beige + lavender palette.

## Design Principles
- **Header dominates** — HUD is the visual anchor; cards are subordinate
- **Decoration stays in background** — silver spheres, droplets, purple lines live on dedicated z-layers beneath content
- **Calm focus** — after initial "wow," the interface recedes; user focuses on their timeline
- **Progressive enhancement** — web gets full glassmorphism; mobile gets lighter fidelity
- **WCAG AA** — 4.5:1 contrast minimum, 44px touch targets, focus indicators

## Color System

```css
:root {
  /* Background — light beige matte */
  --bg-primary: #F5F0EB;
  --bg-secondary: #EDE7E0;
  --bg-tertiary: #E8E0D8;

  /* Accent — low saturation lavender purple */
  --accent-100: #E8E4F4;  /* lightest — card glow */
  --accent-200: #D4CEE8;  /* light — hover states */
  --accent-300: #B8B5E0;  /* base — primary accent */
  --accent-400: #A89FCD;  /* medium — active states */
  --accent-500: #8B7FB8;  /* dark — text on light bg */
  --accent-600: #6B5E9A;  /* darkest — emphasis text */

  /* Glass surfaces */
  --glass-bg: rgba(255, 255, 255, 0.35);
  --glass-bg-strong: rgba(255, 255, 255, 0.50);
  --glass-bg-light: rgba(255, 255, 255, 0.20);
  --glass-border: rgba(255, 255, 255, 0.60);
  --glass-border-subtle: rgba(255, 255, 255, 0.30);
  --glass-blur: 20px;
  --glass-blur-mobile: 8px;

  /* Text */
  --text-primary: #2D2838;
  --text-secondary: #5C5670;
  --text-tertiary: #8B84A0;
  --text-inverse: #F5F0EB;

  /* Shadows — lavender-tinted */
  --shadow-card: 0 4px 24px rgba(139, 127, 184, 0.12),
                 0 1px 4px rgba(139, 127, 184, 0.06);
  --shadow-card-hover: 0 8px 40px rgba(139, 127, 184, 0.18),
                       0 2px 8px rgba(139, 127, 184, 0.08);
  --shadow-header: 0 2px 20px rgba(139, 127, 184, 0.08);

  /* Status colors */
  --color-success: #7EB8A0;
  --color-error: #C48080;
  --color-warning: #C4B080;
}
```

## Typography

**Primary:** Inter (Latin + CJK via system fallback: `Inter, -apple-system, 'Noto Sans SC', 'PingFang SC', sans-serif`)

```css
--text-xs:    10px;   /* labels, meta, calendar days */
--text-sm:    12px;   /* secondary text, timestamps */
--text-base:  14px;   /* body, card content */
--text-lg:    18px;   /* section headings */
--text-xl:    24px;   /* app title */
--text-2xl:   32px;   /* hero numbers */

--font-light:    300;
--font-regular:  400;
--font-medium:   500;
--font-semibold: 600;

--tracking-tight: -0.01em;
--tracking-normal: 0;
--tracking-wide: 0.05em;
--tracking-widest: 0.15em;
```

## Spacing Scale
```
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

## Border Radius
```css
--radius-sm:   8px;   /* small pills, badges */
--radius-md:   12px;  /* buttons, inputs */
--radius-lg:   16px;  /* cards */
--radius-xl:   20px;  /* modals */
--radius-full: 9999px; /* spheres, pills */
```

## Glass Surface Components

### Glass Card
```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
```

### Glass Header
```css
.glass-header {
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--glass-border);
  box-shadow: var(--shadow-header);
}
```

### Glass Input
```css
.glass-input {
  background: var(--glass-bg-light);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-lg);
}
.glass-input:focus-within {
  border-color: var(--accent-300);
  box-shadow: 0 0 0 3px rgba(184, 181, 224, 0.15);
}
```

## Decorative Elements

### Silver Glitter Sphere
- CSS radial-gradient with metallic reflection: bright highlight at 35% 25%, specular spot at 60% 70%, dark edge
- Position: top-right background, ~120px diameter
- Subtle CSS animation: slow rotation illusion via shifting gradient stops

### Glass Water Droplets
- CSS: transparent circle + internal highlight ellipse + bottom refraction
- 2-3 droplets scattered in background, ~20-30px each
- Position: mid-left background zone

### Purple Geometric Line
- SVG curved path, `stroke="var(--accent-200)"`, 1.5px weight, 30% opacity
- Sweeps diagonally across background from bottom-left to mid-right
- One continuous curve, not a tangle

### Silver Chain Decoration
- Thin vertical chain of alternating small circles (~4px) connected by 1px lines
- Position: near the timeline, subtle, ~40% opacity
- Provides vertical rhythm without competing with cards

### Silver Dot Scatter
- 8-12 small circles (2-4px), `background: rgba(200, 195, 210, 0.5)`
- Random positions in background gaps
- Subtle ambient particles

## Card Layout — Alternating River

Timeline cards alternate horizontal alignment:
- Future events: slight right lean (~8px right, 1° rotate)
- Past events: slight left lean (~8px left, -1° rotate)
- "Now" marker: centered
- Creates "川" (river) flowing metaphor

## Interaction States

| Feature | Loading | Empty | Error | Success | Partial |
|---------|---------|-------|-------|---------|---------|
| Timeline feed | Glass shimmer across new card slot + input pulse | Welcoming centered glass card with message + silver dot animation | Toast: glass, warm red-purple tint | Toast: glass, cool silver tint | One card shimmering while rest stable |
| OKR spheres | Subtle pulse on unfilled portion | Dashed circle placeholder with "+" icon | N/A | Fill animates upward with gloss flash | N/A |
| Calendar heatmap | Skeleton grid of 31 transparent circles | All orbs rendered at minimum opacity | N/A | Orbs fill with color + subtle glow | N/A |
| Omnibox input | Lavender border glow pulse while AI processes | Placeholder text visible | Input border briefly flashes warm red | Brief silver flash then clear | Voice button pulsing when listening |

## Responsive Strategy

| Property | Web (desktop) | Web (tablet) | Mobile (web + Expo) |
|----------|--------------|--------------|---------------------|
| backdrop-blur | 20px | 16px | 8px (or none on low-end) |
| Decorative elements | All 5 types | 3 (sphere, line, dots) | 1 (sphere only) |
| Card stagger | Full alternating ±8px + rotate | Alternating ±4px, no rotate | Single column, no offset |
| Grain texture | Full CSS noise overlay | Reduced opacity | None |
| Card shadows | Full layered | Single layer | Single layer, lighter |
| Font size | As scale above | Same scale | +1px for readability |

## Accessibility Checklist
- [ ] All text ≥ 4.5:1 contrast against beige background
- [ ] Glass cards have sufficient text contrast (dark text on light frosted surface)
- [ ] Focus indicators visible on all interactive elements
- [ ] Touch targets ≥ 44px on mobile
- [ ] ARIA labels on Omnibox, spheres, calendar orbs
- [ ] `prefers-reduced-motion` respected — disable animations, reduce decorative elements
- [ ] Keyboard navigation: Tab through cards, Enter to edit, Escape to close editor
- [ ] Screen reader announces: new events, toast messages, OKR progress changes
