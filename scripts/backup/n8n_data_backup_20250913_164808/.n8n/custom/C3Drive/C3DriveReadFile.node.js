"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.C3DriveReadFile = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const C3DriveUtils_1 = require("./C3DriveUtils");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class C3DriveReadFile {
    constructor() {
        this.description = {
            displayName: "C3Drive Read File",
            name: "c3DriveReadFile",
            group: ["transform"],
            version: 1,
            description: "Read files from C3Drive",
            defaults: {
                name: "C3Drive Read File",
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
                    description: "The path to the file in C3Drive",
                    required: true,
                },
                {
                    displayName: "Output Format",
                    name: "outputFormat",
                    type: "options",
                    options: [
                        {
                            name: "Text",
                            value: "text",
                        },
                        {
                            name: "JSON",
                            value: "json",
                        },
                        {
                            name: "Base64",
                            value: "base64",
                        },
                    ],
                    default: "text",
                    description: "How to format the file content in the output",
                },
                {
                    displayName: "Save to Local Storage",
                    name: "saveLocal",
                    type: "boolean",
                    default: false,
                    description: "Also save a copy to local storage in /data directory",
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
                const outputFormat = this.getNodeParameter("outputFormat", i);
                const saveLocal = this.getNodeParameter("saveLocal", i);
                if (!webUrl || !filePath) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), "SharePoint URL and file path are required");
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
                    // Get file content
                    const contentUrl = `/drives/${driveResponse.id}/root:/${cleanPath}:/content`;
                    const contentResponse = await fetch(`https://graph.microsoft.com/v1.0${contentUrl}`, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    });
                    if (!contentResponse.ok) {
                        const errorText = await contentResponse.text();
                        throw new Error(`Failed to read file: ${contentResponse.status} ${contentResponse.statusText} - ${errorText}`);
                    }
                    let fileContent;
                    let processedContent;
                    if (outputFormat === "base64") {
                        const buffer = await contentResponse.arrayBuffer();
                        processedContent = Buffer.from(buffer).toString("base64");
                    }
                    else {
                        fileContent = await contentResponse.text();
                        if (outputFormat === "json") {
                            try {
                                processedContent = JSON.parse(fileContent);
                            }
                            catch {
                                processedContent = fileContent;
                            }
                        }
                        else {
                            processedContent = fileContent;
                        }
                    }
                    // Save to local storage if requested
                    if (saveLocal && fileContent) {
                        try {
                            const localPath = path.join("/data", cleanPath);
                            const localDir = path.dirname(localPath);
                            // Create directory if it doesn't exist
                            fs.mkdirSync(localDir, { recursive: true });
                            // Write file
                            fs.writeFileSync(localPath, fileContent, "utf8");
                        }
                        catch (localError) {
                            // Log warning but don't fail the operation
                            console.warn("Failed to save local copy:", localError);
                        }
                    }
                    returnData.push({
                        json: {
                            success: true,
                            filePath: filePath,
                            content: processedContent,
                            outputFormat: outputFormat,
                            localPath: saveLocal ? path.join("/data", cleanPath) : null,
                            message: `File read successfully from ${filePath}`,
                        },
                    });
                }
                catch (error) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: `Failed to read file: ${error}`,
                    });
                }
            }
            return [returnData];
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `C3Drive Read File operation failed: ${error}`);
        }
    }
}
exports.C3DriveReadFile = C3DriveReadFile;
