"use client";

import { Copy, Download, Palette, Pencil, RotateCcw, Save, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import { useTheme } from "@/components/theme/theme-provider";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

type ThemeMode = "light" | "dark";
type VariableFormat = "color" | "triplet";

type SavedThemes = Partial<Record<ThemeMode, Record<string, string>>>;
type ThemePreset = {
  id: string;
  name: string;
  themes: SavedThemes;
  updatedAt: string;
};

type ThemeEditorEntry = {
  name: string;
  rawValue: string;
  appliedValue: string;
  inputValue: string;
  defaultValue: string;
  format: VariableFormat;
};

type ThemeShadowEntry = {
  name: string;
  rawValue: string;
  inputValue: string;
  defaultValue: string;
  enabled: boolean;
  lastEnabledValue: string;
};

const STORAGE_KEY = "custom-theme";
const PRESET_STORAGE_KEY = "custom-theme-presets";
const SHADOWS_DISABLED_KEY = "custom-theme-shadows-disabled";

function readSavedThemes(): SavedThemes {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as SavedThemes : {};
  } catch {
    return {};
  }
}

function writeSavedThemes(value: SavedThemes) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function readThemePresets(): ThemePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRESET_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const source = item as Record<string, unknown>;
        const name = typeof source.name === "string" ? source.name.trim() : "";
        const themes = sanitizeImportedThemes(source.themes);
        if (!name || !themes) return null;

        return {
          id: typeof source.id === "string" ? source.id : `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          themes,
          updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
        } satisfies ThemePreset;
      })
      .filter((item): item is ThemePreset => Boolean(item));
  } catch {
    return [];
  }
}

function writeThemePresets(value: ThemePreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(value));
}

function readShadowsDisabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SHADOWS_DISABLED_KEY) === "true";
}

function writeShadowsDisabled(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(SHADOWS_DISABLED_KEY, "true");
    return;
  }

  window.localStorage.removeItem(SHADOWS_DISABLED_KEY);
}

function applyGlobalShadowState(disabled: boolean) {
  if (typeof document === "undefined") return;

  if (disabled) {
    document.documentElement.setAttribute("data-theme-editor-shadows", "off");
    return;
  }

  document.documentElement.removeAttribute("data-theme-editor-shadows");
}

function sanitizeImportedThemes(value: unknown): SavedThemes | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const next: SavedThemes = {};

  for (const mode of ["light", "dark"] as const) {
    const modeValue = source[mode];
    if (!modeValue || typeof modeValue !== "object") continue;

    const entries = Object.entries(modeValue as Record<string, unknown>).filter(
      ([name, token]) => name.startsWith("--") && typeof token === "string",
    );

    if (entries.length > 0) {
      next[mode] = Object.fromEntries(entries);
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

function presetSwatches(themes: SavedThemes, mode: ThemeMode) {
  const themeValues = themes[mode] ?? {};
  const fallbacks = themes.light ?? themes.dark ?? {};
  const pick = (name: string) => themeValues[name] ?? fallbacks[name] ?? null;

  return [
    pick("--color-bg-base"),
    pick("--color-bg-surface"),
    pick("--color-accent-primary"),
    pick("--color-text-primary"),
  ].filter((value): value is string => Boolean(value));
}

function swatchesFromThemeRecord(record: Record<string, string>) {
  const pick = (name: string) => record[name] ?? null;

  return [
    pick("--color-bg-base"),
    pick("--color-bg-surface"),
    pick("--color-accent-primary"),
    pick("--color-text-primary"),
  ].filter((value): value is string => Boolean(value));
}

function sameThemeRecord(left: Record<string, string> = {}, right: Record<string, string> = {}) {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));

  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([name, value], index) => {
    const rightEntry = rightEntries[index];
    return rightEntry && rightEntry[0] === name && rightEntry[1] === value;
  });
}

function isRgbTriplet(value: string) {
  return /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(value.trim());
}

function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (!/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return null;
  const hex = trimmed.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    return `#${hex
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toLowerCase()}`;
  }

  return `#${hex.toLowerCase()}`;
}

function rgbaToHex(value: { r: number; g: number; b: number; a: number }) {
  const clamp = (channel: number) => Math.max(0, Math.min(255, Math.round(channel)));
  const toHex = (channel: number) => clamp(channel).toString(16).padStart(2, "0");
  const alpha = Math.max(0, Math.min(1, value.a));

  if (alpha >= 0.999) {
    return `#${toHex(value.r)}${toHex(value.g)}${toHex(value.b)}`;
  }

  return `#${toHex(value.r)}${toHex(value.g)}${toHex(value.b)}${toHex(alpha * 255)}`;
}

