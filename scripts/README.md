# Custom OneDrive Nodes for n8n

This directory contains custom n8n nodes for OneDrive operations using Microsoft Graph API.

## Nodes

### 1. OneDrive Save File

- **Description**: Save content to a file in OneDrive
- **Parameters**:
  - File Name: Name of the file to save
  - Content: Text content to save
  - Content Type: MIME type (default: application/octet-stream)
- **Features**:
  - Supports small files (≤4MB) with simple PUT
  - Supports large files (>4MB) with chunked upload
  - Returns file metadata including ID, web URL, and timestamps

### 2. OneDrive Read File

- **Description**: Read a file from OneDrive
- **Parameters**:
  - File Name: Name of the file to read
  - Output Format: text, base64, or buffer
- **Features**:
  - Returns file content in chosen format
  - Includes file metadata (size, timestamps, etc.)
  - Handles binary and text files

### 3. OneDrive Delete File

- **Description**: Delete a file from OneDrive
- **Parameters**:
  - File Name: Name of the file to delete
  - Confirm Delete: Safety checkbox to confirm deletion
- **Features**:
  - Idempotent operation (safe to run multiple times)
  - Requires confirmation for safety

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# Azure AD App Registration
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
TENANT_ID=your-tenant-id

# OneDrive Configuration
DRIVE_ID=your-drive-id
APP_FOLDER=your-app-folder-name
```

### 2. Azure AD App Registration

1. Go to Azure Portal > Azure Active Directory > App registrations
2. Create a new registration
3. Add API permissions:
   - Microsoft Graph > Application permissions > Files.ReadWrite.All
4. Grant admin consent
5. Create a client secret

### 3. Get Drive ID

Use Microsoft Graph Explorer or PowerShell:

```powershell
# Using Graph Explorer
GET https://graph.microsoft.com/v1.0/me/drive

# Or for a specific site
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drive
```

### 4. Build and Deploy

```bash
# Build the TypeScript nodes
./build.sh

# Restart n8n to load new nodes
docker compose down && docker compose up -d
```

## Development

### Structure

```
scripts/
├── src/                          # TypeScript source files
│   └── nodes/
│       └── OneDrive/
│           ├── OneDriveUtils.ts          # Shared utilities
│           ├── OneDriveSaveFile.node.ts  # Save file node
│           ├── OneDriveReadFile.node.ts  # Read file node
│           └── OneDriveDeleteFile.node.ts # Delete file node
├── nodes/                        # Compiled JavaScript files
│   └── OneDrive/
│       ├── *.js                  # Compiled nodes
│       └── *.node.json          # Node descriptions
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
└── build.sh                     # Build script
```

### Building

The nodes are written in TypeScript and compiled to JavaScript. Run `./build.sh` or `npm run build` to compile.

### Adding New Nodes

1. Create TypeScript file in `src/nodes/OneDrive/`
2. Create corresponding JSON description file
3. Update `package.json` to include the new node
4. Run build script
5. Restart n8n

## Troubleshooting

### Common Issues

1. **"Missing environment variables"**: Ensure all required env vars are set
2. **"Token error"**: Check Azure AD app permissions and client secret
3. **"Not found"**: Verify DRIVE_ID and APP_FOLDER are correct
4. **Nodes not appearing**: Restart n8n container after building

### Logs

Check n8n logs for detailed error information:

```bash
docker compose logs n8n
```
