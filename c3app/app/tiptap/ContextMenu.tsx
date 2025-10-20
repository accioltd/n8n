import React, { useEffect } from "react";
import { Editor } from "@tiptap/react";

interface ContextMenuProps {
  editor: Editor | null;
  x: number;
  y: number;
  show: boolean;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  editor,
  x,
  y,
  show,
  onClose,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: y,
        left: x,
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        zIndex: 1000,
        padding: "10px",
        borderRadius: "4px",
        fontSize: "10px",
      }}>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().addColumnBefore().run()}>
        Add Column Before
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().addColumnAfter().run()}>
        Add Column After
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().deleteColumn().run()}>
        Delete Column
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().addRowBefore().run()}>
        Add Row Before
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().addRowAfter().run()}>
        Add Row After
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().deleteRow().run()}>
        Delete Row
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().deleteTable().run()}>
        Delete Table
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().mergeCells().run()}>
        Merge Cells
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().splitCell().run()}>
        Split Cell
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().toggleHeaderColumn().run()}>
        Toggle Header Column
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>
        Toggle Header Row
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().toggleHeaderCell().run()}>
        Toggle Header Cell
      </div>
      <div
        style={menuItem}
        onClick={() => editor?.chain().focus().mergeOrSplit().run()}>
        Merge or Split
      </div>
      <div
        style={menuItem}
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .setCellAttribute("backgroundColor", "#FAF594")
            .run()
        }>
        Set Background Color
      </div>
    </div>
  );
};

const menuItem = {
  padding: "5px 10px",
  cursor: "pointer",
  transition: "background-color 0.2s",
} as React.CSSProperties;

// Hover effect
const hoverStyle = {
  backgroundColor: "#f0f0f0",
};

// Add hover effect for menuItem
Object.assign(menuItem, {
  "&:hover": hoverStyle,
});

export default ContextMenu;