function hexToTriplet(value: string) {
  const normalized = normalizeHex(value);
  if (!normalized) return null;

  const hex = normalized.slice(1);
  return `${Number.parseInt(hex.slice(0, 2), 16)} ${Number.parseInt(hex.slice(2, 4), 16)} ${Number.parseInt(hex.slice(4, 6), 16)}`;
}

function parseResolvedColor(value: string) {
  const normalizedHex = normalizeHex(value);
  if (normalizedHex) {
    const hex = normalizedHex.slice(1);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;

  const parts = match[1]
    .split(/[,\s/]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  return {
    r: Number.parseFloat(parts[0]),
    g: Number.parseFloat(parts[1]),
    b: Number.parseFloat(parts[2]),
    a: parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1,
  };
}

function ensureProbe(probeRef: MutableRefObject<HTMLSpanElement | null>) {
  if (probeRef.current || typeof document === "undefined") return probeRef.current;

  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "fixed";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  probeRef.current = probe;
  return probe;
}

function resolveColorExpression(expression: string, probeRef: MutableRefObject<HTMLSpanElement | null>) {
  const probe = ensureProbe(probeRef);
  if (!probe) return null;

  const sentinels = ["rgb(1, 2, 3)", "rgb(3, 2, 1)"];

  for (const sentinel of sentinels) {
    probe.style.color = sentinel;
    probe.style.color = expression;

    const resolved = window.getComputedStyle(probe).color;
    if (resolved === sentinel) continue;

    const parsed = parseResolvedColor(resolved);
    if (parsed) return { parsed, resolved };
  }

  return null;
}

function resolveVariableColor(name: string, rawValue: string, probeRef: MutableRefObject<HTMLSpanElement | null>) {
  const candidates = [
    rawValue ? `var(${name})` : "",
    rawValue ? `rgb(var(${name}))` : "",
    rawValue,
    isRgbTriplet(rawValue) ? `rgb(${rawValue})` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = resolveColorExpression(candidate, probeRef);
    if (resolved) return resolved;
  }

  return null;
}

function collectRules(list: CSSRuleList, generic: CSSStyleRule[], themed: CSSStyleRule[], theme: ThemeMode) {
  for (const rule of Array.from(list)) {
    if (rule instanceof CSSStyleRule) {
      const selectors = rule.selectorText
        .split(",")
        .map((selector) => selector.trim());

      if (selectors.includes(":root")) generic.push(rule);
      if (selectors.includes(`:root[data-theme="${theme}"]`)) themed.push(rule);
      continue;
    }

    if ("cssRules" in rule) {
      try {
        collectRules((rule as CSSGroupingRule).cssRules, generic, themed, theme);
      } catch {
        continue;
      }
    }
  }
}

function captureStylesheetDefaults(theme: ThemeMode) {
  const genericRules: CSSStyleRule[] = [];
  const themedRules: CSSStyleRule[] = [];

  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      if (!styleSheet.cssRules) continue;
      collectRules(styleSheet.cssRules, genericRules, themedRules, theme);
    } catch {
      continue;
    }
  }

  const defaults: Record<string, string> = {};
  const formats: Record<string, VariableFormat> = {};

  for (const rule of [...genericRules, ...themedRules]) {
    for (const propertyName of Array.from(rule.style)) {
      if (!propertyName.startsWith("--")) continue;

      const value = rule.style.getPropertyValue(propertyName).trim();
      defaults[propertyName] = value;
      formats[propertyName] = isRgbTriplet(value) ? "triplet" : "color";
    }
  }

  return { defaults, formats };
}

function isShadowToken(name: string, value: string) {
  const tokenName = name.trim().toLowerCase();
  const tokenValue = value.trim().toLowerCase();

  return tokenName.includes("shadow")
    || tokenValue.includes("drop-shadow(");
}

