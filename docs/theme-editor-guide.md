# Theme Editor Guide

This project includes a floating global Theme Editor that lets you preview, save, export, import, and manage custom color themes live across the app.

Main files:

- [src/components/ThemeEditor/ThemeEditor.tsx](/Users/victoryakubu/Desktop/futurerealm/school%20management%20system/src/components/ThemeEditor/ThemeEditor.tsx)
- [src/app/layout.tsx](/Users/victoryakubu/Desktop/futurerealm/school%20management%20system/src/app/layout.tsx)
- [src/styles/tokens.css](/Users/victoryakubu/Desktop/futurerealm/school%20management%20system/src/styles/tokens.css)

## What It Does

The Theme Editor:

- discovers color-related CSS custom properties from the active theme
- lets you change them live with instant app-wide preview
- saves custom theme overrides to `localStorage`
- supports separate light and dark mode custom palettes
- lets you export and import theme JSON
- supports named local presets
- lets you revert fully back to the shipped defaults

## Where To Find It

The Theme Editor is available on every page because it is mounted in the root layout.

Look for the floating palette button on the right side of the screen.

- Click the palette button to open the editor.
- Click it again, or use the close button, to hide the panel.

## Basic Workflow

### 1. Open the editor

Click the floating palette button on the right edge of the app.

### 2. Search for a variable

Use the `Search Variables` field to quickly filter tokens like:

- `accent`
- `border`
- `text`
- `bg`

### 3. Edit a color

Each variable row shows:

- the CSS variable name
- a native color picker
- the current value field

You can change a token in two ways:

- click the color picker
- type a color value into the text field

Changes apply immediately to `document.documentElement`, so the whole app updates live without reload.

### 4. Save the current theme

Click `Save Theme`.

This stores the current mode’s custom overrides in:

- `custom-theme`

The saved theme is restored automatically on refresh.

## Light And Dark Mode Behavior

The editor works per active mode.

- If you are in `light` mode, you edit and save the light-mode overrides.
- If you are in `dark` mode, you edit and save the dark-mode overrides.

Both can live together inside the same saved payload.

## Revert To Default

Click `Revert to Default` to completely reset the custom theme.

This does two things:

- removes the saved `custom-theme` item from `localStorage`
- removes inline CSS variable overrides from `:root`

After that, the app falls back to the original values defined in the source CSS tokens.

That means the reset always returns to the shipped defaults from [src/styles/tokens.css](/Users/victoryakubu/Desktop/futurerealm/school%20management%20system/src/styles/tokens.css).

## Import And Export

### Export

Click `Export`.

This:

- generates JSON for the current saved theme structure
- opens the import/export textarea
- tries to copy the JSON to your clipboard

Example structure:

```json
{
  "light": {
    "--color-bg-base": "#f5f7f5",
    "--color-accent-primary": "#2d6b3c"
  },
  "dark": {
    "--color-bg-base": "#0a110d",
    "--color-accent-primary": "#3d8a50"
  }
}
```

### Import

Click `Import`, paste valid theme JSON into the textarea, then click `Apply Import`.

Valid import rules:

- top-level object
- optional `light` and `dark` keys
- each mode contains CSS custom property name/value pairs
- keys must start with `--`
- values must be strings

The imported theme is applied immediately and saved to `custom-theme`.

## Presets

Presets are local named snapshots of theme payloads.

They are stored in:

- `custom-theme-presets`

### Save a preset

1. Enter a preset name.
2. Click `Save`.

If the name already exists, the preset is updated.

### Apply a preset

Click `Apply` on any preset card.

That preset becomes the active saved theme and updates the app immediately.

### Rename a preset

Click the pencil button, update the name, then click `Save`.

### Duplicate a preset

Click the duplicate button to create a copy you can edit independently.

### Delete a preset

Click `Delete` to remove it from the browser.

### Active preset badge

If a preset matches the currently saved theme for the active mode, it shows an `Active` badge.

### Preset swatches

Each preset shows a quick visual preview strip based on representative tokens like:

- base background
- surface background
- primary accent
- primary text

## Search In The Variable List

The editor supports live filtering by:

- variable name
- raw saved value
- current applied value

Examples:

- searching `primary` finds brand-related variables
- searching `#0a110d` finds matching dark values
- searching `rgb` can help locate triplet-style tokens

## Data Storage

The Theme Editor uses browser `localStorage`.

Keys:

- `custom-theme`
- `custom-theme-presets`
- `sms-theme` for the separate light/dark mode selection

This means:

- theme changes are browser-local
- presets are browser-local
- they are not shared automatically across users or devices unless exported/imported manually

## First Paint Behavior

The root layout restores saved theme values before React finishes booting.

That logic lives in [src/app/layout.tsx](/Users/victoryakubu/Desktop/futurerealm/school%20management%20system/src/app/layout.tsx).

This helps avoid a flash where the app loads with default colors before saved custom colors are applied.

## Notes For Developers

The editor is intentionally dynamic.

It does not hardcode a list of color variable names. Instead it:

1. reads stylesheets for `:root` and `:root[data-theme="light"|"dark"]`
2. captures default token values
3. resolves which CSS custom properties behave like colors
4. lets users edit only those color-capable variables

It also handles both:

- direct color tokens like `#2d6b3c`
- RGB triplet tokens like `45 107 60`

## Recommended Usage

For design exploration:

1. switch to the mode you want to edit
2. search for a token family like `accent` or `bg`
3. tweak colors live
4. save the theme
5. save a named preset
6. export JSON if you want to move it elsewhere

For safe experimentation:

1. duplicate a preset first
2. edit the duplicate
3. compare visually
4. revert to default anytime if needed

## Troubleshooting

### My changes are not persisting

Make sure you clicked `Save Theme`.

Live preview alone does not guarantee persistence across refreshes unless the theme is saved.

### Revert did not keep my preset

That is expected.

`Revert to Default` clears the active saved theme from `custom-theme`, but it does not delete your preset library unless you manually remove presets.

### A variable does not appear in the editor

Only variables that successfully resolve as colors are shown.

Non-color tokens like spacing, typography, or plain layout values are intentionally excluded.

### A preset does not show as active

The active badge compares the preset against the currently saved theme for the current mode only.

## Future Extensions

Good next enhancements if needed:

- restrict the editor to admin/dev roles only
- add preset folders or tags
- add download as `.json` file
- add side-by-side comparison mode
- add token grouping by family such as `background`, `text`, `accent`, `border`
