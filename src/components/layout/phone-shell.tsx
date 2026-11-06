"use client";

import { createContext, useContext } from "react";

/**
 * Whether this portal has a bar at the bottom of a phone.
 *
 * Only the portals whose mockups draw one — the parent's, the student's and the teacher's —
 * move a page's primary action down to a floating button and leave room for
 * the bar. Everywhere else the page head keeps its button and nothing floats,
 * so a desktop-only portal is untouched by any of this.
 */
const PhoneShellContext = createContext(false);

export const PhoneShellProvider = PhoneShellContext.Provider;
export const useHasPhoneBar = () => useContext(PhoneShellContext);

/**
 * Which portal's phone design is on screen.
 *
 * The parent and teacher mobile mockups share a skin but not a layout: the parent's page head is a dark card on a ledge, the teacher's is
 * plain type under a curved bar. Anything that has to draw one or the other asks here.
 */
export type PhoneKind = "teacher" | "parent" | "student" | null;
const PhoneKindContext = createContext<PhoneKind>(null);
export const PhoneKindProvider = PhoneKindContext.Provider;
export const usePhoneKind = () => useContext(PhoneKindContext);