function discoverColorEntries(
  theme: ThemeMode,
  defaultValues: Record<string, string>,
  defaultFormats: Record<string, VariableFormat>,
  probeRef: MutableRefObject<HTMLSpanElement | null>,
) {
  const root = document.documentElement;
  const computed = window.getComputedStyle(root);
  const variableNames = new Set<string>(Object.keys(defaultValues));

  for (const propertyName of Array.from(computed)) {
    if (propertyName.startsWith("--")) {
      variableNames.add(propertyName);
    }
  }

  const entries = Array.from(variableNames)
    .map((name) => {
      const inlineValue = root.style.getPropertyValue(name).trim();
      const defaultValue = defaultValues[name] ?? computed.getPropertyValue(name).trim();
      const rawValue = inlineValue || defaultValue;
      const resolved = resolveVariableColor(name, rawValue, probeRef);

      if (!resolved) return null;

      const hexValue = rgbaToHex(resolved.parsed);
      return {
        name,
        rawValue,
        appliedValue: hexValue,
        inputValue: hexValue,
        defaultValue,
        format: defaultFormats[name] ?? (isRgbTriplet(defaultValue) ? "triplet" : "color"),
        theme,
      } satisfies ThemeEditorEntry & { theme: ThemeMode };
    })
    .filter((entry): entry is ThemeEditorEntry & { theme: ThemeMode } => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name));

  return entries;
}

