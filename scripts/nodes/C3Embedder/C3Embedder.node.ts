import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from "n8n-workflow";
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";

type ParsedChunk = {
  file: string;
  index: number;
  heading_path: string;
  page: string | number | null;
  text: string;
  token_count: number;
  embedding: number[];
};

const FILE_MARK = /^===\s+(.*?)\s+===\s*$/m,
  CHUNK_START = /^\[#\s*(\d+)\]/m,
  META_LINE = /^meta\.(file|heading_path|page|token_count|embedding):\s*(.*)$/,
  FENCE_OPEN = /^```markdown\s*$/,
  FENCE_CLOSE = /^```$/;

function parseStdout(stdout: string): ParsedChunk[] {
  const lines = stdout.split(/\r?\n/);
  const chunks: ParsedChunk[] = [];
  let currentFile = "";
  let i = 0;
  while (i < lines.length) {
    const fm = lines[i].match(FILE_MARK);
    if (fm) {
      currentFile = fm[1].trim();
      i++;
      continue;
    }
    const cs = lines[i].match(CHUNK_START);
    if (cs) {
      const index = Number(cs[1]);
      i++;
      let headingPath = "",
        page: string | number | null = null,
        tokenCount = 0,
        embedding: number[] = [];
      for (; i < lines.length; i++) {
        const m = lines[i].match(META_LINE);
        if (!m) break;
        if (m[1] === "heading_path") headingPath = m[2].trim();
        if (m[1] === "page") page = m[2].trim() === "None" ? null : m[2].trim();
        if (m[1] === "token_count") tokenCount = Number(m[2].trim());
        if (m[1] === "embedding") {
          try {
            embedding = JSON.parse(m[2].trim());
          } catch (e) {
            embedding = [];
          }
        }
      }
      if (!FENCE_OPEN.test(lines[i] || "")) {
        while (
          i < lines.length &&
          !CHUNK_START.test(lines[i]) &&
          !FILE_MARK.test(lines[i])
        )
          i++;
        continue;
      }
      i++;
      const buf: string[] = [];
      for (; i < lines.length; i++) {
        if (FENCE_CLOSE.test(lines[i])) {
          i++;
          break;
        }
        buf.push(lines[i]);
      }
      chunks.push({
        file: currentFile,
        index,
        heading_path: headingPath,
        page,
        text: buf.join("\n"),
        token_count: tokenCount,
        embedding,
      });
      continue;
    }
    i++;
  }
  return chunks;
}

function findPython(): string {
  const candidates = [
    process.env.N8N_C3_PYTHON,
    "python3",
    "python",
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/app/venv/bin/python",
    "/opt/venv/bin/python",
  ].filter(Boolean) as string[];
  for (const bin of candidates) {
    try {
      const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
      if (r.status === 0) return bin;
    } catch {}
  }
  throw new Error(
    "No Python interpreter found. Set N8N_C3_PYTHON to an absolute path."
  );
}

export class C3Embedder implements INodeType {
  description: INodeTypeDescription = {
    displayName: "C3Embedder",
    icon: "fa:tags",
    name: "c3Embedder",
    group: ["transform"],
    version: 1,
    description:
      "Extract documents to markdown, chunk them, and generate embeddings in one step",
    defaults: { name: "C3Embedder", color: "#008763" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "Company",
        name: "company",
        type: "string",
        default: "",
        placeholder: "e.g., BC Hydro",
        description: "Company name for this document",
        required: true,
      },
      {
        displayName: "File Path (optional)",
        name: "filePath",
        type: "string",
        default: "",
        placeholder: "e.g., /reports/2024/report.docx",
        description: "Optional file path for reference",
        required: false,
      },
      {
        displayName: "Concurrency",
        name: "concurrency",
        type: "number",
        default: 10,
        description: "Number of concurrent extraction processes",
      },
      {
        displayName: "Max Chunks (optional)",
        name: "maxChunks",
        type: "number",
        default: 0,
        description: "Maximum number of chunks to return (0 = all)",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();

    // Handle two cases:
    // 1. Direct from Loop Over Items: item.json is { filename, mimetype, size }
    // 2. Before Loop configured: item.json is { company, data: [{filename, mimetype, size}], ... }
    const item = items[0]?.json as any;

    let filename: string;
    let mimetype: string;
    let size: number;

    if (item?.filename) {
      // Already looped - direct access
      filename = item.filename;
      mimetype = item.mimetype;
      size = item.size;
    } else if (item?.data && Array.isArray(item.data) && item.data[0]) {
      // Not looped yet - extract from first data item
      filename = item.data[0].filename;
      mimetype = item.data[0].mimetype;
      size = item.data[0].size;
    } else {
      throw new NodeOperationError(
        this.getNode(),
        `No filename found. Loop Over Items should iterate over "data" field. Received: ${JSON.stringify(
          item
        )}`
      );
    }

    if (!filename) {
      throw new NodeOperationError(
        this.getNode(),
        `No filename found in input. Received: ${JSON.stringify(item)}`
      );
    }

    // Get parameters from node configuration
    const company = this.getNodeParameter("company", 0) as string;
    const filePath = this.getNodeParameter("filePath", 0) as string;
    const concurrency = this.getNodeParameter("concurrency", 0) as number;
    const maxChunks = this.getNodeParameter("maxChunks", 0) as number;

    // Step 1: Extract document to markdown
    const outRoot = join(tmpdir(), `n8n-output-${Date.now()}`);
    const outDir = join(outRoot, "out");
    mkdirSync(outDir, { recursive: true });

    const tempInDir = join(tmpdir(), `n8n-extract-${Date.now()}`);
    mkdirSync(tempInDir, { recursive: true });

    // Write binary data from input to temp files
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.binary) {
        for (const [key, binaryData] of Object.entries(item.binary)) {
          const fileName = binaryData.fileName || `file-${i}-${key}`;
          const filePath = join(tempInDir, fileName);
          const buffer = await this.helpers.getBinaryDataBuffer(i, key);
          writeFileSync(filePath, buffer);
        }
      }
    }

    const pythonBin = findPython();
    const extractScript = resolve(__dirname, "../extract.py");
    const extractCwd = dirname(resolve(__dirname, ".."));

    const extractArgs = [
      extractScript,
      "--in",
      tempInDir,
      "--out",
      outDir,
      "--image-mode",
      "referenced",
      "--concurrency",
      String(concurrency),
      "--describe-images",
    ];

    // Run extract.py
    const runExtract = (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }> =>
      new Promise((res, rej) => {
        const child = spawn(pythonBin, extractArgs, {
          cwd: extractCwd,
          env: process.env,
        });
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", rej);
        child.on("close", (code) => res({ code: code ?? -1, stdout, stderr }));
      });

    const extractResult = await runExtract();
    if (extractResult.code !== 0) {
      throw new NodeOperationError(
        this.getNode(),
        `extract.py failed (code ${extractResult.code}).\n${extractResult.stderr}\n${extractResult.stdout}`
      );
    }

    // Step 2: Chunk and generate embeddings
    const chunkerScript = resolve(__dirname, "../chunker.py");

    const runChunker = (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }> =>
      new Promise((res, rej) => {
        const child = spawn(pythonBin, [chunkerScript], {
          cwd: outRoot,
          env: process.env,
        });
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", rej);
        child.on("close", (code) => res({ code: code ?? -1, stdout, stderr }));
      });

    const chunkerResult = await runChunker();
    if (chunkerResult.code !== 0) {
      throw new NodeOperationError(
        this.getNode(),
        `chunker.py failed (code ${chunkerResult.code}).\n${chunkerResult.stderr}\n${chunkerResult.stdout}`
      );
    }

    // Parse chunker output
    const parsed = parseStdout(chunkerResult.stdout);
    const limited = maxChunks > 0 ? parsed.slice(0, maxChunks) : parsed;

    // Return chunks with document metadata
    return [
      limited.map((c) => ({
        json: {
          // Document metadata (for documents table)
          company: company,
          filename: filename,
          mimetype: mimetype,
          size: size,
          file_path: filePath || filename,

          // Chunk data
          content: c.text,
          heading: c.heading_path,
          level: 0,
          chunk_index: c.index,
          file: c.file,
          index: c.index,
          heading_path: c.heading_path,
          page: c.page === null ? null : String(c.page),
          text: c.text,
          token_count: c.token_count,
          embedding:
            c.embedding.length > 0 ? `[${c.embedding.join(",")}]` : null,
        },
      })),
    ];
  }
}

module.exports = { C3Embedder };
