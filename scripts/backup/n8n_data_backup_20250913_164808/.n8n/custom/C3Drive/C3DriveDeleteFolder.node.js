"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3DriveDeleteFolder = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const C3DriveUtils_1 = require("./C3DriveUtils");
class C3DriveDeleteFolder {
    constructor() {
        this.description = {
            displayName: "C3Drive Delete Folder",
            name: "c3DriveDeleteFolder",
            group: ["transform"],
            version: 1,
            description: "Delete folders in C3Drive",
            defaults: {
                name: "C3Drive Delete Folder",
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
                    description: "The SharePoint site URL",
                    required: true,
                },
                {
                    displayName: "Folder Path",
                    name: "folderPath",
                    type: "string",
                    default: "",
                    placeholder: "/Documents/FolderToDelete",
                    description: "The full path of the folder to delete",
                    required: true,
                },
                {
                    displayName: "Confirm Deletion",
                    name: "confirmDeletion",
                    type: "boolean",
                    default: false,
                    description: "Confirm that you want to delete this folder and all its contents",
                    required: true,
                },
                {
                    displayName: "Delete Non-Empty Folders",
                    name: "deleteNonEmpty",
                    type: "boolean",
                    default: false,
                    description: "Allow deletion of folders that contain files or subfolders",
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
                const folderPath = this.getNodeParameter("folderPath", i);
                const confirmDeletion = this.getNodeParameter("confirmDeletion", i);
                const deleteNonEmpty = this.getNodeParameter("deleteNonEmpty", i);
                if (!webUrl || !folderPath) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), "SharePoint URL and folder path are required");
                }
                if (!confirmDeletion) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Deletion must be confirmed by setting "Confirm Deletion" to true');
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
                    // Clean up folder path
                    const cleanFolderPath = folderPath.startsWith("/")
                        ? folderPath.substring(1)
                        : folderPath;
                    // First, check if folder exists and get its details
                    const checkUrl = `/drives/${driveResponse.id}/root:/${cleanFolderPath}`;
                    const checkResponse = await fetch(`https://graph.microsoft.com/v1.0${checkUrl}`, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                    });
                    if (!checkResponse.ok) {
                        if (checkResponse.status === 404) {
                            returnData.push({
                                json: {
                                    success: false,
                                    message: `Folder not found: ${folderPath}`,
                                    path: folderPath,
                                    error: "Folder does not exist",
                                },
                            });
                            continue;
                        }
                        const errorText = await checkResponse.text();
                        throw new Error(`Failed to check folder: ${checkResponse.status} ${checkResponse.statusText} - ${errorText}`);
                    }
                    const folderInfo = await checkResponse.json();
                    // Check if it's actually a folder
                    if (!folderInfo.folder) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Path ${folderPath} is not a folder`);
                    }
                    // If deleteNonEmpty is false, check if folder is empty
                    if (!deleteNonEmpty) {
                        const contentsUrl = `/drives/${driveResponse.id}/root:/${cleanFolderPath}:/children?$top=1`;
                        const contentsResponse = await fetch(`https://graph.microsoft.com/v1.0${contentsUrl}`, {
                            method: "GET",
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                            },
                        });
                        if (contentsResponse.ok) {
                            const contentsResult = await contentsResponse.json();
                            if (contentsResult.value && contentsResult.value.length > 0) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Folder ${folderPath} is not empty. Set "Delete Non-Empty Folders" to true to force deletion.`);
                            }
                        }
                    }
                    // Delete the folder
                    const deleteUrl = `/drives/${driveResponse.id}/items/${folderInfo.id}`;
                    const deleteResponse = await fetch(`https://graph.microsoft.com/v1.0${deleteUrl}`, {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    });
                    if (!deleteResponse.ok) {
                        const errorText = await deleteResponse.text();
                        throw new Error(`Failed to delete folder: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}`);
                    }
                    returnData.push({
                        json: {
                            success: true,
                            message: `Folder deleted successfully: ${folderPath}`,
                            path: folderPath,
                            deletedFolder: {
                                id: folderInfo.id,
                                name: folderInfo.name,
                                size: folderInfo.size,
                                createdDateTime: folderInfo.createdDateTime,
                                lastModifiedDateTime: folderInfo.lastModifiedDateTime,
                            },
                        },
                    });
                }
                catch (error) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: `Failed to delete folder: ${error}`,
                    });
                }
            }
            return [returnData];
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `C3Drive Delete Folder operation failed: ${error}`);
        }
    }
}
exports.C3DriveDeleteFolder = C3DriveDeleteFolder;
