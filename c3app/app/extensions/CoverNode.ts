import { Node, mergeAttributes } from "@tiptap/core";

const name = "Cover";

export const CoverNode = Node.create({
  name,
  group: "block",
  atom: true,

  addAttributes() {
    return {
      title: { default: null },
      series: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: "cover" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["cover", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement("div");
      container.className = `${name.toLowerCase()}-node`;
      container.dataset.chart = JSON.stringify({
        title: node.attrs.title,
        series: node.attrs.series,
      });
      return { dom: container };
    };
  },
});
