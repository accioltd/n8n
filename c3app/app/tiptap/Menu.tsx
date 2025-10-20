import React, { useState } from "react";

import { RichTextEditor, RichTextEditorControl } from "@mantine/tiptap";
import { BubbleMenu, Editor } from "@tiptap/react";
import {
  IconColorPicker,
  IconLock,
  IconPhoto,
  IconTable,
  // IconColumnInsertLeft,
  // IconColumnInsertRight,
  // IconColumnRemove,
  // IconRowInsertTop,
  // IconRowInsertBottom,
  // IconRowRemove,
  // IconTableOff,
  IconLayersIntersect2,
  IconDeviceFloppy,
  IconPdf,
  IconGauge,
  IconLayoutBoardSplit,
  IconReport,
  // IconSquareHalf,
  // IconLayoutNavbarFilled,
  // IconTestPipe2Filled,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { generateReportFromTOC } from "../actionts";
import { ReportProgressModal } from "../components/ReportProgressModal";

interface Section {
  title: string;
  order: number;
}

interface ModalState {
  opened: boolean;
  stage: "planning" | "generating" | "completed" | "error";
  plan: Section[];
  currentSection: number;
  totalSections: number;
  error: string;
}

export default function Menu({
  editor,
  setEditable,
  editorRef,
}: {
  assessmentId: string;
  reportName: string;
  editor: Editor | null;
  setEditable: (editable: boolean) => void;
  editorRef: React.RefObject<HTMLDivElement>;
}) {
  const [modalState, setModalState] = useState<ModalState>({
    opened: false,
    stage: "planning",
    plan: [],
    currentSection: 0,
    totalSections: 0,
    error: "",
  });

  const addImage = () => {
    const url = window.prompt("URL");
    console.log(url);

    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  async function downloadPdf(current: HTMLDivElement | null) {
    if (current) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // wait for 100ms
      const canvas = await html2canvas(current, { useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save("download.pdf");
    }
  }

  const saveContent = async () => {
    if (!editor) {
      alert("Editor not initialized!");
      return;
    }

    const content = editor.getJSON();
    localStorage.setItem("reportContent", JSON.stringify(content));

    notifications.show({
      title: "Content saved",
      message: "Content saved to local storage",
      color: "teal",
      autoClose: 3000,
      withCloseButton: true,
      icon: <IconDeviceFloppy size={16} />,
    });
  };

  const handleGenerateReport = async () => {
    try {
      setModalState({
        opened: true,
        stage: "planning",
        plan: [],
        currentSection: 0,
        totalSections: 0,
        error: "",
      });

      const selectedText = editor?.state.selection.empty
        ? editor?.getText() || ""
        : editor?.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to
          ) || "";

      const { report } = await generateReportFromTOC(
        selectedText,
        (plan: Section[]) => {
          setModalState((prev) => ({
            ...prev,
            stage: "generating",
            plan,
            totalSections: plan.length,
          }));
        },
        (currentSection: number) => {
          setModalState((prev) => ({
            ...prev,
            currentSection,
          }));
        }
      );

      console.log("Generated report:", report);

      // Order sections by their order
      const orderedSections = report.sort(
        (a, b) => a.section.order - b.section.order
      );

      // Parse Report content
      const finalDoc = orderedSections
        .map(({ content }) => {
          try {
            return JSON.parse(content.output);
          } catch (e) {
            console.warn("Failed to parse section output:", e);
            return null;
          }
        })
        .filter(Boolean);

      console.log("Final document content:", finalDoc);

      editor?.commands.setContent(finalDoc);

      setModalState((prev) => ({
        ...prev,
        stage: "completed",
      }));
    } catch (error) {
      console.error("Report generation failed:", error);
      setModalState((prev) => ({
        ...prev,
        stage: "error",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }));
    }
  };

  return (
    <React.Fragment>
      <RichTextEditor.Toolbar sticky stickyOffset={0}>
        <RichTextEditor.ControlsGroup title="Hello">
          <RichTextEditorControl onClick={addImage}>
            <IconPhoto size={16} />
          </RichTextEditorControl>
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.ClearFormatting />
          <RichTextEditor.Highlight />
          <RichTextEditor.Code />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
          <RichTextEditor.H4 />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote />
          <RichTextEditor.Hr />
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
          <RichTextEditor.Subscript />
          <RichTextEditor.Superscript />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.AlignLeft />
          <RichTextEditor.AlignCenter />
          <RichTextEditor.AlignJustify />
          <RichTextEditor.AlignRight />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Undo />
          <RichTextEditor.Redo />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ColorPicker
          colors={[
            "#25262b",
            "#868e96",
            "#fa5252",
            "#e64980",
            "#be4bdb",
            "#7950f2",
            "#4c6ef5",
            "#228be6",
            "#15aabf",
            "#12b886",
            "#40c057",
            "#82c91e",
            "#fab005",
            "#fd7e14",
          ]}
        />

        {/* Colour */}
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Control interactive={false}>
            <IconColorPicker size="1rem" stroke={1.5} />
          </RichTextEditor.Control>
          <RichTextEditor.Color color="#F03E3E" />
          <RichTextEditor.Color color="#7048E8" />
          <RichTextEditor.Color color="#1098AD" />
          <RichTextEditor.Color color="#37B24D" />
          <RichTextEditor.Color color="#F59F00" />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.UnsetColor />

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.CodeBlock />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.TaskList />
          <RichTextEditor.TaskListLift />
          <RichTextEditor.TaskListSink />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditorControl>
            <IconLock
              size="1rem"
              stroke={1.5}
              onClick={() => setEditable(true)}
            />
          </RichTextEditorControl>
        </RichTextEditor.ControlsGroup>

        {/* Table */}
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Control
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }>
            <IconTable size={16} />
          </RichTextEditor.Control>
          <RichTextEditor.Control
            onClick={() => editor?.chain().focus().mergeCells().run()}>
            <IconLayersIntersect2 size={16} />
          </RichTextEditor.Control>
          <RichTextEditor.Control
            onClick={() => editor?.chain().focus().splitCell().run()}>
            <IconLayoutBoardSplit size={16} />
          </RichTextEditor.Control>
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditorControl
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertContent({
                  type: "heading",
                  level: 3,
                  content: [{ type: "text", text: "Your Title" }],
                })
                .insertContent({ type: "ChartIdentify" })
                .run()
            }>
            Abc
          </RichTextEditorControl>

          <RichTextEditorControl
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertContent({ type: "ChartNistCategory" })
                .run()
            }>
            S
          </RichTextEditorControl>

          <RichTextEditorControl
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertContent({ type: "GaugeChart" })
                .run()
            }>
            <IconGauge size={16} />
          </RichTextEditorControl>
        </RichTextEditor.ControlsGroup>

        <RichTextEditorControl onClick={() => downloadPdf(editorRef.current)}>
          <IconPdf size={16} />
        </RichTextEditorControl>

        <RichTextEditorControl onClick={saveContent}>
          <IconDeviceFloppy size={16} />
        </RichTextEditorControl>

        <RichTextEditorControl onClick={handleGenerateReport}>
          <IconReport size={16} />
        </RichTextEditorControl>
      </RichTextEditor.Toolbar>

      <ReportProgressModal
        opened={modalState.opened}
        onClose={() => setModalState((prev) => ({ ...prev, opened: false }))}
        stage={modalState.stage}
        plan={modalState.plan}
        currentSection={modalState.currentSection}
        totalSections={modalState.totalSections}
        error={modalState.error}
      />

      {editor && (
        <BubbleMenu editor={editor}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Link />
          </RichTextEditor.ControlsGroup>
        </BubbleMenu>
      )}
    </React.Fragment>
  );
}
