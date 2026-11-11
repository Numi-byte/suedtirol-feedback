import {
  isSafeFeedbackIcon,
  type SafeFeedbackIcon,
} from "./safe-feedback-icon";
const defaults: Record<string, SafeFeedbackIcon> = {
  weather_protection: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "path",
        attrs: {
          d: "M4 19V8l8-4 8 4v11",
        },
        children: [],
      },
      {
        tag: "path",
        attrs: {
          d: "M7 19v-8h10v8M9 14h6",
        },
        children: [],
      },
    ],
  },
  seating: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "path",
        attrs: {
          d: "M6 5v8h11V8M6 10h11M8 13v6M17 13v6",
        },
        children: [],
      },
    ],
  },
  safe_sidewalk: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "circle",
        attrs: {
          cx: "12",
          cy: "4.5",
          r: "2",
        },
        children: [],
      },
      {
        tag: "path",
        attrs: {
          d: "m10 9 3-2 2.5 3M12.5 8.2l-1 5.3-4 5M11.5 13.5l4.5 5",
        },
        children: [],
      },
    ],
  },
  safe_crossing: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "path",
        attrs: {
          d: "M4 18h16M6 14h3M11 14h3M16 14h2M5 10h3M10 10h3M15 10h4M4 6h16",
        },
        children: [],
      },
    ],
  },
  passenger_information: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "circle",
        attrs: {
          cx: "12",
          cy: "12",
          r: "9",
        },
        children: [],
      },
      {
        tag: "path",
        attrs: {
          d: "M12 11v6M12 7.5v.5",
        },
        children: [],
      },
    ],
  },
  lighting: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "path",
        attrs: {
          d: "M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5L14 17h-4Z",
        },
        children: [],
      },
    ],
  },
  accessibility: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "circle",
        attrs: {
          cx: "11",
          cy: "4",
          r: "2",
        },
        children: [],
      },
      {
        tag: "path",
        attrs: {
          d: "M10 7.5 9 13h6l3 6M10 10h5l2 3M9.5 12.5a5 5 0 1 0 5.5 6",
        },
        children: [],
      },
    ],
  },
  shading: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "circle",
        attrs: {
          cx: "12",
          cy: "12",
          r: "4",
        },
        children: [],
      },
      {
        tag: "path",
        attrs: {
          d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
        },
        children: [],
      },
    ],
  },
  bicycle_parking: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "circle",
        attrs: {
          cx: "6",
          cy: "17",
          r: "4",
        },
        children: [],
      },
      {
        tag: "circle",
        attrs: {
          cx: "18",
          cy: "17",
          r: "4",
        },
        children: [],
      },
      {
        tag: "path",
        attrs: {
          d: "m6 17 4-8 4 8M8 13h8l-3-6h3M9 7h3",
        },
        children: [],
      },
    ],
  },
  waste_bin: {
    viewBox: [0, 0, 24, 24],
    attrs: {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    nodes: [
      {
        tag: "path",
        attrs: {
          d: "M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6",
        },
        children: [],
      },
    ],
  },
};
export function resolveFeedbackIcon(
  slug: string,
  icon: unknown,
): SafeFeedbackIcon {
  return isSafeFeedbackIcon(icon)
    ? icon
    : Object.hasOwn(defaults, slug)
      ? defaults[slug]
      : defaults.passenger_information;
}
