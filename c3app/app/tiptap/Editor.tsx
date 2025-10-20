"use client";

import "@mantine/tiptap/styles.css";

import { useEffect, useRef, useState } from "react";

import { RichTextEditor, getTaskListExtension } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import SubScript from "@tiptap/extension-subscript";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import typescript from "highlight.js/lib/languages/typescript";
import TaskItem from "@tiptap/extension-task-item";
import TipTapTaskList from "@tiptap/extension-task-list";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";

import classes from "./tiptap.module.css";
import { Flex } from "@mantine/core";

import mockAssessment from "../data/mock-assessment.json";

import Menu from "./Menu";
import ContextMenu from "./ContextMenu";

import { ChartNistCategoryNode } from "../components/ChartNistCategory";
import { ChartIdentifyNode } from "../components/ChartIdentify";
import {
  SpiderChartNode,
  hydrateSpiderCharts,
} from "../extensions/SpiderChartNode";

// register languages that you are planning to use
const lowlight = createLowlight();
lowlight.register({ ts: typescript });

export default function Editor() {
  const [editable, setEditable] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null!);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });

  const [content, setContent] = useState({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Here's the weekly heatmap:" }],
      },
      {
        type: "spiderChart",
        attrs: {
          title: "NIST CSF 2.0 Assessment Scores",
          data: mockAssessment,
          height: 500,
          showLegend: true,
          showDataLabels: false,
        },
      },
    ],
  });

  // const [content, setContent] = useState(json);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      Image,
      StarterKit,
      Placeholder.configure({ placeholder: "Start your report..." }),
      Underline,
      Superscript,
      SubScript,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      SpiderChartNode,
      CodeBlockLowlight.configure({ lowlight }),
      getTaskListExtension(TipTapTaskList),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      ChartNistCategoryNode,
      ChartIdentifyNode,
    ],
    content: content,
  });

  useEffect(() => {
    hydrateSpiderCharts();
  }, [editor?.getJSON()]);

  // useEffect(() => {
  //   // Get from reportContent localStorage after client-side mount
  //   const savedContent = localStorage.getItem("reportContent");

  //   if (savedContent) {
  //     const parsedContent = savedContent;
  //     setContent(parsedContent);
  //     if (editor) {
  //       editor.commands.setContent(JSON.parse(parsedContent));
  //     }
  //   }
  // }, [editor]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ show: true, x: event.pageX, y: event.pageY });
  };

  const handleTableContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ show: true, x: event.pageX, y: event.pageY });
  };

  useEffect(() => {
    const tables = document.querySelectorAll("table");
    tables.forEach((table) => {
      table.addEventListener("mousedown", handleTableContextMenu);
    });

    return () => {
      tables.forEach((table) => {
        table.removeEventListener("mousedown", handleTableContextMenu);
      });
    };
  }, [editor]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <Flex direction="column" p={40}>
      <div onContextMenu={handleContextMenu}>
        {editor && (
          <RichTextEditor editor={editor} classNames={classes}>
            <Menu
              assessmentId=""
              reportName=""
              editor={editor}
              setEditable={setEditable}
              editorRef={editorRef}
            />
            <RichTextEditor.Content ref={editorRef} />
          </RichTextEditor>
        )}
      </div>
      <ContextMenu
        editor={editor}
        x={contextMenu.x}
        y={contextMenu.y}
        show={contextMenu.show}
        onClose={() => setContextMenu({ show: false, x: 0, y: 0 })}
      />
    </Flex>
  );
}
