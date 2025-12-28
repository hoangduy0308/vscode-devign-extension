---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
---

# Frontend Design Skill

This skill guides the creation of distinctive, production-grade frontend interfaces. The goal is to produce visually striking, polished designs that avoid generic "AI-generated" aesthetics.

## Design Thinking

Before writing code, consider:

- **Purpose**: What problem does this solve? Who are the users?
- **Tone**: Choose a bold aesthetic direction:
  - Brutally minimal
  - Maximalist and expressive
  - Retro-futuristic
  - Organic and natural
  - Neo-brutalist
  - Glassmorphism
  - Neumorphism
- **Constraints**: Technical requirements, browser support, performance
- **Differentiation**: What makes this design memorable and unique?

### Implementation Guidelines

Produce working code that is:
- **Production-grade**: Clean, maintainable, accessible
- **Visually striking**: Bold choices, not safe defaults
- **Cohesive**: Consistent design language throughout
- **Refined**: Attention to micro-details and polish

## Frontend Aesthetics Guidelines

### Typography

- Choose **distinctive fonts** that match the design tone
- Avoid generic fonts: Arial, Helvetica, Inter, Roboto (unless intentionally minimal)
- Consider: font pairing, hierarchy, weight contrast, letter-spacing
- Use variable fonts for smooth weight transitions

### Color & Theme

- Build a **cohesive color palette** with CSS custom properties
- Use a **dominant color** with sharp, intentional accents
- Consider: dark/light modes, contrast ratios, color psychology
- Avoid: rainbow gradients, random color combinations, low contrast

### Motion & Animation

- Add **purposeful micro-interactions** that enhance UX
- Use CSS animations/transitions where possible (prefer CSS over JS)
- Consider: entrance animations, hover states, loading states, scroll effects
- Implement **orchestrated reveals** - staggered animations for lists/grids

### Spatial Composition

- Break the grid intentionally - use **asymmetry** and **overlap**
- Leverage **negative space** as a design element
- Consider: visual hierarchy, focal points, reading patterns
- Use unconventional layouts when appropriate

### Backgrounds & Visual Details

- Add **depth** through: gradients, textures, patterns, layered shadows
- Consider: noise textures, grain effects, glassmorphism, mesh gradients
- Use **subtle details** that reward closer inspection

## Anti-Patterns to Avoid

These patterns signal generic AI-generated design:

- ❌ Default Tailwind colors without customization
- ❌ Perfect symmetry everywhere
- ❌ Generic stock photo aesthetics
- ❌ Overused: rounded-full buttons, gradient from purple to blue
- ❌ "Hero section with centered text and CTA button" without personality
- ❌ Sans-serif + blue accent color = corporate blandness
- ❌ Excessive drop shadows on everything
- ❌ Animations that serve no purpose

## Technology Preferences

When building frontend:

1. **HTML/CSS First**: Semantic markup, modern CSS features
2. **Vanilla JS**: For simple interactions, avoid over-engineering
3. **React/Vue/Svelte**: When component architecture is beneficial
4. **Tailwind CSS**: Acceptable, but customize the theme
5. **CSS-in-JS**: When dynamic styling is required

## Accessibility

Never sacrifice accessibility for aesthetics:

- Maintain **WCAG 2.1 AA** contrast ratios minimum
- Ensure **keyboard navigation** works properly
- Use **semantic HTML** elements
- Add **ARIA labels** where needed
- Test with screen readers

---

**Remember**: Great design has opinions. Make bold choices, commit to an aesthetic direction, and polish every detail. Create interfaces that users remember.
