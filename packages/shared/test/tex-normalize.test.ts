import { describe, expect, it } from "vitest";
import { normalizeTeXForDisplay } from "../src/tex-normalize";

describe("normalizeTeXForDisplay", () => {
  it("canonicalizes malformed currency forms", () => {
    const out = normalizeTeXForDisplay(String.raw`A \$$45$ coat costs less now.`);
    expect(out).toContain(String.raw`\$45`);
    expect(out).not.toContain(String.raw`\$$45$`);
  });

  it("canonicalizes $x$ percent boundary form", () => {
    const out = normalizeTeXForDisplay(String.raw`What is $x$\% of 80?`);
    expect(out).toContain(String.raw`x\%`);
    expect(out).not.toContain(String.raw`$x$\%`);
  });

  it("passes through display math blocks", () => {
    const source = String.raw`Factor:
$$
x^2+2x+1
$$`;
    const out = normalizeTeXForDisplay(source);
    expect(out).toContain("$$");
    expect(out).toContain("x^2+2x+1");
  });

  it("keeps mixed text and math spacing readable", () => {
    const out = normalizeTeXForDisplay(String.raw`Pay \$$32.40$ for what is $x$?`);
    expect(out).toContain(String.raw`\$32.40`);
    expect(out).not.toContain("32.40for");
    expect(out).not.toContain(String.raw`x$ \%`);
  });
});
