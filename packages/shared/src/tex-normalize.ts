const GAME_ENVIRONMENTS = ["tossup", "followup", "answer", "solution", "emceenotes"] as const;

const GAME_ENV_PATTERN = new RegExp(
  String.raw`\\begin\{(${GAME_ENVIRONMENTS.join("|")})\}([\s\S]*?)\\end\{\1\}`,
  "gi"
);

const ORPHAN_GAME_ENV_TAG_PATTERN = new RegExp(
  String.raw`\\(begin|end)\{(${GAME_ENVIRONMENTS.join("|")})\}`,
  "gi"
);

const MATH_SEGMENT_PATTERN =
  /((?<!\\)\$\$[\s\S]+?(?<!\\)\$\$|\\\[[\s\S]+?\\\]|(?<!\\)\$[^$\n]+?(?<!\\)\$|\\\([\s\S]+?\\\))/g;

const stripGameEnvironmentWrappers = (text: string): string => {
  let next = text;
  let previous = "";
  while (next !== previous) {
    previous = next;
    next = next.replace(GAME_ENV_PATTERN, (_match, _env, inner) => `${String(inner).trim()}\n`);
  }
  return next.replace(ORPHAN_GAME_ENV_TAG_PATTERN, "").trim();
};

const canonicalizeCurrencyForms = (text: string): string =>
  text.replace(/\\\$\s*\$([0-9][0-9,]*(?:\.[0-9]+)?)\$/g, (_match, amount) => `\\$${String(amount)}`);

const canonicalizeMathPercentBoundary = (text: string): string =>
  text.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$\s*\\%/g, (_match, expr) => `$${String(expr).trim()}\\%$`);

const normalizeEditorialBreaks = (text: string): string =>
  text
    .replace(/\\vspace\*?\{[^}]*\}/g, "\n")
    .replace(/\\(?:smallskip|medskip|bigskip)\b/g, "\n")
    .replace(/\\\\(?:\[[^\]]*\])?/g, "\n");

const hasComplexTeXStructure = (text: string): boolean =>
  /\\begin\{(?!matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|array)[^}]+\}/.test(text);

const hasDisplayMathBlock = (text: string): boolean => /(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]/.test(text);

const hasExplicitMathDelimiters = (text: string): boolean => /(?<!\\)\$|\\\(|\\\[/.test(text);

const hasBareMathCommand = (text: string): boolean =>
  /\\(frac|sqrt|sum|int|prod|left|right|cdot|times|leq|geq|neq|approx|pm|mp|div|alpha|beta|gamma|theta|pi|infty|lim|log|ln|sin|cos|tan|sec|csc|cot|begin|end)\b/.test(
    text
  );

const normalizePlainTeXEscapes = (text: string): string => text.replace(/\\([#$%&_{}])/g, "$1");

const escapeTeXText = (text: string): string =>
  text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (match) => `\\${match}`)
    .replace(/[$%#&_]/g, (match) => `\\${match}`)
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string };

const splitMixedSegments = (line: string): Segment[] => {
  const segments: Segment[] = [];
  let cursor = 0;

  line.replace(MATH_SEGMENT_PATTERN, (match, _group, offset: number) => {
    if (offset > cursor) {
      segments.push({ kind: "text", value: line.slice(cursor, offset) });
    }
    segments.push({ kind: "math", value: match });
    cursor = offset + match.length;
    return match;
  });

  if (cursor < line.length) {
    segments.push({ kind: "text", value: line.slice(cursor) });
  }

  return segments;
};

const unwrapMathDelimiters = (value: string): string => {
  if (value.startsWith("$$") && value.endsWith("$$")) return value.slice(2, -2).trim();
  if (value.startsWith("\\[") && value.endsWith("\\]")) return value.slice(2, -2).trim();
  if (value.startsWith("$") && value.endsWith("$")) return value.slice(1, -1).trim();
  if (value.startsWith("\\(") && value.endsWith("\\)")) return value.slice(2, -2).trim();
  return value.trim();
};

const convertMixedLineToTeX = (line: string): string => {
  const segments = splitMixedSegments(line);
  const parts: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "math") {
      const math = unwrapMathDelimiters(segment.value);
      if (math) parts.push(math);
      continue;
    }

    const normalizedText = normalizePlainTeXEscapes(segment.value);
    if (!normalizedText.trim()) {
      if (normalizedText.length > 0) parts.push("\\,");
      continue;
    }

    parts.push(`\\text{${escapeTeXText(normalizedText)}}`);
  }

  return parts.join(" \\ ");
};

const wrapMixedLineForDisplay = (line: string, maxWeight: number = 44): string[] => {
  const segments = splitMixedSegments(line);
  const tokens: string[] = [];
  for (const segment of segments) {
    if (segment.kind === "math") {
      tokens.push(segment.value.trim());
      continue;
    }
    tokens.push(...segment.value.trim().split(/\s+/).filter(Boolean));
  }
  if (tokens.length === 0) return [];

  const lines: string[] = [];
  let current = "";
  let currentWeight = 0;
  for (const token of tokens) {
    const tokenWeight = /^(?:\$|\\\(|\\\[)/.test(token) ? Math.max(10, Math.floor(token.length * 0.8)) : token.length;
    const nextWeight = current ? currentWeight + 1 + tokenWeight : tokenWeight;
    if (current && nextWeight > maxWeight) {
      lines.push(current);
      current = token;
      currentWeight = tokenWeight;
    } else {
      current = current ? `${current} ${token}` : token;
      currentWeight = nextWeight;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const normalizeTeXForDisplay = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const sanitized = normalizeEditorialBreaks(
    canonicalizeMathPercentBoundary(canonicalizeCurrencyForms(stripGameEnvironmentWrappers(trimmed)))
  );
  if (!sanitized) return "";

  if (hasComplexTeXStructure(sanitized) || hasDisplayMathBlock(sanitized)) {
    return sanitized;
  }

  if (hasBareMathCommand(sanitized) && !hasExplicitMathDelimiters(sanitized)) {
    return sanitized;
  }

  const sourceLines = sanitized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => wrapMixedLineForDisplay(line, 44));

  if (sourceLines.length === 0) return "";

  const texLines = sourceLines.map((line) => convertMixedLineToTeX(line)).filter(Boolean).join(" \\\\ ");
  if (!texLines) return "";

  return `\\[\\begin{array}{@{}l@{}}${texLines}\\end{array}\\]`;
};
