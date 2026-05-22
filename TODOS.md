# TODOS

## Design — FrsionOS Glassmorphism Restyle

- [ ] **T1: Implement DESIGN.md CSS token system in timeline.html** (P1, ~2h)
  - Replace dark theme (zinc-950, zinc-100) with light beige matte + lavender accent tokens
  - Convert .glass/.dark-bg classes to new glassmorphism variants
  - Update all inline styles to reference CSS variables
  - Blocked by: nothing. Blocks: T2, T3, T4, T5, T6.
  - Context: DESIGN.md defines the complete token system. See Pass 5.

- [ ] **T2: Implement decorative elements** (P2, ~2h)
  - CSS-only silver glitter sphere (radial-gradient with metallic specular highlight)
  - CSS glass water droplets (transparent circle + internal refraction highlight)
  - SVG purple curved geometric line (diagonal sweep, 1.5px, accent-200, 30% opacity)
  - CSS silver chain decoration (alternating circles connected by 1px lines)
  - Scattered silver dots (8-12 small circles, random positions)
  - All placed on background z-layer beneath content
  - Blocked by: T1. Context: Pass 4 — must use precise gradients to avoid "AI blob" look.

- [ ] **T3: WCAG AA accessibility** (P1, ~1h)
  - Verify 4.5:1 contrast on light beige background for all text
  - 44px minimum touch targets on mobile
  - Visible focus indicators on all interactive elements
  - ARIA labels on Omnibox, OKR spheres, calendar orbs
  - prefers-reduced-motion: disable animations, reduce decorative elements
  - Keyboard navigation through timeline cards
  - Blocked by: T1. Context: Pass 6 — contrast equation changes with light theme.

- [ ] **T4: Alternating left/right card layout** (P2, ~1h)
  - Implement alternating horizontal offset for timeline cards (future right, past left)
  - Subtle rotation (±1-2°) alternating per card
  - "Now" marker centered
  - Creates "river flow" metaphor matching app name 川上
  - Blocked by: T1. Context: Pass 7.

- [ ] **T5: Interaction states** (P2, ~1h)
  - Empty state: welcoming centered glass card with message + silver dot pulse
  - Loading state: glass shimmer animation on new card slot + input lavender pulse
  - Toast notifications: glass family with lavender tint (error: warm red-purple, success: cool silver)
  - OKR sphere fill animation with gloss flash
  - Blocked by: T1. Context: Pass 2.

- [ ] **T6: 3D layered depth** (P2, ~1h)
  - Card z-axis elevation through shadow depth (shadow-card, shadow-card-hover)
  - Decorative elements at different perceived depths via blur and opacity
  - Subtle translateZ in stacking context
  - Blocked by: T1. Context: Pass 7.

- [ ] **T7: Progressive enhancement for mobile** (P3, ~1.5h)
  - Reduce backdrop-blur (20px → 8px on mobile)
  - Reduce decorative elements (5 → 1 on mobile)
  - Simplify card shadows on mobile
  - Remove grain texture on mobile
  - Update Expo React Native StyleSheet to match new colors
  - Blocked by: T1. Context: Pass 6.

- [ ] **T8: Grain texture overlay** (P2, ~30min)
  - CSS noise/grain overlay on background using SVG filter or pseudo-element
  - Subtle, 3-5% opacity
  - Web-only (removed on mobile per progressive enhancement)
  - Blocked by: T1. Context: design brief "轻微的颗粒质感."

- [ ] **T9: Inter font loading** (P1, ~15min)
  - Add Inter from Google Fonts or self-host
  - CJK fallback chain: 'Noto Sans SC', 'PingFang SC', sans-serif
  - Update font-family on body and all text elements
  - Blocked by: nothing. Context: Pass 4.

## Notation
- P1: blocks ship
- P2: should land same branch
- P3: follow-up
