"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3DriveDeleteFile = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const C3DriveUtils_1 = require("./C3DriveUtils");
class C3DriveDeleteFile {
    constructor() {
        this.description = {
            displayName: "C3Drive Delete File",
            name: "c3DriveDeleteFile",
            group: ["transform"],
            version: 1,
            description: "Delete files from C3Drive",
            defaults: {
                name: "C3Drive Delete File",
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
                    description: "The SharePoint site URL where the file is located",
                    required: true,
                },
                {
                    displayName: "File Path",
                    name: "filePath",
                    type: "string",
                    default: "",
                    placeholder: "/Documents/MyFile.txt",
                    description: "The path to the file to delete in C3Drive",
                    required: true,
                },
                {
                    displayName: "Confirm Deletion",
                    name: "confirmDelete",
                    type: "boolean",
                    default: false,
                    description: "Confirm that you want to delete this file (safety check)",
                    required: true,
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
                const filePath = this.getNodeParameter("filePath", i);
                const confirmDelete = this.getNodeParameter("confirmDelete", i);
                if (!webUrl || !filePath) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), "SharePoint URL and file path are required");
                }
                if (!confirmDelete) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Please confirm deletion by checking the "Confirm Deletion" option');
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
                    // Clean up file path
                    const cleanPath = filePath.startsWith("/")
                        ? filePath.substring(1)
                        : filePath;
                    // Delete file
                    const deleteUrl = `/drives/${driveResponse.id}/root:/${cleanPath}`;
                    const deleteResponse = await fetch(`https://graph.microsoft.com/v1.0${deleteUrl}`, {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    });
                    if (!deleteResponse.ok) {
                        const errorText = await deleteResponse.text();
                        throw new Error(`Failed to delete file: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}`);
                    }
                    returnData.push({
                        json: {
                            success: true,
                            filePath: filePath,
                            message: `File deleted successfully: ${filePath}`,
                        },
                    });
                }
                catch (error) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: `Failed to delete file: ${error}`,
                    });
                }
            }
            return [returnData];
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `C3Drive Delete File operation failed: ${error}`);
        }
    }
}
exports.C3DriveDeleteFile = C3DriveDeleteFile;
