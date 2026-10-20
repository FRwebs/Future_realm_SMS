/** WCAG contrast of a hex colour against white — the ratio a printed report card can be read at. */
export function contrastOnWhite(hex: string) {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return Math.round((1.05 / (luminance + 0.05)) * 100) / 100;
}

