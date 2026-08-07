# Project Color And Font Scheme

Source files reviewed:

- `src/styles/tokens.css`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/app/layout.tsx`
- PDF generation files using `pdf-lib`

## Summary

The project uses a green academic/administrative palette with light and dark themes. The design system is centralized in `src/styles/tokens.css`, then exposed to Tailwind through `tailwind.config.ts`.

The default app theme is light, set on the root HTML element as `data-theme="light"`. A theme bootstrap script can switch between `light` and `dark` using local storage.

## Fonts

| Role | CSS Variable | Font Family | Weights Imported | Source |
| --- | --- | --- | --- | --- |
| Display / headings | `--font-display`, `--font-heading` | Cabinet Grotesk, sans-serif | 500, 600, 700, 800 | Fontshare |
| Body / app text | `--font-body` | Satoshi, sans-serif | 400, 500, 600, 700 | Fontshare |
| Monospace / numeric data | `--font-mono` | JetBrains Mono, monospace | 400, 500, 600, 700 | Google Fonts |
| Finance body alias | `--font-finance-body` | Satoshi, sans-serif | 400, 500, 600, 700 | Token alias |
| Finance heading alias | `--font-finance-heading` | Cabinet Grotesk, sans-serif | 500, 600, 700, 800 | Token alias |
| Finance mono alias | `--font-finance-mono` | JetBrains Mono, monospace | 400, 500, 600, 700 | Token alias |
| Generated PDFs | n/a | Helvetica / Helvetica Bold | Standard PDF fonts | `pdf-lib` |

Global body text uses `var(--font-body)`. Base headings `h1` through `h4` use `var(--font-heading)`.

## Type Scale

| Token | Size |
| --- | --- |
| `--text-xs` | 11px |
| `--text-sm` | 13px |
| `--text-base` | 15px |
| `--text-md` | 17px |
| `--text-lg` | 20px |
| `--text-xl` | 24px |
| `--text-2xl` | 32px |
| `--text-3xl` | 40px |
| `--text-4xl` | 56px |

## Font Weights

| Token | Weight |
| --- | --- |
| `--weight-regular` | 400 |
| `--weight-medium` | 500 |
| `--weight-semibold` | 600 |
| `--weight-bold` | 700 |
| `--weight-black` | 800 |

## Light Theme Colors

| Role | Token | Value |
| --- | --- | --- |
| Page background | `--color-bg-base` | `#f5f7f5` |
| Surface / cards | `--color-bg-surface` | `#ffffff` |
| Elevated surface | `--color-bg-elevated` | `#ffffff` |
| Overlay surface | `--color-bg-overlay` | `#eaf0eb` |
| Subtle surface | `--color-bg-subtle` | `#eaf0eb` |
| Default border | `--color-border-default` | `#c8d4ca` |
| Muted border | `--color-border-muted` | `rgba(200, 212, 202, 0.72)` |
| Strong border | `--color-border-strong` | `rgba(26, 61, 39, 0.18)` |
| Focus border | `--color-border-focus` | `#2d6b3c` |
| Primary accent | `--color-accent-primary` | `#2d6b3c` |
| Primary accent hover | `--color-accent-primary-hover` | `#1f522d` |
| Primary accent dim | `--color-accent-primary-dim` | `rgba(217, 235, 224, 0.95)` |
| Primary accent glow | `--color-accent-primary-glow` | `rgba(45, 107, 60, 0.16)` |
| Success | `--color-success` | `#059669` |
| Success dim | `--color-success-dim` | `rgba(5, 150, 105, 0.1)` |
| Warning | `--color-warning` | `#d97706` |
| Warning dim | `--color-warning-dim` | `rgba(217, 119, 6, 0.1)` |
| Danger | `--color-danger` | `#e11d48` |
| Danger dim | `--color-danger-dim` | `rgba(225, 29, 72, 0.1)` |
| Info | `--color-info` | `#2563eb` |
| Info dim | `--color-info-dim` | `rgba(37, 99, 235, 0.1)` |
| Primary text | `--color-text-primary` | `#1a3d27` |
| Secondary text | `--color-text-secondary` | `#4a6652` |
| Muted text | `--color-text-muted` | `#4a6652` |
| Inverse text | `--color-text-inverse` | `#f5f7f5` |
| Accent text | `--color-text-accent` | `#122117` |
| Gold alias | `--color-gold` | `#2d6b3c` |
| Gold dim alias | `--color-gold-dim` | `rgba(217, 235, 224, 0.72)` |

## Dark Theme Colors

