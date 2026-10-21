"use client";

import { createContext, useContext } from "react";

import type { PortalType } from "@/lib/navigation/registry";

const PortalContext = createContext<PortalType | null>(null);

export const PortalProvider = PortalContext.Provider;

/** Which portal the page is rendered in — the Back Office draws tables, lists and filters its own way. */
export const usePortalType = () => useContext(PortalContext);
