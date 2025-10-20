/**
 * C3Drive utils — builds ABSOLUTE Microsoft Graph URLs correctly.
 * Ensures base includes /v1.0 (unless you set /beta) and joins without losing the path.
 */

const DEFAULT_GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function graphJoin(path: string): string {
  // ensure base keeps /v1.0; trim extra slashes; avoid leading slash in rel
  let base = (process.env.MS_GRAPH_BASE || DEFAULT_GRAPH_BASE).replace(
    /\/+$/,
    ""
  );
  if (/^https:\/\/graph\.microsoft\.com\/?$/.test(base)) base += "/v1.0";
  const rel = path.replace(/^\/+/, "");
  return `${base}/${rel}`;
}

export async function getAppToken(): Promise<string> {
  const { CLIENT_ID, CLIENT_SECRET, TENANT_ID } = process.env;
  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID) {
    throw new Error("Missing env: CLIENT_ID, CLIENT_SECRET, TENANT_ID");
  }

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get access token: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export function getFolderListUrl(folderPath: string = ""): string {
  const driveId = process.env.DRIVE_ID;
  const appFolder = (process.env.APP_FOLDER ?? "_C3App").trim(); // use ?? so "" means root
  if (!driveId)
    throw new Error("Missing required environment variable: DRIVE_ID");

  const fullPath = folderPath
    ? `${appFolder ? appFolder + "/" : ""}${folderPath.replace(
        /^\/+|\/+$/g,
        ""
      )}`
    : appFolder;

  if (!fullPath) return graphJoin(`drives/${driveId}/root/children`);
  return graphJoin(`drives/${driveId}/root:/${fullPath}:/children`);
}

export function getFolderUrl(folderPath: string = ""): string {
  const driveId = process.env.DRIVE_ID;
  const appFolder = (process.env.APP_FOLDER ?? "_C3App").trim();
  if (!driveId)
    throw new Error("Missing required environment variable: DRIVE_ID");

  const full = folderPath
    ? `${appFolder ? appFolder + "/" : ""}${folderPath}`.replace(
        /^\/+|\/+$/g,
        ""
      )
    : appFolder;

  if (!full) return graphJoin(`drives/${driveId}/root`);
  return graphJoin(`drives/${driveId}/root:/${full}`);
}

// C3DriveUtils

// Detect if input is an absolute HTTP(S) URL (SharePoint webUrl)
function isAbsoluteHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Build absolute Microsoft Graph URL, preserving /v1.0 when MS_GRAPH_BASE is just the host
function buildGraphUrl(rel: string): string {
  let base = (
    process.env.MS_GRAPH_BASE || "https://graph.microsoft.com/v1.0"
  ).replace(/\/+$/, "");
  if (/^https:\/\/graph\.microsoft\.com\/?$/.test(base)) base += "/v1.0";
  return `${base}/${rel.replace(/^\/+/, "")}`;
}

// Convert SharePoint/OneDrive webUrl to Graph shareId (u! + base64url(webUrl))
export function webUrlToShareId(webUrl: string): string {
  const b64 = Buffer.from(webUrl, "utf8").toString("base64");
  const b64url = b64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `u!${b64url}`;
}

// Children endpoint for a folder identified by webUrl (Graph /shares API)
export function getDriveItemChildrenUrlFromWebUrl(webUrl: string): string {
  return buildGraphUrl(`shares/${webUrlToShareId(webUrl)}/driveItem/children`);
}

// Public helper: get the correct files-list URL from either a relative path or a full webUrl
// - If input is empty -> use your existing getFolderListUrl('') (lists APP_FOLDER or root)
// - If input is absolute URL -> use /shares/{shareId}/driveItem/children
// - Otherwise -> use your existing getFolderListUrl(relativePath)
export function getFilesListUrl(input?: string): string {
  const s = (input ?? "").trim();
  if (!s) return getFolderListUrl("");
  if (isAbsoluteHttpUrl(s)) return getDriveItemChildrenUrlFromWebUrl(s);
  return getFolderListUrl(s);
}

// base = https://graph.microsoft.com/v1.0 (keeps /v1.0 if MS_GRAPH_BASE is just the host)
function graphBase(): string {
  const raw = (
    process.env.MS_GRAPH_BASE || "https://graph.microsoft.com/v1.0"
  ).replace(/\/+$/, "");
  return /^https:\/\/graph\.microsoft\.com\/?$/.test(raw) ? `${raw}/v1.0` : raw;
}

// Build small-file upload URL (PUT .../content) from path OR webUrl
export function buildUploadUrl(folderInput: string, fileName: string): string {
  const base = graphBase();
  const safeName = encodeURIComponent(fileName);

  if (isAbsoluteHttpUrl(folderInput)) {
    const shareId = webUrlToShareId(folderInput);
    return `${base}/shares/${shareId}/driveItem:/${safeName}:/content?@microsoft.graph.conflictBehavior=replace`;
  }

  const driveId = process.env.DRIVE_ID;
  const appFolder = (process.env.APP_FOLDER ?? "_C3App").trim();
  if (!driveId) throw new Error("Missing env: DRIVE_ID");

  const clean = folderInput.trim().replace(/^\/+|\/+$/g, "");
  const full = clean
    ? `${appFolder ? appFolder + "/" : ""}${clean}`
    : appFolder; // may be ""

  const encoded = full
    ? full.split("/").filter(Boolean).map(encodeURIComponent).join("/")
    : "";

  if (!encoded)
    return `${base}/drives/${driveId}/root:/${safeName}:/content?@microsoft.graph.conflictBehavior=replace`;
  return `${base}/drives/${driveId}/root:/${encoded}/${safeName}:/content?@microsoft.graph.conflictBehavior=replace`;
}

// Build large-file upload-session URL (POST .../createUploadSession) from path OR webUrl
export function buildUploadSessionUrl(
  folderInput: string,
  fileName: string
): string {
  const base = graphBase();
  const safeName = encodeURIComponent(fileName);

  if (isAbsoluteHttpUrl(folderInput)) {
    const shareId = webUrlToShareId(folderInput);
    return `${base}/shares/${shareId}/driveItem:/${safeName}:/createUploadSession`;
  }

  const driveId = process.env.DRIVE_ID;
  const appFolder = (process.env.APP_FOLDER ?? "_C3App").trim();
  if (!driveId) throw new Error("Missing env: DRIVE_ID");

  const clean = folderInput.trim().replace(/^\/+|\/+$/g, "");
  const full = clean
    ? `${appFolder ? appFolder + "/" : ""}${clean}`
    : appFolder;

  const encoded = full
    ? full.split("/").filter(Boolean).map(encodeURIComponent).join("/")
    : "";

  if (!encoded)
    return `${base}/drives/${driveId}/root:/${safeName}:/createUploadSession`;
  return `${base}/drives/${driveId}/root:/${encoded}/${safeName}:/createUploadSession`;
}
