"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
exports.makeGraphRequest = makeGraphRequest;
exports.extractSiteAndDriveFromUrl = extractSiteAndDriveFromUrl;
async function getAccessToken(credentials) {
    if (credentials.accessToken) {
        return credentials.accessToken;
    }
    const tokenUrl = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
    }
    const data = (await response.json());
    return data.access_token;
}
async function makeGraphRequest(endpoint, method = "GET", body, headers = {}, accessToken) {
    if (!accessToken) {
        throw new Error("Access token is required");
    }
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return await response.json();
}
function extractSiteAndDriveFromUrl(sharepointUrl) {
    try {
        const url = new URL(sharepointUrl);
        const pathParts = url.pathname.split("/");
        // Extract site collection and subsite
        const sitesIndex = pathParts.indexOf("sites");
        if (sitesIndex === -1 || sitesIndex + 1 >= pathParts.length) {
            return null;
        }
        const siteName = pathParts[sitesIndex + 1];
        const siteId = `${url.hostname}:/sites/${siteName}`;
        // For document libraries, extract drive ID
        const libraryIndex = pathParts.indexOf("Shared%20Documents") !== -1
            ? pathParts.indexOf("Shared%20Documents")
            : pathParts.indexOf("Documents");
        if (libraryIndex !== -1) {
            return { siteId, driveId: "documents" };
        }
        return { siteId, driveId: "documents" };
    }
    catch {
        return null;
    }
}