| Role | Token | Value |
| --- | --- | --- |
| Page background | `--color-bg-base` | `#0a110d` |
| Surface / cards | `--color-bg-surface` | `#162019` |
| Elevated surface | `--color-bg-elevated` | `#1d3526` |
| Overlay surface | `--color-bg-overlay` | `#213128` |
| Subtle surface | `--color-bg-subtle` | `#111914` |
| Default border | `--color-border-default` | `#2b3d30` |
| Muted border | `--color-border-muted` | `rgba(43, 61, 48, 0.62)` |
| Strong border | `--color-border-strong` | `rgba(201, 224, 207, 0.18)` |
| Focus border | `--color-border-focus` | `#3d8a50` |
| Primary accent | `--color-accent-primary` | `#2d6b3c` |
| Primary accent hover | `--color-accent-primary-hover` | `#3d8a50` |
| Primary accent dim | `--color-accent-primary-dim` | `rgba(45, 107, 60, 0.16)` |
| Primary accent glow | `--color-accent-primary-glow` | `rgba(61, 138, 80, 0.24)` |
| Success | `--color-success` | `#10b981` |
| Success dim | `--color-success-dim` | `rgba(16, 185, 129, 0.12)` |
| Warning | `--color-warning` | `#f59e0b` |
| Warning dim | `--color-warning-dim` | `rgba(245, 158, 11, 0.12)` |
| Danger | `--color-danger` | `#f43f5e` |
| Danger dim | `--color-danger-dim` | `rgba(244, 63, 94, 0.12)` |
| Info | `--color-info` | `#60a5fa` |
| Info dim | `--color-info-dim` | `rgba(96, 165, 250, 0.12)` |
| Primary text | `--color-text-primary` | `#c9e0cf` |
| Secondary text | `--color-text-secondary` | `#6b9b78` |
| Muted text | `--color-text-muted` | `#6b9b78` |
| Inverse text | `--color-text-inverse` | `#0a110d` |
| Accent text | `--color-text-accent` | `#3d8a50` |
| Gold alias | `--color-gold` | `#2d6b3c` |
| Gold dim alias | `--color-gold-dim` | `rgba(45, 107, 60, 0.14)` |

## Tailwind Color Aliases

`tailwind.config.ts` maps custom Tailwind colors to CSS RGB tokens:

| Tailwind Name | Source Token |
| --- | --- |
| `primary.50` through `primary.900` | `--color-primary-50-rgb` through `--color-primary-900-rgb` |
| `brand.50` through `brand.900` | Same values as `primary` |
| `ink` | `--color-ink-rgb` |
| `sand` | `--color-slate-50-rgb` |
| `amber` | `--color-amber-rgb` |
| `danger` | `--color-red-rgb` |

## Primary / Brand Scale

This scale feeds both `primary` and `brand` Tailwind color families.

| Step | RGB Token | Hex Equivalent |
| --- | --- | --- |
| 50 | `245 247 245` | `#f5f7f5` |
| 100 | `234 240 235` | `#eaf0eb` |
| 200 | `217 235 224` | `#d9ebe0` |
| 300 | `200 212 202` | `#c8d4ca` |
| 400 | `106 155 120` | `#6a9b78` |
| 500 | `45 107 60` | `#2d6b3c` |
| 600 | `26 61 39` | `#1a3d27` |
| 700 | `18 33 23` | `#122117` |
| 800 | `22 32 25` | `#162019` |
| 900 | `10 17 13` | `#0a110d` |

## Slate / Neutral Scale

Light theme neutral aliases:

| Step | RGB Token | Hex Equivalent |
| --- | --- | --- |
| 50 | `245 247 245` | `#f5f7f5` |
| 100 | `234 240 235` | `#eaf0eb` |
| 200 | `200 212 202` | `#c8d4ca` |
| 300 | `74 102 82` | `#4a6652` |
| 400 | `74 102 82` | `#4a6652` |
| 500 | `26 61 39` | `#1a3d27` |
| 600 | `26 61 39` | `#1a3d27` |
| 700 | `18 33 23` | `#122117` |
| 800 | `18 33 23` | `#122117` |
| 900 | `18 33 23` | `#122117` |

Dark theme overrides:

| Step | RGB Token | Hex Equivalent |
| --- | --- | --- |
| 50 | `10 17 13` | `#0a110d` |
| 100 | `22 32 25` | `#162019` |
| 200 | `29 53 38` | `#1d3526` |
| 300 | `43 61 48` | `#2b3d30` |
| 400 | `107 155 120` | `#6b9b78` |
| 500 | `107 155 120` | `#6b9b78` |
| 600 | `201 224 207` | `#c9e0cf` |
| 700 | `201 224 207` | `#c9e0cf` |
| 800 | `224 235 227` | `#e0ebe3` |
| 900 | `224 235 227` | `#e0ebe3` |

## Other RGB Aliases

Several semantic Tailwind color names are currently mapped back into the same green family:

| Token | RGB | Hex |
| --- | --- | --- |
| `--color-teal-rgb` | `45 107 60` | `#2d6b3c` |
| `--color-blue-rgb` | `45 107 60` | `#2d6b3c` |
| `--color-indigo-rgb` | `29 53 38` | `#1d3526` |
| `--color-violet-rgb` | `61 138 80` | `#3d8a50` |
| `--color-amber-rgb` | `45 107 60` | `#2d6b3c` |
| `--color-orange-rgb` | `61 138 80` | `#3d8a50` |
| `--color-red-rgb` | `45 107 60` | `#2d6b3c` |
| `--color-white-rgb` light | `255 255 255` | `#ffffff` |
| `--color-white-rgb` dark | `22 32 25` | `#162019` |
| `--color-ink-rgb` | `18 33 23` | `#122117` |

## Global Background Treatment

The app body uses layered backgrounds:

- Top-left radial gradient using `--color-accent-primary-dim`
- Top-right radial gradient using `--color-gold-dim`
- Base linear gradient using `--color-bg-base`

## Notes

- The color theme editor supports editing CSS variables and storing custom light/dark themes in local storage.
- The visual identity is predominantly green: deep ink green, botanical primary green, pale green-gray surfaces, and green-tinted neutral scales.
- Some pages also use Tailwind built-ins such as `emerald`, `rose`, `amber`, `slate`, and `blue` for statuses and charts. Those are not central theme tokens, but they appear in feature-specific UI.
- Generated PDFs use Helvetica and reuse the deep green header color through `rgb(0.14, 0.35, 0.25)`, approximately `#245940`.