function discoverShadowEntries(theme: ThemeMode, defaultValues: Record<string, string>) {
  const root = document.documentElement;
  const computed = window.getComputedStyle(root);
  const variableNames = new Set<string>(Object.keys(defaultValues));

  for (const propertyName of Array.from(computed)) {
    if (propertyName.startsWith("--")) {
      variableNames.add(propertyName);
    }
  }

  return Array.from(variableNames)
    .map((name) => {
      const inlineValue = root.style.getPropertyValue(name).trim();
      const computedValue = computed.getPropertyValue(name).trim();
      const defaultValue = defaultValues[name] ?? computedValue;
      const rawValue = inlineValue || computedValue || defaultValue;

      if (!rawValue || !isShadowToken(name, rawValue || defaultValue)) return null;

      const enabled = rawValue.toLowerCase() !== "none";
      const fallbackEnabledValue = defaultValue.toLowerCase() !== "none" ? defaultValue : "";

      return {
        name,
        rawValue,
        inputValue: enabled ? rawValue : fallbackEnabledValue || rawValue,
        defaultValue,
        enabled,
        lastEnabledValue: enabled ? rawValue : fallbackEnabledValue,
        theme,
      } satisfies ThemeShadowEntry & { theme: ThemeMode };
    })
    .filter((entry): entry is ThemeShadowEntry & { theme: ThemeMode } => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function ThemeEditor() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ThemeEditorEntry[]>([]);
  const [shadowEntries, setShadowEntries] = useState<ThemeShadowEntry[]>([]);
  const [allShadowsDisabled, setAllShadowsDisabled] = useState(false);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedPresetBaseline, setSelectedPresetBaseline] = useState<Record<string, string> | null>(null);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const defaultsRef = useRef<Record<ThemeMode, Record<string, string>>>({ light: {}, dark: {} });
  const formatsRef = useRef<Record<ThemeMode, Record<string, VariableFormat>>>({ light: {}, dark: {} });
  const knownVariablesRef = useRef<Set<string>>(new Set());
  const probeRef = useRef<HTMLSpanElement | null>(null);

  const applySavedThemeForMode = (mode: ThemeMode, variableNames: string[], source = readSavedThemes()) => {
    const root = document.documentElement;
    const namesToReset = new Set<string>([
      ...variableNames,
      ...knownVariablesRef.current,
      ...Object.keys(source.light ?? {}),
      ...Object.keys(source.dark ?? {}),
    ]);

    for (const name of namesToReset) {
      root.style.removeProperty(name);
    }

    for (const [name, value] of Object.entries(source[mode] ?? {})) {
      root.style.setProperty(name, value);
    }
  };

  const refreshEntries = (mode: ThemeMode) => {
    const snapshot = captureStylesheetDefaults(mode);
    defaultsRef.current[mode] = snapshot.defaults;
    formatsRef.current[mode] = snapshot.formats;

    const nextEntries = discoverColorEntries(mode, snapshot.defaults, snapshot.formats, probeRef);
    const nextShadowEntries = discoverShadowEntries(mode, snapshot.defaults);
    [...nextEntries, ...nextShadowEntries].forEach((entry) => knownVariablesRef.current.add(entry.name));
    applySavedThemeForMode(mode, [...nextEntries, ...nextShadowEntries].map((entry) => entry.name));

    const hydratedEntries = discoverColorEntries(mode, snapshot.defaults, snapshot.formats, probeRef);
    const hydratedShadowEntries = discoverShadowEntries(mode, snapshot.defaults);
    [...hydratedEntries, ...hydratedShadowEntries].forEach((entry) => knownVariablesRef.current.add(entry.name));
    setEntries(hydratedEntries);
    setShadowEntries(hydratedShadowEntries);
  };

  useEffect(() => {
    ensureProbe(probeRef);
    setPresets(readThemePresets());
    const shadowsDisabled = readShadowsDisabled();
    setAllShadowsDisabled(shadowsDisabled);
    applyGlobalShadowState(shadowsDisabled);
    refreshEntries(theme);

    return () => {
      if (probeRef.current) {
        probeRef.current.remove();
        probeRef.current = null;
      }
    };
  }, [theme]);

  useEffect(() => {
    if (selectedPresetId && !presets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId(null);
      setSelectedPresetBaseline(null);
    }
  }, [presets, selectedPresetId]);

  useEffect(() => {
    applyGlobalShadowState(allShadowsDisabled);
  }, [allShadowsDisabled]);

  const groupedCount = useMemo(() => entries.length + shadowEntries.length, [entries.length, shadowEntries.length]);
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      return entry.name.toLowerCase().includes(query)
        || entry.rawValue.toLowerCase().includes(query)
        || entry.appliedValue.toLowerCase().includes(query);
    });
  }, [entries, search]);
  const filteredShadowEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return shadowEntries;
    return shadowEntries.filter((entry) => {
      return entry.name.toLowerCase().includes(query)
        || entry.rawValue.toLowerCase().includes(query)
        || entry.inputValue.toLowerCase().includes(query)
        || (entry.enabled ? "enabled" : "disabled").includes(query);
    });
  }, [shadowEntries, search]);
  const activeThemePayload = useMemo(() => {
    const savedThemes = readSavedThemes();
    return savedThemes[theme] ?? {};
  }, [entries, shadowEntries, theme]);
  const currentModePayload = useMemo(
    () =>
      Object.fromEntries([
        ...entries.map((entry) => [entry.name, entry.rawValue] as const),
        ...shadowEntries.map((entry) => [entry.name, entry.rawValue] as const),
      ]),
    [entries, shadowEntries],
  );
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );
  const isSelectedPresetDirty = useMemo(() => {
    if (!selectedPreset || !selectedPresetBaseline) return false;
    return !sameThemeRecord(selectedPresetBaseline, currentModePayload);
  }, [currentModePayload, selectedPreset, selectedPresetBaseline]);
  const selectedPresetDiffCount = useMemo(() => {
    if (!selectedPresetBaseline) return 0;
    const names = new Set([
      ...Object.keys(selectedPresetBaseline),
      ...Object.keys(currentModePayload),
    ]);

    return Array.from(names).filter((name) => selectedPresetBaseline[name] !== currentModePayload[name]).length;
  }, [currentModePayload, selectedPresetBaseline]);
  const selectedPresetBaselineSwatches = useMemo(
    () => (selectedPresetBaseline ? swatchesFromThemeRecord(selectedPresetBaseline) : []),
    [selectedPresetBaseline],
  );
  const currentDraftSwatches = useMemo(
    () => swatchesFromThemeRecord(currentModePayload),
    [currentModePayload],
  );

  function updateEntryDraft(name: string, inputValue: string) {
    setEntries((current) => current.map((entry) => (entry.name === name ? { ...entry, inputValue } : entry)));
  }

  function commitEntry(name: string, nextColor: string) {
    const parsed = resolveColorExpression(nextColor, probeRef);
    if (!parsed) return false;

    const format = formatsRef.current[theme][name] ?? "color";
    const normalizedColor = rgbaToHex(parsed.parsed);
    const rawValue = format === "triplet" ? (hexToTriplet(normalizedColor) ?? nextColor.trim()) : normalizedColor;

    document.documentElement.style.setProperty(name, rawValue);
    knownVariablesRef.current.add(name);

    setEntries((current) =>
      current.map((entry) =>
        entry.name === name
          ? {
              ...entry,
              rawValue,
              appliedValue: normalizedColor,
              inputValue: normalizedColor,
            }
          : entry,
      ),
    );

    return true;
  }

  function saveTheme() {
    const savedThemes = readSavedThemes();
    const nextSavedThemes: SavedThemes = {
      ...savedThemes,
      [theme]: currentModePayload,
    };

    writeSavedThemes(nextSavedThemes);
    showToast({
      title: "Theme saved",
      description: `Your ${theme} palette will be restored on the next visit.`,
      variant: "success",
    });
  }

  function currentThemePayload(): SavedThemes {
    const savedThemes = readSavedThemes();
    return {
      ...savedThemes,
      [theme]: currentModePayload,
    };
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) {
      showToast({
        title: "Preset name required",
        description: "Give this palette a name before saving it as a preset.",
        variant: "warning",
      });
      return;
    }

    const payload = currentThemePayload();
    const currentPresets = readThemePresets();
    const existing = currentPresets.find((preset) => preset.name.toLowerCase() === name.toLowerCase());
    const nextPreset: ThemePreset = {
      id: existing?.id ?? `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`,
      name,
      themes: payload,
      updatedAt: new Date().toISOString(),
    };
    const nextPresets = existing
      ? currentPresets.map((preset) => (preset.id === existing.id ? nextPreset : preset))
      : [nextPreset, ...currentPresets];

    writeThemePresets(nextPresets);
    setPresets(nextPresets);
    setPresetName("");
    setSelectedPresetId(nextPreset.id);
    setSelectedPresetBaseline(currentModePayload);
    showToast({
      title: existing ? "Preset updated" : "Preset saved",
      description: `"${name}" is now available in your local preset library.`,
      variant: "success",
    });
  }

  function applyPreset(preset: ThemePreset) {
    writeSavedThemes(preset.themes);
    applySavedThemeForMode(
      theme,
      [...entries, ...shadowEntries].map((entry) => entry.name),
      preset.themes,
    );
    const nextBaseline = Object.fromEntries(
      [...entries, ...shadowEntries].map((entry) => [
        entry.name,
        preset.themes[theme]?.[entry.name]
          ?? defaultsRef.current[theme][entry.name]
          ?? entry.rawValue,
      ] as const),
    );
    setSelectedPresetId(preset.id);
    setSelectedPresetBaseline(nextBaseline);
    refreshEntries(theme);
    showToast({
      title: "Preset applied",
      description: `"${preset.name}" is now live for ${theme} mode and ready to fine-tune.`,
      variant: "success",
    });
  }

  function updateSelectedPreset() {
    if (!selectedPreset) return;

    const payload = currentThemePayload();
    const nextPresets = readThemePresets().map((preset) =>
      preset.id === selectedPreset.id
        ? {
            ...preset,
            themes: payload,
            updatedAt: new Date().toISOString(),
          }
        : preset,
    );

    writeThemePresets(nextPresets);
    setPresets(nextPresets);
    setSelectedPresetBaseline(currentModePayload);
    showToast({
      title: "Preset updated",
      description: `"${selectedPreset.name}" now reflects your latest tweaks.`,
      variant: "success",
    });
  }

  function startRenamingPreset(preset: ThemePreset) {
    setRenamingPresetId(preset.id);
    setRenameValue(preset.name);
  }

  function savePresetRename(presetId: string) {
    const nextName = renameValue.trim();
    if (!nextName) {
      showToast({
        title: "Preset name required",
        description: "Rename the preset with a non-empty name.",
        variant: "warning",
      });
      return;
    }

    const nextPresets = readThemePresets().map((preset) =>
      preset.id === presetId ? { ...preset, name: nextName, updatedAt: new Date().toISOString() } : preset,
    );
    writeThemePresets(nextPresets);
    setPresets(nextPresets);
    setRenamingPresetId(null);
    setRenameValue("");
    showToast({
      title: "Preset renamed",
      description: `This preset is now called "${nextName}".`,
      variant: "success",
    });
  }

  function duplicatePreset(preset: ThemePreset) {
    const nextPresets = readThemePresets();
    const nextNameBase = `${preset.name} Copy`;
    let nextName = nextNameBase;
    let suffix = 2;

    while (nextPresets.some((item) => item.name.toLowerCase() === nextName.toLowerCase())) {
      nextName = `${nextNameBase} ${suffix}`;
      suffix += 1;
    }

    const duplicate: ThemePreset = {
      id: `${nextName.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`,
      name: nextName,
      themes: preset.themes,
      updatedAt: new Date().toISOString(),
    };

    const updatedPresets = [duplicate, ...nextPresets];
    writeThemePresets(updatedPresets);
    setPresets(updatedPresets);
    showToast({
      title: "Preset duplicated",
      description: `"${nextName}" is ready to edit independently.`,
      variant: "success",
    });
  }

  function deletePreset(presetId: string) {
    const nextPresets = readThemePresets().filter((preset) => preset.id !== presetId);
    writeThemePresets(nextPresets);
    setPresets(nextPresets);
    showToast({
      title: "Preset removed",
      description: "The preset has been deleted from this browser.",
      variant: "info",
    });
  }

  async function exportTheme() {
    const payload = currentThemePayload();
    const serialized = JSON.stringify(payload, null, 2);
    setImportValue(serialized);
    setImportOpen(true);

    try {
      await navigator.clipboard.writeText(serialized);
      showToast({
        title: "Theme exported",
        description: "The theme JSON has been copied to your clipboard.",
        variant: "success",
      });
    } catch {
      showToast({
        title: "Theme ready to copy",
        description: "Clipboard access was unavailable, so the JSON is shown in the import/export box.",
        variant: "info",
      });
    }
  }

  function importTheme() {
    let parsed: unknown;

    try {
      parsed = JSON.parse(importValue);
    } catch {
      showToast({
        title: "Import failed",
        description: "The pasted theme is not valid JSON.",
        variant: "error",
      });
      return;
    }

    const sanitized = sanitizeImportedThemes(parsed);
    if (!sanitized) {
      showToast({
        title: "Import failed",
        description: "Expected an object with light and/or dark CSS variable maps.",
        variant: "error",
      });
      return;
    }

    writeSavedThemes(sanitized);
    applySavedThemeForMode(
      theme,
      [...entries, ...shadowEntries].map((entry) => entry.name),
      sanitized,
    );
    setSelectedPresetId(null);
    setSelectedPresetBaseline(null);
    refreshEntries(theme);
    showToast({
      title: "Theme imported",
      description: `Imported ${Object.keys(sanitized[theme] ?? {}).length} ${theme} mode overrides.`,
      variant: "success",
    });
  }

  function revertToDefault() {
    window.localStorage.removeItem(STORAGE_KEY);
    writeShadowsDisabled(false);

    for (const name of knownVariablesRef.current) {
      document.documentElement.style.removeProperty(name);
    }

    setAllShadowsDisabled(false);
    setSelectedPresetId(null);
    setSelectedPresetBaseline(null);
    refreshEntries(theme);
    showToast({
      title: "Theme reset",
      description: "The original color tokens have been restored.",
      variant: "info",
    });
  }

  function updateShadowDraft(name: string, inputValue: string) {
    setShadowEntries((current) =>
      current.map((entry) =>
        entry.name === name
          ? {
              ...entry,
              inputValue,
              lastEnabledValue: inputValue.trim() && inputValue.trim().toLowerCase() !== "none" ? inputValue.trim() : entry.lastEnabledValue,
            }
          : entry,
      ),
    );
  }

  function commitShadowEntry(name: string, nextValue: string, options?: { apply?: boolean; enabled?: boolean }) {
    const trimmed = nextValue.trim();
    const safeValue = trimmed || "none";
    const nextEnabled = options?.enabled ?? safeValue.toLowerCase() !== "none";
    const shouldApply = options?.apply ?? nextEnabled;
    const appliedValue = shouldApply ? safeValue : "none";

    document.documentElement.style.setProperty(name, appliedValue);
    knownVariablesRef.current.add(name);

    setShadowEntries((current) =>
      current.map((entry) => {
        if (entry.name !== name) return entry;

        const nextLastEnabledValue = nextEnabled
          ? (safeValue.toLowerCase() === "none" ? entry.lastEnabledValue : safeValue)
          : (entry.inputValue.trim() && entry.inputValue.trim().toLowerCase() !== "none" ? entry.inputValue.trim() : entry.lastEnabledValue);

        return {
          ...entry,
          rawValue: appliedValue,
          inputValue: nextEnabled ? safeValue : entry.inputValue,
          enabled: nextEnabled,
          lastEnabledValue: nextLastEnabledValue,
        };
      }),
    );
  }

  function toggleShadow(name: string) {
    const entry = shadowEntries.find((item) => item.name === name);
    if (!entry) return;

    if (entry.enabled) {
      commitShadowEntry(name, "none", { apply: true, enabled: false });
      return;
    }

    const restoredValue = entry.lastEnabledValue || (entry.defaultValue.toLowerCase() !== "none" ? entry.defaultValue : "") || entry.inputValue || "none";
    commitShadowEntry(name, restoredValue, { apply: true, enabled: true });
  }

  function toggleAllShadows() {
    const nextValue = !allShadowsDisabled;
    setAllShadowsDisabled(nextValue);
    writeShadowsDisabled(nextValue);
    showToast({
      title: nextValue ? "All shadows disabled" : "All shadows restored",
      description: nextValue
        ? "Box-shadow output is suppressed across the app while you inspect a flatter look."
        : "The app is using its normal shadow rendering again.",
      variant: "info",
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed right-4 top-1/2 z-[600] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] transition hover:-translate-y-[calc(50%+2px)]"
        aria-label={open ? "Close theme editor" : "Open theme editor"}
      >
        {open ? <X className="h-5 w-5" /> : <Palette className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          "fixed right-0 top-0 z-[590] flex h-[100dvh] w-[min(34rem,calc(100vw-1rem))] flex-col overflow-y-auto overscroll-contain border-l border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)] transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="shrink-0 border-b border-[var(--color-border-default)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">Theme Studio</p>
              <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-[var(--color-text-primary)]">Color Theme Editor</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Editing {theme} mode tokens live across the app.
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">
              {filteredEntries.length + filteredShadowEntries.length}/{groupedCount} vars
            </span>
          </div>

          <div className="mt-4">
            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Search Variables
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by variable name or value..."
                  className="h-10 flex-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm normal-case tracking-normal text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-4 py-2 text-sm font-semibold normal-case tracking-normal text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveTheme}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
            >
              <Save className="h-4 w-4" />
              Save Theme
            </button>
            <button
              type="button"
              onClick={() => {
                void exportTheme();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={() => setImportOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button
              type="button"
              onClick={revertToDefault}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
            >
              <RotateCcw className="h-4 w-4" />
              Revert to Default
            </button>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Presets
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="e.g. Forest Light"
                className="h-10 flex-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
              />
              <button
                type="button"
                onClick={savePreset}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {presets.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  No presets saved yet. Save the current palette to switch back to it anytime.
                </p>
              ) : (
                presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {renamingPresetId === preset.id ? (
                          <input
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                          />
                        ) : (
                          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{preset.name}</p>
                        )}
                        {sameThemeRecord(preset.themes[theme] ?? {}, activeThemePayload) ? (
                          <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Updated {new Date(preset.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {presetSwatches(preset.themes, theme).map((swatch, index) => (
                          <span
                            key={`${preset.id}-${index}-${swatch}`}
                            className="h-5 w-5 rounded-full border border-[var(--color-border-default)] shadow-sm"
                            style={{ backgroundColor: isRgbTriplet(swatch) ? `rgb(${swatch})` : swatch }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {renamingPresetId === preset.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => savePresetRename(preset.id)}
                            className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingPresetId(null);
                              setRenameValue("");
                            }}
                            className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startRenamingPreset(preset)}
                            className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]"
                            aria-label={`Rename ${preset.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicatePreset(preset)}
                            className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]"
                            aria-label={`Duplicate ${preset.name}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePreset(preset.id)}
                        className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedPreset ? (
              <div className="mt-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      Editing preset: {selectedPreset.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Every token stays editable here, so you can keep tweaking until the preset feels right.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                      isSelectedPresetDirty
                        ? "bg-[var(--color-warning-dim)] text-[var(--color-warning)]"
                        : "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
                    )}
                  >
                    {isSelectedPresetDirty ? "Draft changed" : "In sync"}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      Saved preset
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {selectedPresetBaselineSwatches.map((swatch, index) => (
                        <span
                          key={`baseline-${index}-${swatch}`}
                          className="h-6 w-6 rounded-full border border-[var(--color-border-default)]"
                          style={{ backgroundColor: isRgbTriplet(swatch) ? `rgb(${swatch})` : swatch }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      Current draft
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {currentDraftSwatches.map((swatch, index) => (
                        <span
                          key={`draft-${index}-${swatch}`}
                          className="h-6 w-6 rounded-full border border-[var(--color-border-default)]"
                          style={{ backgroundColor: isRgbTriplet(swatch) ? `rgb(${swatch})` : swatch }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  {selectedPresetDiffCount} token{selectedPresetDiffCount === 1 ? "" : "s"} changed between the saved preset and your live draft.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={updateSelectedPreset}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
                  >
                    <Save className="h-4 w-4" />
                    Update Active Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicatePreset(selectedPreset)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate as Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(null);
                      setSelectedPresetBaseline(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]"
                  >
                    <X className="h-4 w-4" />
                    Stop Editing Preset
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {importOpen ? (
            <div className="mt-4 rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-3">
              <label className="grid gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                Import or Export JSON
                <textarea
                  value={importValue}
                  onChange={(event) => setImportValue(event.target.value)}
                  className="min-h-36 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-3 font-mono text-xs normal-case tracking-normal text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                  placeholder='{"light":{"--color-bg-base":"#f5f7f5"},"dark":{"--color-bg-base":"#0a110d"}}'
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={importTheme}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
                >
                  <Upload className="h-4 w-4" />
                  Apply Import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportValue("");
                    setImportOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 px-4 py-4">
          <div className="grid gap-3">
            {filteredEntries.length === 0 && filteredShadowEntries.length === 0 ? (
              <div className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-4 text-sm text-[var(--color-text-secondary)]">
                No theme variables match <span className="font-mono text-[var(--color-text-primary)]">{search}</span>.
              </div>
            ) : null}
            {filteredShadowEntries.length > 0 ? (
              <div className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      Shadows
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Edit box-shadow and drop-shadow tokens, or toggle them off entirely.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--color-bg-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                    {filteredShadowEntries.length}
                  </span>
                </div>

                <div className="mt-3 rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Global shadow output</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Temporarily suppress all rendered box-shadows app-wide while you compare a flatter direction.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAllShadows}
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        allShadowsDisabled
                          ? "border-[var(--color-border-focus)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
                          : "border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]",
                      )}
                    >
                      {allShadowsDisabled ? "Off" : "On"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  {filteredShadowEntries.map((entry) => (
                    <div
                      key={entry.name}
                      className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px] font-semibold text-[var(--color-text-primary)]">
                            {entry.name}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                            {entry.enabled ? "Shadow enabled" : "Shadow disabled"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleShadow(entry.name)}
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            entry.enabled
                              ? "border-[var(--color-border-focus)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
                              : "border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]",
                          )}
                        >
                          {entry.enabled ? "On" : "Off"}
                        </button>
                      </div>

                      <label className="mt-3 grid gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                        Shadow value
                        <input
                          value={entry.inputValue}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            updateShadowDraft(entry.name, nextValue);
                            if (entry.enabled && nextValue.trim()) {
                              commitShadowEntry(entry.name, nextValue, { apply: true, enabled: true });
                            }
                          }}
                          onBlur={() => {
                            if (entry.enabled) {
                              const fallbackValue = entry.rawValue.toLowerCase() === "none" ? entry.lastEnabledValue || entry.defaultValue : entry.rawValue;
                              updateShadowDraft(entry.name, fallbackValue);
                              return;
                            }

                            if (!entry.inputValue.trim()) {
                              updateShadowDraft(entry.name, entry.lastEnabledValue || entry.defaultValue);
                            }
                          }}
                          placeholder="e.g. 0 10px 30px rgba(0, 0, 0, 0.18)"
                          className="min-h-10 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {filteredEntries.length > 0 ? (
              <div className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      Colors
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Live-edit the current mode&apos;s color tokens across the app.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--color-bg-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                    {filteredEntries.length}
                  </span>
                </div>

                <div className="mt-3 grid gap-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.name}
                className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] font-semibold text-[var(--color-text-primary)]">
                      {entry.name}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                      {entry.format === "triplet" ? "RGB token" : "Color token"}
                    </p>
                  </div>
                  <input
                    type="color"
                    value={entry.appliedValue.slice(0, 7)}
                    onChange={(event) => {
                      void commitEntry(entry.name, event.target.value);
                    }}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-[var(--color-border-default)] bg-transparent p-1"
                    aria-label={`Select ${entry.name}`}
                  />
                </div>

                <label className="mt-3 grid gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  Value
                  <input
                    value={entry.inputValue}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updateEntryDraft(entry.name, nextValue);
                      if (resolveColorExpression(nextValue, probeRef)) {
                        void commitEntry(entry.name, nextValue);
                      }
                    }}
                    onBlur={() => {
                      if (!resolveColorExpression(entry.inputValue, probeRef)) {
                        updateEntryDraft(entry.name, entry.appliedValue);
                      }
                    }}
                    className="h-10 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 font-mono text-xs text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                  />
                </label>
              </div>
            ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}

export default ThemeEditor;
