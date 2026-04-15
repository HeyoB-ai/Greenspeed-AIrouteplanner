# Design System Document

## 1. Overview & Creative North Star: "The Clinical Concierge"

This design system is built to bridge the gap between pharmaceutical precision and logistical agility. We move beyond the "standard delivery app" aesthetic by adopting a **Clinical Concierge** philosophy. 

The Creative North Star focuses on **High-End Editorial Reliability**. The layout is not a rigid grid of boxes; it is a sophisticated, breathing composition that utilizes intentional asymmetry and tonal layering. We prioritize white space and "glass" surfaces to evoke a sense of cleanliness, while our high-contrast typography conveys the authority of a trusted healthcare partner. This is a digital environment where speed meets safety, visualized through fluid transitions and professional depth.

---

## 2. Colors & Surface Logic

Our palette is anchored in the reliability of the pharmaceutical industry (Navy) and the vitality of speed and health (Teal). 

### The "No-Line" Rule
To achieve a premium, editorial feel, **1px solid borders are strictly prohibited for sectioning.** Structural boundaries must be defined solely through background color shifts or tonal transitions. Use `surface-container-low` (#f2f4f6) sections against a `surface` (#f7f9fb) background to denote change in context.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted glass or fine paper. 
- **Base Layer:** `surface` (#f7f9fb)
- **Content Blocks:** `surface-container-low` (#f2f4f6)
- **High-Priority Cards:** `surface-container-lowest` (#ffffff) to provide a "pop" of clean white against the gray.

### The "Glass & Gradient" Rule
For floating elements (modals, navigation bars, or quick-action menus), use Glassmorphism. Apply a background color using `surface` at 80% opacity with a `backdrop-blur` of 12px. 

### Signature Textures
Main CTAs and Hero backgrounds should leverage a subtle linear gradient (135°) from `primary` (#006b5a) to `primary_container` (#48c2a9). This avoids the "flat" look of generic templates and adds a professional "soul" to the interface.

---

## 3. Typography: Authoritative Clarity

We utilize two distinct typefaces to balance modern efficiency with editorial elegance.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern warmth. Use `display-lg` (3.5rem) with tighter letter-spacing (-0.02em) for hero moments to create a high-end, confident impact.
*   **Body & Labels (Inter):** The industry standard for legibility. Inter provides a neutral, highly readable foundation for medical and logistical data.

**Hierarchy as Identity:**
- **Headlines:** Use `on_surface` (#191c1e) for maximum authority.
- **Body:** Use `on_surface_variant` (#3d4945) for secondary information to create a natural visual hierarchy without over-using font weights.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are often too "heavy" for a clinical brand. We use **Tonal Layering** to convey importance.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f2f4f6) section. This creates a soft, natural lift that feels architectural rather than artificial.
*   **Ambient Shadows:** When a true floating effect is required (e.g., a courier tracking card), use a shadow with a 24px blur and 4% opacity. The shadow color must be a tinted version of `on_surface` (e.g., `rgba(25, 28, 30, 0.04)`).
*   **The "Ghost Border" Fallback:** If a boundary is required for accessibility in input fields, use the `outline_variant` (#bccac4) at 20% opacity. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. Corner radius: `full` (9999px) for a "capsule" look that mirrors the apothecary theme. 
*   **Secondary:** `on_secondary_fixed` (#101c30) text on a `secondary_fixed` (#d7e2fe) background. No border.
*   **States:** Hovering on Primary should increase the `surface_tint` (#006b5a) intensity; Focus state uses a 2px `outline` (#6d7a75) with 4px offset.

### Input Fields
*   **Style:** `surface-container-lowest` (#ffffff) fill. 
*   **Corners:** `md` (0.75rem).
*   **Interaction:** On focus, the `outline` transforms into a subtle teal `primary` (#006b5a) shadow-glow rather than a harsh border.

### Cards & Lists
*   **Rule:** Forbid divider lines.
*   **Structure:** Separate list items using 16px of vertical white space (from the Spacing Scale) or by alternating subtle background shifts between `surface` and `surface-container-low`.
*   **Apothecary Detail:** Icons for delivery and pharmacy should be encased in a circular `tertiary_container` (#5dc0a7) background at 15% opacity to highlight the professional iconography.

### Custom Component: The "Prescription Progress" Track
A bespoke horizontal stepper for delivery tracking. Use a `primary` (#006b5a) line with `primary_fixed` (#81f7dc) nodes. Completed steps feature a checkmark icon, while the active step utilizes the Glassmorphism rule to "glow" above the track.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts where text blocks are offset from images to create an editorial, high-end feel.
*   **Do** prioritize the `full` (9999px) corner radius for buttons and chips to maintain the "pill" visual metaphor.
*   **Do** use `primary_container` (#48c2a9) as a highlight color for text keywords within long-form body copy.

### Don’t
*   **Don’t** use pure black (#000000) for text. Always use `on_background` (#191c1e) to maintain a soft, premium appearance.
*   **Don’t** use standard "drop shadows." If it doesn't look like ambient light, it's too heavy.
*   **Don’t** crowd elements. If a section feels busy, double the padding. This design system thrives on "breathing room."
*   **Don’t** use square corners. Every element should feel approachable and safe, adhering to the `md` (0.75rem) or `xl` (1.5rem) roundedness tokens.