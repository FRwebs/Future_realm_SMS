"use client";

import { createContext, useContext } from "react";

/**
 * Whether this portal has a bar at the bottom of a phone.
 *
 * Only the portals whose mockups draw one — the parent's and the teacher's —
 * move a page's primary action down to a floating button and leave room for
 * the bar. Everywhere else the page head keeps its button and nothing floats,
 * so a desktop-only portal is untouched by any of this.
 */
const PhoneShellContext = createContext(false);

export const PhoneShellProvider = PhoneShellContext.Provider;
export const useHasPhoneBar = () => useContext(PhoneShellContext);
