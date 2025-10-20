import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from "n8n-workflow";
import {
  getAppToken,
  buildUploadUrl,
  buildUploadSessionUrl,
} from "./C3DriveUtils";

export class C3DriveSaveFile implements INodeType {
  description: INodeTypeDescription = {
    displayName: "C3Drive Save File",
    icon: "fa:file",
    name: "c3DriveSaveFile",
    group: ["transform"],
    version: 1,
    description:
      "Upload a single incoming binary to a SharePoint/OneDrive folder (accepts relative folder path or webUrl).",
    defaults: { name: "C3Drive Save File", color: "#008763" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "Folder Path or Web URL",
        name: "folderInput",
        type: "string",
        default: "",
        required: true,
        description:
          "Destination folder. Use a relative path (e.g. “Semios/reports”) or a full SharePoint webUrl.",
      },
      {
        displayName: "Binary Property",
        name: "binaryProperty",
        type: "string",
        default: "data",
        description:
          "Name of the binary property to upload from the incoming items.",
      },
      {
        displayName: "File Name (override)",
        name: "fileName",
        type: "string",
        default: "",
        description:
          "Optional. If empty, uses the incoming binary's fileName or “file”.",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    try {
      const items = this.getInputData();
      const folderInput = this.getNodeParameter("folderInput", 0) as string;
      const binaryProp =
        (this.getNodeParameter("binaryProperty", 0) as string) || "data";
      const overrideName = (
        (this.getNodeParameter("fileName", 0) as string) || ""
      ).trim();

      if (!folderInput) throw new Error("Folder Path or Web URL is required");

      // Pick the FIRST item that actually has the requested binary
      let pickedIdx = -1;
      let pickedBin: any = undefined;

      for (let i = 0; i < items.length; i++) {
        const bin = items[i].binary?.[binaryProp];
        if (bin && typeof bin.data === "string") {
          pickedIdx = i;
          pickedBin = bin;
          break;
        }
      }

      if (pickedIdx === -1) {
        const firstKeys = Object.keys(items[0]?.binary ?? {});
        throw new Error(
          `No items contain binary property "${binaryProp}". First item's binary keys: [${firstKeys.join(
            ", "
          )}]`
        );
      }

      const token = await getAppToken();

      const fileName = (
        overrideName ||
        pickedBin.fileName?.toString() ||
        "file"
      ).replace(/[\\\/]+/g, "_");
      const mimeType =
        pickedBin.mimeType?.toString() || "application/octet-stream";
      const buf = Buffer.from(pickedBin.data as string, "base64");

      let uploadedMeta: any;
      const FOUR_MIB = 4 * 1024 * 1024;

      if (buf.length <= FOUR_MIB) {
        const putUrl = buildUploadUrl(folderInput, fileName);
        const putRes = await fetch(putUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": mimeType,
            "Content-Length": String(buf.length),
          },
          body: buf,
        });
        if (!putRes.ok) {
          throw new Error(
            `Upload failed: ${putRes.status} ${
              putRes.statusText
            } - ${await putRes.text()}`
          );
        }
        uploadedMeta = await putRes.json();
      } else {
        const sessionUrl = buildUploadSessionUrl(folderInput, fileName);
        const sessionRes = await fetch(sessionUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item: {
              "@microsoft.graph.conflictBehavior": "replace",
              name: fileName,
            },
          }),
        });
        if (!sessionRes.ok) {
          throw new Error(
            `Failed to create upload session: ${sessionRes.status} ${
              sessionRes.statusText
            } - ${await sessionRes.text()}`
          );
        }
        const { uploadUrl } = await sessionRes.json();
        if (!uploadUrl)
          throw new Error("Upload session did not return uploadUrl");

        const CHUNK = 5 * 1024 * 1024;
        const total = buf.length;
        let next = 0;
        while (next < total) {
          const end = Math.min(next + CHUNK, total) - 1;
          const slice = buf.subarray(next, end + 1);
          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Length": String(slice.length),
              "Content-Range": `bytes ${next}-${end}/${total}`,
            },
            body: slice,
          });

          if (put.status === 202) {
            const j = await put.json();
            const rng = Array.isArray(j.nextExpectedRanges)
              ? j.nextExpectedRanges[0]
              : "";
            const start = Number(String(rng).split("-")[0] || NaN);
            if (!Number.isFinite(start))
              throw new Error("Invalid nextExpectedRanges");
            next = start;
          } else if (put.status === 201 || put.status === 200) {
            uploadedMeta = await put.json();
            break;
          } else {
            throw new Error(
              `Chunk upload failed: ${put.status} ${
                put.statusText
              } - ${await put.text()}`
            );
          }
        }
      }

      // Return a SINGLE item: metadata + the original picked binary
      const out: INodeExecutionData = {
        json: {
          id: uploadedMeta?.id,
          name: uploadedMeta?.name ?? fileName,
          size: uploadedMeta?.size ?? buf.length,
          mimeType,
          sourceItemIndex: pickedIdx,
        },
        binary: { [binaryProp]: pickedBin },
      };

      return [[out]];
    } catch (err) {
      throw new NodeOperationError(
        this.getNode(),
        `C3Drive Save File failed: ${err}`
      );
    }
  }
}

module.exports = { C3DriveSaveFile };
