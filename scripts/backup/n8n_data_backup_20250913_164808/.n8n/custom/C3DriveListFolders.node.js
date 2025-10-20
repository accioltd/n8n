"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3DriveListFolders = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const GRAPH = "https://graph.microsoft.com/v1.0";
async function getAppToken() {
    const body = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    });
    const res = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body });
    if (!res.ok)
        throw new Error(`Token error ${res.status}`);
    const json = (await res.json());
    return json.access_token;
}
function getFolderListUrl(folderPath) {
    const driveId = process.env.DRIVE_ID;
    const appFolder = process.env.APP_FOLDER || "_C3App";
    let fullPath = appFolder;
    if (folderPath && folderPath.trim() !== "") {
        const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
        fullPath = `${appFolder}/${cleanPath}`;
    }
    return `${GRAPH}/drives/${driveId}/root:/${encodeURIComponent(fullPath)}:/children`;
}
class C3DriveListFolders {
    constructor() {
        this.description = {
            displayName: "C3Drive List Folders",
            name: "c3DriveListFolders",
            group: ["transform"],
            version: 1,
            description: "List folders in C3Drive",
            defaults: {
                name: "C3Drive List Folders",
                color: "#0078d4",
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
                    description: "The folder path to list subfolders from. Leave empty to list root folders, use 'Semios' for subfolders of Semios, or 'Semios/reports' for subfolders of reports",
                    required: false,
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            const folderPath = this.getNodeParameter("folderPath", i);
            try {
                const token = await getAppToken();
                const url = getFolderListUrl(folderPath);
                const res = await fetch(url, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                if (!res.ok) {
                    throw new Error(`Failed to list folders: ${res.status} ${res.statusText} - ${await res.text()}`);
                }
                const result = await res.json();
                const folders = (result.value || []).filter((item) => item.folder);
                for (const folder of folders) {
                    const fullPath = folderPath && folderPath.trim() !== "" ? `${folderPath}/${folder.name}` : folder.name;
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
                    const locationDesc = folderPath && folderPath.trim() !== "" ? folderPath : "root";
                    returnData.push({
                        json: {
                            message: `No folders found in ${locationDesc}`,
                            path: folderPath || "root",
                            count: 0,
                        },
                    });
                }
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `C3Drive List Folders operation failed: ${error}`);
            }
        }
        return [returnData];
    }
}
exports.C3DriveListFolders = C3DriveListFolders;
