import { Node, mergeAttributes } from "@tiptap/core";
import { createRoot, Root } from "react-dom/client";

// Helper: convert to kebab-case (e.g. SpiderChart → spider-chart)
const toKebabCase = (str: string) =>
  str
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .substring(1);

// Reusable factory
export function createChartNode(name: string) {
  const nodeName = name.charAt(0).toLowerCase() + name.slice(1); // spiderChart
  const cssClass = `${toKebabCase(name)}-node`; // spider-chart-node

  const roots = new WeakMap<Element, Root>();

  const hydrate = () => {
    if (typeof window === "undefined") return;

    requestAnimationFrame(() => {
      document.querySelectorAll(`.${cssClass}`).forEach(async (el) => {
        const dataAttr = el.getAttribute("data-chart");
        if (!dataAttr) return;

        try {
          const data = JSON.parse(dataAttr);
          const { [name]: Component } = await import(`../components/${name}`);
          const React = await import("react");

          let root = roots.get(el);
          if (!root) {
            root = createRoot(el);
            roots.set(el, root);
          }

          root.render(React.createElement(Component, data));
        } catch (err) {
          console.error(`Failed to hydrate ${name}`, err);
        }
      });
    });
  };

  const tiptapNode = Node.create({
    name: nodeName,
    group: "block",
    atom: true,

    addAttributes() {
      return {
        title: { default: null },
        data: { default: [] },
        height: { default: 400 },
        showLegend: { default: true },
        showDataLabels: { default: false },
      };
    },

    parseHTML() {
      return [{ tag: nodeName }];
    },

    renderHTML({ HTMLAttributes }) {
      return [nodeName, mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ({ node }) => {
        const container = document.createElement("div");
        container.className = cssClass;
        container.dataset.chart = JSON.stringify({
          title: node.attrs.title,
          data: node.attrs.data,
          height: node.attrs.height,
          showLegend: node.attrs.showLegend,
          showDataLabels: node.attrs.showDataLabels,
        });
        return { dom: container };
      };
    },

    onCreate() {
      hydrate();
    },

    onUpdate() {
      hydrate();
    },
  });

  return {
    hydrateFunction: hydrate,
    tiptapNode,
  };
}
