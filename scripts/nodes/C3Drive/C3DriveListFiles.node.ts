// /scripts/nodes/C3Drive/C3DriveListFiles.node.ts
import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from "n8n-workflow";
import { getAppToken, getFilesListUrl } from "./C3DriveUtils";

export class C3DriveListFiles implements INodeType {
  description: INodeTypeDescription = {
    displayName: "C3Drive List Files",
    icon: "fa:file",
    name: "c3DriveListFiles",
    group: ["transform"],
    version: 1,
    description: "List files in C3Drive",
    defaults: {
      name: "C3Drive List Files",
      color: "#008763",
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "Folder Path",
        name: "folderPath",
        type: "string",
        default: "",
        placeholder: "Semios or Semios/reports or leave empty for root",
        description:
          "Leave empty to list files in the root app folder. Use 'Semios' for files under Semios, or 'Semios/reports' for files under reports.",
        required: false,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const folderPath =
        (this.getNodeParameter("folderPath", i) as string) || "";
      try {
        const token = await getAppToken();
        const url = getFilesListUrl(folderPath);
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(
            `Failed to list files: ${res.status} ${
              res.statusText
            } - ${await res.text()}`
          );
        }

        const result = await res.json();
        const files = (result.value || []).filter((item: any) => item.file);

        for (const file of files) {
          const href = file.webUrl as string;

          returnData.push({
            json: {
              id: file.id,
              name: file.name,
              path: href, // ← replace path with webUrl
              webUrl: href, // keep explicit webUrl as well
              size: file.size,
              mimeType: file.file?.mimeType,
              createdDateTime: file.createdDateTime,
              lastModifiedDateTime: file.lastModifiedDateTime,
              file: file.file,
              parentPath: folderPath || "root",
            },
          });
        }

        if (files.length === 0) {
          const locationDesc =
            folderPath && folderPath.trim() !== "" ? folderPath : "root";
          returnData.push({
            json: {
              message: `No files found in ${locationDesc}`,
              path: folderPath || "root",
              count: 0,
            },
          });
        }
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          `C3Drive List Files operation failed: ${error}`
        );
      }
    }

    return [returnData];
  }
}

module.exports = { C3DriveListFiles };
