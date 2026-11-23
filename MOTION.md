# Neurix Motion Language

> **Philosophy:** Purposeful, tactile, and restrained — inspired by mechanical instruments and clean alpine stillness rather than consumer chatbot sparkles. Zero continuous idle bounces; zero GPU-heavy blur animations competing with local LLM inference.

---

## 1. Timing & Easing Curves

| Token / Curve | Duration / Cubic-Bezier | Where Used |
|---|---|---|
| **Micro-Response** (`fast`) | `150ms cubic-bezier(0.2, 0.8, 0.2, 1)` | Button hovers, toggle switches, segmented pill highlights, tab selection |
| **Standard Panel** (`normal`) | `200ms cubic-bezier(0.22, 1, 0.36, 1)` | Dropdowns, flyout menus, Command Palette reveal, dialog backdrop fade |
| **Expressive Sheet / Route** (`spring-out`) | `240ms cubic-bezier(0.16, 1, 0.3, 1)` | Android bottom sheets, Artifacts side drawer slide, new-turn entrance |
| **State Gauge Transition** | `360ms ease-out` | `MemoryRing` arc offset, storage bar width, background model warming bar |

---

## 2. Signature Stateful Motion Moments

1. **Background Model Warming Indicator (Non-Blocking Startup):**
   - Replaces the `73.8s` frozen `BootScreen` blocker with a quiet horizontal glacial-teal progress shimmer inside the sidebar Engine Pill and subtle header status chip (`Loading Qwen 3.5...`), smoothly transitioning to a steady green/teal dot once weights finish mapping.
2. **Send -> Stop Action Morph:**
   - Composer primary CTA smoothly cross-fades/scales between upward arrow (`Send`) and square stop glyph (`Stop generating`) inside the same concentric container (`150ms`), preserving layout stability.
3. **Coalesced Token Stream & `<think>` Accordion:**
   - Text tokens flush at display refresh cadence via `requestAnimationFrame`; `<think>` reasoning block smoothly expands/collapses cleanly without pushing the active bottom prompt off-screen.
4. **Reduced Motion Accessibility (`prefers-reduced-motion: reduce`):**
   - Global CSS rule collapses transitions/animations to `0.01ms` / `none` (verified across Splash star twinkle, route fades, modal reveals, and skeleton shimmers) while preserving immediate state visibility.
