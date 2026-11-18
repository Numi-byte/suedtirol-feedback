export type IconNode = {
  tag: string;
  attrs: Record<string, string>;
  children: IconNode[];
};
export type SafeFeedbackIcon = {
  viewBox: number[];
  attrs: Record<string, string>;
  nodes: IconNode[];
};
export const SVG_MAX_BYTES = 16 * 1024;
const presentation = [
  "fill",
  "stroke",
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "fillRule",
  "clipRule",
  "opacity",
  "fillOpacity",
  "strokeOpacity",
  "transform",
];
export const ICON_ATTRIBUTES: Record<string, readonly string[]> = {
  svg: presentation,
  g: presentation,
  path: [...presentation, "d", "pathLength"],
  circle: [...presentation, "cx", "cy", "r"],
  ellipse: [...presentation, "cx", "cy", "rx", "ry"],
  rect: [...presentation, "x", "y", "width", "height", "rx", "ry"],
  line: [...presentation, "x1", "y1", "x2", "y2"],
  polyline: [...presentation, "points"],
  polygon: [...presentation, "points"],
};
function numbers(value: string) {
  if (!/^[\d\s.,eE+\-]+$/.test(value)) return false;
  const parts = value.trim().split(/[\s,]+/);
  return (
    parts.length <= 2048 &&
    parts.every(
      (x) =>
        x !== "" && Number.isFinite(Number(x)) && Math.abs(Number(x)) <= 10000,
    )
  );
}
export function safeIconAttribute(
  key: string,
  value: unknown,
): value is string {
  if (typeof value !== "string" || !value.length || value.length > 4096)
    return false;
  if (key === "fill" || key === "stroke")
    return value === "none" || value === "currentColor";
  if (key === "strokeLinecap")
    return ["butt", "round", "square"].includes(value);
  if (key === "strokeLinejoin")
    return ["miter", "round", "bevel"].includes(value);
  if (key === "fillRule" || key === "clipRule")
    return ["nonzero", "evenodd"].includes(value);
  if (key === "d")
    return (
      /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+\-]+$/.test(value) &&
      [...value.matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)].every(
        (x) => Number.isFinite(Number(x[0])) && Math.abs(Number(x[0])) <= 10000,
      )
    );
  if (key === "transform")
    return (
      /^(\s*(matrix|translate|scale|rotate|skewX|skewY)\([\d\s.,eE+\-]+\)\s*)+$/.test(
        value,
      ) && [...value.matchAll(/\(([^)]+)\)/g)].every((x) => numbers(x[1]))
    );
  return numbers(value);
}
export function isSafeFeedbackIcon(value: unknown): value is SafeFeedbackIcon {
  if (
    !value ||
    typeof value !== "object" ||
    JSON.stringify(value).length > 32768
  )
    return false;
  const icon = value as SafeFeedbackIcon;
  if (
    !Array.isArray(icon.viewBox) ||
    icon.viewBox.length !== 4 ||
    !icon.viewBox.every(
      (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 4096,
    ) ||
    icon.viewBox[2] <= 0 ||
    icon.viewBox[3] <= 0
  )
    return false;
  function attrs(tag: string, values: unknown) {
    return (
      !!values &&
      typeof values === "object" &&
      !Array.isArray(values) &&
      Object.entries(values).every(
        ([k, v]) =>
          ICON_ATTRIBUTES[tag]?.includes(k) && safeIconAttribute(k, v),
      )
    );
  }
  let count = 0;
  function node(n: IconNode, depth: number): boolean {
    return (
      !!n &&
      typeof n === "object" &&
      n.tag !== "svg" &&
      Object.hasOwn(ICON_ATTRIBUTES, n.tag) &&
      ++count <= 64 &&
      depth <= 8 &&
      attrs(n.tag, n.attrs) &&
      Array.isArray(n.children) &&
      (n.tag === "g" || n.children.length === 0) &&
      n.children.every((c) => node(c, depth + 1))
    );
  }
  return (
    attrs("svg", icon.attrs) &&
    Array.isArray(icon.nodes) &&
    icon.nodes.length > 0 &&
    icon.nodes.every((n) => node(n, 1))
  );
}
