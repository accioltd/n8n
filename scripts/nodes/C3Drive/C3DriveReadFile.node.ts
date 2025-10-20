// /scripts/nodes/C3Drive/C3DriveReadFile.node.ts
import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from "n8n-workflow";
import { getAppToken, webUrlToShareId } from "./C3DriveUtils";

export class C3DriveReadFile implements INodeType {
  description: INodeTypeDescription = {
    displayName: "C3Drive Read File",
    icon: "fa:file",
    name: "c3DriveReadFile",
    group: ["transform"],
    version: 1,
    description: "Download a file by webUrl and output as binary",
    defaults: {
      name: "C3Drive Read File",
      color: "#008763",
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "File Web URL",
        name: "webUrl",
        type: "string",
        default: "",
        required: true,
        description: "SharePoint/OneDrive webUrl of the file",
      },
      {
        displayName: "Binary Property",
        name: "binaryProperty",
        type: "string",
        default: "data",
        description: "Property name for the binary output",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Normalize Graph base and ensure /v1.0 is present
    const rawBase =
      process.env.MS_GRAPH_BASE || "https://graph.microsoft.com/v1.0";
    const trimmed = rawBase.replace(/\/+$/, "");
    const graphBase = /^https:\/\/graph\.microsoft\.com\/?$/.test(trimmed)
      ? `${trimmed}/v1.0`
      : trimmed;

    for (let i = 0; i < items.length; i++) {
      try {
        const webUrl = this.getNodeParameter("webUrl", i) as string;
        const binaryProperty =
          (this.getNodeParameter("binaryProperty", i) as string) || "data";

        if (!/^https?:\/\//i.test(webUrl)) {
          throw new Error("webUrl must be an absolute http(s) URL");
        }

        const token = await getAppToken();
        const shareId = webUrlToShareId(webUrl);

        // 1) Metadata (name, mimeType, size)
        const metaUrl = `${graphBase}/shares/${shareId}/driveItem`;
        const metaRes = await fetch(metaUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!metaRes.ok) {
          throw new Error(
            `Failed to get metadata: ${metaRes.status} ${
              metaRes.statusText
            } - ${await metaRes.text()}`
          );
        }
        const meta = await metaRes.json();

        // 2) Content
        const contentUrl = `${graphBase}/shares/${shareId}/driveItem/content`;
        const res = await fetch(contentUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          redirect: "follow",
        });
        if (!res.ok) {
          throw new Error(
            `Failed to download: ${res.status} ${res.statusText}`
          );
        }
        const buf = Buffer.from(await res.arrayBuffer());

        const fileName: string = meta?.name || "file";
        const mimeType: string | undefined = meta?.file?.mimeType;

        const binary = await this.helpers.prepareBinaryData(
          buf,
          fileName,
          mimeType
        );

        returnData.push({
          json: {
            webUrl,
            id: meta?.id,
            name: meta?.name,
            size: meta?.size,
            lastModifiedDateTime: meta?.lastModifiedDateTime,
            mimeType,
          },
          binary: { [binaryProperty]: binary },
        });
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          `C3Drive Read File failed: ${error}`
        );
      }
    }

    return [returnData];
  }
}

module.exports = { C3DriveReadFile };
