import { DOMParser } from "@xmldom/xmldom";
import {
  ICON_ATTRIBUTES,
  SVG_MAX_BYTES,
  isSafeFeedbackIcon,
  type IconNode,
  type SafeFeedbackIcon,
} from "../../../shared/safe-feedback-icon.ts";

const attributeNames: Record<string, string> = {
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "fill-opacity": "fillOpacity",
  "stroke-opacity": "strokeOpacity",
};
/** Reject unsafe/unsupported features rather than silently publishing a broken icon. */
export function sanitizeCategorySvg(source: string): SafeFeedbackIcon {
  if (
    Buffer.byteLength(source, "utf8") > SVG_MAX_BYTES ||
    /<!DOCTYPE|<!ENTITY/i.test(source)
  )
    throw new Error("SVG must be at most 16 KiB and contain no DTD/entities.");
  let invalid = false;
  const doc = new DOMParser({
    onError: () => {
      invalid = true;
    },
  }).parseFromString(source, "image/svg+xml");
  if (invalid || !doc.documentElement || doc.documentElement.tagName !== "svg")
    throw new Error("Invalid SVG document.");
  const root = doc.documentElement;
  const dimensions = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (root.hasAttribute("viewBox") && dimensions.length !== 4)
    throw new Error("Invalid SVG viewBox.");
  const dimension = (name: string) =>
    Number((root.getAttribute(name) || "24").replace(/px$/, ""));
  const viewBox =
    dimensions.length === 4
      ? dimensions
      : [0, 0, dimension("width"), dimension("height")];
  let count = 0;
  const visit = (element: Element, depth: number): IconNode => {
    const tag = element.tagName;
    if (
      ++count > 65 ||
      depth > 8 ||
      !Object.hasOwn(ICON_ATTRIBUTES, tag) ||
      element.prefix ||
      (element.namespaceURI &&
        element.namespaceURI !== "http://www.w3.org/2000/svg")
    )
      throw new Error(
        "Unsupported SVG structure. Use paths and basic shapes only.",
      );
    const attrs: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes.item(i)!;
      if (
        tag === "svg" &&
        ["xmlns", "viewBox", "width", "height", "version"].includes(attr.name)
      ) {
        if (
          attr.name === "xmlns" &&
          attr.value !== "http://www.w3.org/2000/svg"
        )
          throw new Error("Invalid SVG namespace.");
        continue;
      }
      const key = attributeNames[attr.name] ?? attr.name;
      if (!ICON_ATTRIBUTES[tag].includes(key))
        throw new Error(`Unsupported SVG attribute: ${attr.name}`);
      let value = attr.value.trim();
      if (key === "fill" || key === "stroke") {
        if (value !== "none" && value !== "currentColor") {
          if (
            !/^#[0-9a-f]{3,8}$/i.test(value) &&
            !["black", "white", "red", "blue", "green", "transparent"].includes(
              value,
            )
          )
            throw new Error(
              "SVG external paint references and CSS are not supported.",
            );
          value = value === "transparent" ? "none" : "currentColor";
        }
      }
      attrs[key] = value;
    }
    const children: IconNode[] = [];
    for (let node = element.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 1)
        children.push(visit(node as unknown as Element, depth + 1));
      else if (
        node.nodeType === 7 ||
        node.nodeType === 10 ||
        (node.nodeType !== 8 && node.textContent?.trim())
      )
        throw new Error(
          "SVG text and processing instructions are not supported.",
        );
    }
    return { tag, attrs, children };
  };
  const parsed = visit(root as unknown as Element, 0);
  for (let node = doc.firstChild; node; node = node.nextSibling) {
    if (
      node !== root &&
      node.nodeType !== 8 &&
      node.nodeType !== 3 &&
      !(node.nodeType === 7 && node.nodeName === "xml")
    )
      throw new Error("Unsupported SVG document node.");
  }
  const icon = {
    viewBox,
    attrs: { fill: "currentColor", stroke: "none", ...parsed.attrs },
    nodes: parsed.children,
  };
  if (!isSafeFeedbackIcon(icon))
    throw new Error(
      "SVG exceeds the supported shape, geometry or complexity limits.",
    );
  return icon;
}
