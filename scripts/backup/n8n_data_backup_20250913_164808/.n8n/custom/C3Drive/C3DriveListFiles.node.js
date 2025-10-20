"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3DriveListFiles = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const C3DriveUtils_1 = require("./C3DriveUtils");
class C3DriveListFiles {
    constructor() {
        this.description = {
            displayName: "C3Drive List Files",
            name: "c3DriveListFiles",
            group: ["transform"],
            version: 1,
            description: "List files in C3Drive",
            defaults: {
                name: "C3Drive List Files",
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
                    default: "/Documents",
                    placeholder: "/Documents",
                    description: "The folder path to list files from",
                    required: true,
                },
                {
                    displayName: "File Extension Filter",
                    name: "fileExtension",
                    type: "string",
                    default: "",
                    placeholder: ".pdf,.docx,.xlsx",
                    description: "Filter by file extensions (comma-separated)",
                },
                {
                    displayName: "Max Results",
                    name: "maxResults",
                    type: "number",
                    default: 100,
                    description: "Maximum number of files to return",
                },
                {
                    displayName: "Sort By",
                    name: "sortBy",
                    type: "options",
                    options: [
                        {
                            name: "Name",
                            value: "name",
                        },
                        {
                            name: "Last Modified",
                            value: "lastModifiedDateTime",
                        },
                        {
                            name: "Size",
                            value: "size",
                        },
                    ],
                    default: "name",
                    description: "Sort files by",
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
                const fileExtension = this.getNodeParameter("fileExtension", i);
                const maxResults = this.getNodeParameter("maxResults", i);
                const sortBy = this.getNodeParameter("sortBy", i);
                if (!webUrl || !folderPath) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), "SharePoint URL and folder path are required");
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
                    // List files
                    let orderBy = "";
                    switch (sortBy) {
                        case "lastModifiedDateTime":
                            orderBy = "&$orderby=lastModifiedDateTime desc";
                            break;
                        case "size":
                            orderBy = "&$orderby=size desc";
                            break;
                        default:
                            orderBy = "&$orderby=name";
                    }
                    const listUrl = `/drives/${driveResponse.id}/root:/${cleanFolderPath}:/children?$filter=file ne null&$top=${maxResults}${orderBy}`;
                    const listResponse = await fetch(`https://graph.microsoft.com/v1.0${listUrl}`, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                    });
                    if (!listResponse.ok) {
                        const errorText = await listResponse.text();
                        throw new Error(`Failed to list files: ${listResponse.status} ${listResponse.statusText} - ${errorText}`);
                    }
                    const listResult = await listResponse.json();
                    let files = listResult.value || [];
                    // Filter by file extension if specified
                    if (fileExtension) {
                        const extensions = fileExtension
                            .split(",")
                            .map((ext) => ext.trim().toLowerCase());
                        files = files.filter((file) => {
                            const fileName = file.name.toLowerCase();
                            return extensions.some((ext) => fileName.endsWith(ext));
                        });
                    }
                    // Process files
                    for (const file of files) {
                        returnData.push({
                            json: {
                                id: file.id,
                                name: file.name,
                                path: `${folderPath}/${file.name}`,
                                webUrl: file.webUrl,
                                downloadUrl: file["@microsoft.graph.downloadUrl"],
                                size: file.size,
                                mimeType: file.file?.mimeType,
                                createdDateTime: file.createdDateTime,
                                lastModifiedDateTime: file.lastModifiedDateTime,
                                file: file.file,
                                parentPath: folderPath,
                                driveId: driveResponse.id,
                                siteId: siteResponse.id,
                            },
                        });
                    }
                    // If no files found, return empty result
                    if (files.length === 0) {
                        returnData.push({
                            json: {
                                message: `No files found in ${folderPath}`,
                                path: folderPath,
                                count: 0,
                                filter: fileExtension || "none",
                            },
                        });
                    }
                }
                catch (error) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: `Failed to list files: ${error}`,
                    });
                }
            }
            return [returnData];
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `C3Drive List Files operation failed: ${error}`);
        }
    }
}
exports.C3DriveListFiles = C3DriveListFiles;
