import React from "react";
import { Editor, Node, RawCommands } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export const createCustomNode = ({
  name,
  CustomNodeView,
}: {
  name: string;
  CustomNodeView: React.FC<{ editor: Editor | null }>;
}) =>
  Node.create({
    name,
    group: "block",
    content: "inline*",

    addNodeView() {
      return ReactNodeViewRenderer((props) => <CustomNodeView {...props} />);
    },

    parseHTML() {
      return [{ tag: name }];
    },

    renderHTML() {
      return [name, 0];
    },

    addCommands() {
      return {
        // Dynamic command name
        [`insert${name.charAt(0).toUpperCase() + name.slice(1)}`]:
          () =>
          ({ commands }: { commands: RawCommands }) => {
            return commands.insertContent({ type: name });
          },
      } as Partial<RawCommands>;
    },
  });
