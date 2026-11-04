// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { PhoneCoursePicker, type PickerItem } from "@/components/portals/teacher/phone-course-picker";
import type { DrawerSpec } from "@/lib/modules/panels";

vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

const item = (id: string, over: Partial<PickerItem> = {}): PickerItem => ({ id, title: `Course ${id}`, sub: "Provider · 2 hours", icon: "M0 0", href: `/training/courses/${id}`, pill: "Not started", tone: "neutral", buyable: true, priceKobo: 1_200_000, price: "₦12,000", ...over });
const template = { mode: "commit", kicker: "Catalogue", title: "Add the selected courses", submit: { endpoint: "/basket", method: "POST" } } as DrawerSpec;

describe("the phone catalogue's course picker", () => {
  it("offers a box only on a course that can be bought, and adds exactly the ticked ones", () => {
    const open = vi.fn();
    render(<PhoneCoursePicker title="All courses" tag="3 courses" items={[item("a"), item("b"), item("c", { buyable: false, pill: "Completed" })]} template={template} openDrawer={open} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Add to basket" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Course b" }));
    expect(screen.getByText(/1 selected · ₦12,000/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ submit: expect.objectContaining({ body: { courseIds: ["b"] } }) }));
  });
});
