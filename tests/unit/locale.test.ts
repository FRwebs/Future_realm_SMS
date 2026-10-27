import { toLocale } from "../../backend/src/common/locale";

describe("choosing a language", () => {
  it("takes a code or the name the language calls itself, in any case", () => {
    expect(toLocale("ha")).toBe("ha");
    expect(toLocale(" HAUSA ")).toBe("ha");
    expect(toLocale("Yorùbá")).toBe("yo");
    expect(toLocale("Yoruba")).toBe("yo");
    expect(toLocale("Igbo")).toBe("ig");
    expect(toLocale("English")).toBe("en");
  });

  it("refuses a language the product does not have", () => {
    expect(toLocale("French")).toBeNull();
    expect(toLocale("")).toBeNull();
    expect(toLocale(undefined)).toBeNull();
    expect(toLocale(42)).toBeNull();
  });
});
