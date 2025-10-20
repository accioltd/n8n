"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3DriveCreateFolder = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const C3DriveUtils_1 = require("./C3DriveUtils");
class C3DriveCreateFolder {
    constructor() {
        this.description = {
            displayName: "C3Drive Create Folder",
            name: "c3DriveCreateFolder",
            group: ["transform"],
            version: 1,
            description: "Create folders in C3Drive",
            defaults: {
                name: "C3Drive Create Folder",
                color: "#0078d4",
            },
            inputs: ["main"],
            outputs: ["main"],
            credentials: [
                {
                    name: "microsoftGraphApi",
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: "SharePoint URL",
                    name: "webUrl",
                    type: "string",
                    default: "",
                    placeholder: "https://yourtenant.sharepoint.com/sites/yoursite",
                    description: "The SharePoint site URL where you want to create the folder",
                    required: true,
                },
                {
                    displayName: "Parent Folder Path",
                    name: "parentPath",
                    type: "string",
                    default: "/Documents",
                    placeholder: "/Documents",
                    description: "The parent folder path where the new folder should be created",
                    required: true,
                },
                {
                    displayName: "Folder Name",
                    name: "folderName",
                    type: "string",
                    default: "",
                    placeholder: "MyNewFolder",
                    description: "The name of the folder to create",
                    required: true,
                },
                {
                    displayName: "Create Parent Folders",
                    name: "createParents",
                    type: "boolean",
                    default: true,
                    description: "Create parent folders if they do not exist",
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        try {
            const credentials = (await this.getCredentials("microsoftGraphApi"));
            const accessToken = await (0, C3DriveUtils_1.getAccessToken)(credentials);
            for (let i = 0; i < items.length; i++) {
                const webUrl = this.getNodeParameter("webUrl", i);
                const parentPath = this.getNodeParameter("parentPath", i);
                const folderName = this.getNodeParameter("folderName", i);
                const createParents = this.getNodeParameter("createParents", i);
                if (!webUrl || !parentPath || !folderName) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), "SharePoint URL, parent path, and folder name are required");
                }
                // Extract site and drive information
                const siteInfo = (0, C3DriveUtils_1.extractSiteAndDriveFromUrl)(webUrl);
                if (!siteInfo) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), "Invalid SharePoint URL format");
                }
                try {
                    // Get site ID
                    const siteResponse = await (0, C3DriveUtils_1.makeGraphRequest)(`/sites/${siteInfo.siteId}`, "GET", undefined, {}, accessToken);
                    // Get default drive
                    const driveResponse = await (0, C3DriveUtils_1.makeGraphRequest)(`/sites/${siteResponse.id}/drive`, "GET", undefined, {}, accessToken);
                    // Clean up parent path
                    const cleanParentPath = parentPath.startsWith("/")
                        ? parentPath.substring(1)
                        : parentPath;
                    // Create folder
                    const createUrl = `/drives/${driveResponse.id}/root:/${cleanParentPath}:/children`;
                    const folderData = {
                        name: folderName,
                        folder: {},
                        "@microsoft.graph.conflictBehavior": "rename",
                    };
                    const createResponse = await fetch(`https://graph.microsoft.com/v1.0${createUrl}`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(folderData),
                    });
                    if (!createResponse.ok) {
                        const errorText = await createResponse.text();
                        throw new Error(`Failed to create folder: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
                    }
                    const createResult = await createResponse.json();
                    returnData.push({
                        json: {
                            success: true,
                            folder: createResult,
                            parentPath: parentPath,
                            folderName: folderName,
                            fullPath: `${parentPath}/${folderName}`,
                            message: `Folder created successfully: ${parentPath}/${folderName}`,
                        },
                    });
                }
                catch (error) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: `Failed to create folder: ${error}`,
                    });
                }
            }
            return [returnData];
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `C3Drive Create Folder operation failed: ${error}`);
        }
    }
}
exports.C3DriveCreateFolder = C3DriveCreateFolder;
