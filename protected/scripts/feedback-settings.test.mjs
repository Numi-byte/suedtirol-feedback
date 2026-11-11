import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeCategorySvg } from "../src/lib/sanitize-category-svg.ts";
import { isSafeFeedbackIcon } from "../../shared/safe-feedback-icon.ts";
import {
  parseFeedbackFormConfig,
  validFeedbackPhoto,
  feedbackCategoryLabel,
} from "../../shared/feedback-form-config.ts";
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
const shape = '<path fill="#123456" d="M1 2L20 22Z"/>';
test("SVG normalization retains safe geometry and standardizes colour/coordinates", () => {
  const icon = sanitizeCategorySvg(wrap(shape));
  assert.ok(isSafeFeedbackIcon(icon));
  assert.deepEqual(icon.viewBox, [0, 0, 24, 24]);
  assert.equal(icon.nodes[0].attrs.fill, "currentColor");
  assert.equal(
    sanitizeCategorySvg(
      '<svg width="48px" height="32"><g transform="translate(1,2)"><circle cx="5" cy="5" r="2" stroke="black" fill="none"/></g></svg>',
    ).viewBox[2],
    48,
  );
  assert.ok(
    isSafeFeedbackIcon(
      sanitizeCategorySvg(
        '<?xml version="1.0"?><svg viewBox="0 0 24 24"><!-- ok --><rect x="1" y="1" width="5" height="5"/></svg>',
      ),
    ),
  );
});
test("SVG rejects active content, external resources, HTML, CSS and ambiguous XML", () => {
  for (const source of [
    wrap("<script>alert(1)</script>"),
    wrap('<path onload="alert(1)" d="M0 0"/>'),
    wrap("<foreignObject><div>HTML</div></foreignObject>"),
    wrap('<image href="https://example.test/a"/>'),
    wrap('<use href="#a"/>'),
    wrap('<path d="M0 0" fill="url(https://example.test/a)"/>'),
    wrap("<style>path{fill:red}</style>"),
    wrap('<path style="fill:red" d="M0 0"/>'),
    wrap('<animate attributeName="d"/>'),
    wrap('<a href="javascript:alert(1)"><path d="M0 0"/></a>'),
    wrap("<text>Label</text>"),
    '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' +
      wrap('<path d="M0 0"/>'),
    "<!DOCTYPE svg>" + wrap(shape),
    wrap("<?test unsafe?>" + shape),
    '<svg xmlns="https://example.test/">' + shape + "</svg>",
    wrap('<x:path xmlns:x="http://www.w3.org/2000/svg" d="M0 0"/>'),
    wrap("<svg>" + shape + "</svg>"),
    "<svg><path></svg>",
    "<svg/><svg/>",
  ])
    assert.throws(() => sanitizeCategorySvg(source), undefined, source);
});
test("SVG and renderer enforce bounded complexity and reject tampered database icons", () => {
  for (const source of [
    wrap('<path d="M1e999 0"/>'),
    wrap('<circle r="10001"/>'),
    wrap('<g transform="translate(1e999)">' + shape + "</g>"),
    wrap('<circle r="2"/>'.repeat(65)),
    wrap("<g>".repeat(9) + shape + "</g>".repeat(9)),
    wrap(shape + " ".repeat(16384)),
    '<svg viewBox="0 0 -1 24">' + shape + "</svg>",
    '<svg viewBox="0 0 24">' + shape + "</svg>",
    "<svg/>",
  ])
    assert.throws(() => sanitizeCategorySvg(source));
  const safe = sanitizeCategorySvg(wrap(shape));
  for (const bad of [
    { ...safe, attrs: { onLoad: "alert(1)" } },
    { ...safe, nodes: [{ tag: "script", attrs: {}, children: [] }] },
    {
      ...safe,
      nodes: [
        { tag: "path", attrs: { d: "javascript:alert(1)" }, children: [] },
      ],
    },
    {
      ...safe,
      nodes: [
        {
          tag: "path",
          attrs: { fill: "url(https://example.test)" },
          children: [],
        },
      ],
    },
    { ...safe, viewBox: [0, 0, Infinity, 24] },
  ])
    assert.equal(isSafeFeedbackIcon(bad), false);
});
const category = {
  slug: "new_issue",
  label_de: "Neues Problem",
  label_it: "Nuovo problema",
  label_en: "New issue",
  is_active: true,
  sort_order: 1,
  icon: null,
};
const config = {
  photos_enabled: true,
  max_photo_bytes: 1048576,
  categories: [category],
};
test("configuration accepts translated custom categories, retains retired labels and sorts them", () => {
  const parsed = parseFeedbackFormConfig({
    ...config,
    categories: [
      { ...category, slug: "retired", is_active: false, sort_order: 2 },
      category,
    ],
  });
  assert.equal(parsed.categories[0].slug, "new_issue");
  assert.equal(parsed.categories.length, 2);
  assert.equal(
    feedbackCategoryLabel(parsed.categories[0], "it"),
    "Nuovo problema",
  );
});
test("configuration fails closed for invalid permissions, sizes, labels, counts and IDs", () => {
  for (const bad of [
    null,
    { ...config, photos_enabled: 1 },
    { ...config, max_photo_bytes: 10485761 },
    { ...config, max_photo_bytes: 1 },
    { ...config, categories: [] },
    { ...config, categories: [category, category] },
    ...[
      { label_it: "" },
      { slug: "<script>" },
      { is_active: false },
      { label_en: "x".repeat(161) },
    ].map((patch) => ({ ...config, categories: [{ ...category, ...patch }] })),
    {
      ...config,
      categories: Array.from({ length: 31 }, (_, i) => ({
        ...category,
        slug: `c_${i}`,
      })),
    },
    {
      ...config,
      categories: Array.from({ length: 51 }, (_, i) => ({
        ...category,
        slug: `c_${i}`,
        is_active: i === 0,
      })),
    },
  ])
    assert.throws(() => parseFeedbackFormConfig(bad));
});
test("photos obey on/off, positive size, configured upper limit and raster MIME allowlist", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    assert.equal(validFeedbackPhoto({ type, size: 1048576 }, config), true);
  for (const file of [
    { type: "image/svg+xml", size: 10 },
    { type: "text/html", size: 10 },
    { type: "image/png", size: 0 },
    { type: "image/jpeg", size: 1048577 },
  ])
    assert.equal(validFeedbackPhoto(file, config), false);
  assert.equal(
    validFeedbackPhoto(
      { type: "image/png", size: 1 },
      { ...config, photos_enabled: false },
    ),
    false,
  );
});
