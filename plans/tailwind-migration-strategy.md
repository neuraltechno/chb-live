# Tailwind Migration Strategy

## Recommendation: Stick with Tailwind (Refined)

While "best practice" is often debated, for a modern Next.js project already using Tailwind, **External CSS Modules** usually add more complexity (naming things, mapping files, losing utility speed) without enough benefit.

**The "Clean" Tailwind Approach:**
Instead of moving to external files, we will:
1.  **Eliminate Static `style={{}}`:** Move fixed values (colors, padding, etc.) into Tailwind classes.
2.  **Handle Dynamic Styles Correctly:** Use Tailwind for structure/transition and keep `style={{ width: '...' }}` *only* for truly variable data (like progress bars) where generating hundreds of Tailwind classes is inefficient.
3.  **Use `clsx` or `tailwind-merge`:** For cleaner conditional logic in `className`.

## Migration Plan

### 1. Dynamic Widths (Progress Bars)
Current code:
```tsx
style={{ width: `${(team.count / maxCount) * 100}%` }}
```
**Decision:** Keep these as inline styles. Tailwind is not designed for arbitrary percentages calculated at runtime (e.g., `37.42%`). This is the correct use case for inline styles.

### 2. Conditional Colors
Current code:
```tsx
className={`... ${homeLeads ? homeColor : "bg-dark-600"}`}
```
**Refactor:** Ensure `homeColor` is a valid Tailwind class name (e.g., `bg-primary-500`) rather than a hex code.

### 3. Component Organization
*   Move complex class strings into constants or use the `cn()` utility (standard in shadcn/ui setups) to keep the TSX readable.

## Next Steps
1.  Verify if `tailwind-merge` and `clsx` are installed.
2.  Refactor `MatchStats.tsx` to use semantic Tailwind classes instead of semi-dynamic color strings where possible.
