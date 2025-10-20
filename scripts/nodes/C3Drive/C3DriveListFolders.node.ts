import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from "n8n-workflow";
import { getAppToken, getFolderListUrl } from "./C3DriveUtils";

export class C3DriveListFolders implements INodeType {
  description: INodeTypeDescription = {
    displayName: "C3Drive List Folders",
    icon: "fa:folder",
    name: "c3DriveListFolders",
    group: ["transform"],
    version: 1,
    description: "List folders in C3Drive",
    defaults: {
      name: "C3Drive List Folders",
      color: "#008763",
    },
    inputs: ["main"] as any,
    outputs: ["main"] as any,
    properties: [
      {
        displayName: "Folder Path",
        name: "folderPath",
        type: "string",
        default: "",
        placeholder: "Semios or Semios/reports or leave empty for root",
        description:
          "The folder path to list subfolders from. Leave empty to list root folders, use 'Semios' for subfolders of Semios, or 'Semios/reports' for subfolders of reports",
        required: false,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const graphBase =
      process.env.MS_GRAPH_BASE || "https://graph.microsoft.com/v1.0";

    for (let i = 0; i < items.length; i++) {
      const folderPath = this.getNodeParameter("folderPath", i) as string;
      try {
        const token = await getAppToken();
        const relativePath = getFolderListUrl(folderPath); // may return "/drives/.../children"
        const url = new URL(relativePath, graphBase).toString(); // ensure ABSOLUTE URL

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(
            `Failed to list folders: ${res.status} ${
              res.statusText
            } - ${await res.text()}`
          );
        }

        const result = await res.json();
        const folders = (result.value || []).filter((item: any) => item.folder);

        for (const folder of folders) {
          const fullPath =
            folderPath && folderPath.trim() !== ""
              ? `${folderPath}/${folder.name}`
              : folder.name;

          returnData.push({
            json: {
              id: folder.id,
              name: folder.name,
              path: fullPath,
              webUrl: folder.webUrl,
              size: folder.size,
              createdDateTime: folder.createdDateTime,
              lastModifiedDateTime: folder.lastModifiedDateTime,
              folder: folder.folder,
              parentPath: folderPath || "root",
            },
          });
        }

        if (folders.length === 0) {
          const locationDesc =
            folderPath && folderPath.trim() !== "" ? folderPath : "root";
          returnData.push({
            json: {
              message: `No folders found in ${locationDesc}`,
              path: folderPath || "root",
              count: 0,
            },
          });
        }
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          `C3Drive List Folders operation failed: ${error}`
        );
      }
    }

    return [returnData];
  }
}

module.exports = { C3DriveListFolders };
