from __future__ import annotations
from pathlib import Path
from typing import List, Tuple, Dict, Any
import re
import sys
import os
import json
from openai import AzureOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Config
# minimum characters per chunk (except for the initial root/preface)
MIN_CHARS = 800

HDR_RE = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")

# Initialize Azure OpenAI client
AZURE_OPENAI_ENDPOINT = (os.getenv("AZURE_OPENAI_ENDPOINT") or "").rstrip("/")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_VERSION = os.getenv("AZURE_OPENAI_VERSION")
# This is the deployment name in Azure
AZURE_EMBEDDING_DEPLOYMENT = "text-embedding-3-small"

if not (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_VERSION):
    sys.exit("Missing Azure config. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_VERSION.")

client = AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
)


def read_markdown(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def find_headings(md_text: str) -> List[Tuple[int, int, int, str]]:
    """
    Returns a list of headings: (line_index, char_start, level, title)
    """
    out: List[Tuple[int, int, int, str]] = []
    char_pos = 0
    for i, line in enumerate(md_text.splitlines(keepends=True)):
        m = HDR_RE.match(line.rstrip("\n"))
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            out.append((i, char_pos, level, title))
        char_pos += len(line)
    return out


def build_sections(md_text: str, headings: List[Tuple[int, int, int, str]]) -> List[Dict[str, Any]]:
    """
    Build sections strictly between headings.
    Each section dict: {start_char, end_char, heading_line, heading_path, is_root}
    - The first 'root' section is content before the first heading (if any).
    - Sections start at the heading line and end right before the next heading.
    - heading_path is derived from the nesting stack at that heading.
    """
    sections: List[Dict[str, Any]] = []
    total_len = len(md_text)

    if not headings:
        # All content is root
        sections.append(dict(
            start_char=0,
            end_char=total_len,
            heading_line="",
            heading_path=["(root)"],
            is_root=True,
        ))
        return sections

    # 1) root / preface before first heading
    first_char = headings[0][1]
    if first_char > 0:
        sections.append(dict(
            start_char=0,
            end_char=first_char,
            heading_line="",
            heading_path=["(root)"],
            is_root=True,
        ))

    # 2) sections for each heading
    # Maintain a stack for heading path
    # Each heading defines a new section starting at its char_start
    stack: List[Tuple[int, str]] = []  # (level, title)
    for idx, (line_idx, ch_start, level, title) in enumerate(headings):
        # Update stack to reflect current heading level
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, title))
        path = [t for (_lvl, t) in stack]

        # Determine this section's end_char
        if idx + 1 < len(headings):
            end_char = headings[idx + 1][1]
        else:
            end_char = total_len

        # Heading line text (exact)
        heading_line = md_text.splitlines(keepends=True)[line_idx].rstrip("\n")

        sections.append(dict(
            start_char=ch_start,
            end_char=end_char,
            heading_line=heading_line,
            heading_path=path[:],  # copy
            is_root=False,
        ))

    return sections


def merge_short_sections(md_text: str, sections: List[Dict[str, Any]], min_chars: int) -> List[Dict[str, Any]]:
    """
    Merge forward any non-root section whose text length < min_chars.
    Root/preface is exempt from the rule.
    Merge repeatedly until all non-root meet min_chars or there is no following section to merge into.
    """
    if not sections:
        return sections

    merged: List[Dict[str, Any]] = []
    i = 0
    while i < len(sections):
        cur = sections[i]
        # compute length of this section's body
        chunk_len = cur["end_char"] - cur["start_char"]
        if (not cur["is_root"]) and chunk_len < min_chars and i + 1 < len(sections):
            # merge with the next section
            nxt = sections[i + 1]
            # Expand current to include the next; heading path remains the current's path
            cur["end_char"] = nxt["end_char"]
            # We do not concatenate heading lines inside; the chunk text slice will contain both headings naturally
            # Remove next by skipping increment
            i += 2
            # Now check again with possibly further merges
            while i < len(sections) and (cur["end_char"] - cur["start_char"] < min_chars):
                cur["end_char"] = sections[i]["end_char"]
                i += 1
            merged.append(cur)
        else:
            merged.append(cur)
            i += 1

    return merged


def slice_text(md_text: str, start_char: int, end_char: int) -> str:
    return md_text[start_char:end_char]


def generate_embedding(text: str) -> List[float]:
    """Generate embedding using Azure OpenAI API with 1536 dimensions"""
    sys.stderr.write(
        f"[EMBEDDING] Starting embedding generation for text length: {len(text)}\n")
    sys.stderr.write(f"[EMBEDDING] First 100 chars: {text[:100]}\n")
    sys.stderr.write(
        f"[EMBEDDING] Using deployment: {AZURE_EMBEDDING_DEPLOYMENT}\n")
    sys.stderr.write(f"[EMBEDDING] Endpoint: {AZURE_OPENAI_ENDPOINT}\n")

    try:
        sys.stderr.write(f"[EMBEDDING] Calling Azure OpenAI API...\n")
        response = client.embeddings.create(
            model=AZURE_EMBEDDING_DEPLOYMENT,  # This is the deployment name
            input=text
        )
        sys.stderr.write(f"[EMBEDDING] API call successful\n")
        embedding = response.data[0].embedding
        sys.stderr.write(
            f"[EMBEDDING] Received embedding with {len(embedding)} dimensions\n")
        sys.stderr.write(f"[EMBEDDING] First 5 values: {embedding[:5]}\n")
        return embedding if embedding else []
    except Exception as e:
        sys.stderr.write(f"[EMBEDDING] ERROR: {type(e).__name__}: {str(e)}\n")
        import traceback
        sys.stderr.write(f"[EMBEDDING] Traceback:\n{traceback.format_exc()}\n")
        return []


def estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 token ≈ 4 characters"""
    return max(1, len(text) // 4)


def print_chunk(f: Path, idx: int, section: Dict[str, Any], text: str) -> None:
    sys.stderr.write(f"\n[CHUNK {idx}] Starting processing\n")
    hp = section["heading_path"]
    page = None  # markdown has no inherent page info

    # Calculate token count from the ORIGINAL text before any modifications
    token_count = estimate_tokens(text)
    sys.stderr.write(
        f"[CHUNK {idx}] Original text length: {len(text)}, token_count: {token_count}\n")

    # Ensure heading line is present at the top of the chunk text (for non-root),
    # but avoid duplicating if the slice already begins with that exact heading line.
    out_text = text
    if not section["is_root"]:
        sys.stderr.write(f"[CHUNK {idx}] Non-root section, checking heading\n")
        # Compare the first non-empty line
        first_line = out_text.splitlines()[0] if out_text.splitlines() else ""
        if first_line.strip() != section["heading_line"].strip():
            # Prepend the exact heading line
            sys.stderr.write(
                f"[CHUNK {idx}] Prepending heading: {section['heading_line'][:50]}\n")
            out_text = section["heading_line"] + "\n" + out_text

    sys.stderr.write(f"[CHUNK {idx}] Final text length: {len(out_text)}\n")

    # Generate embedding from the FINAL text (with heading prepended if needed)
    sys.stderr.write(f"[CHUNK {idx}] Calling generate_embedding...\n")
    embedding = generate_embedding(out_text)
    sys.stderr.write(
        f"[CHUNK {idx}] Embedding returned: {len(embedding)} dimensions\n")

    if not embedding:
        sys.stderr.write(f"[CHUNK {idx}] SKIPPING - Empty embedding\n")
        return

    sys.stderr.write(f"[CHUNK {idx}] Wrapping in markdown fence\n")

    sys.stderr.write(f"[CHUNK {idx}] Wrapping in markdown fence\n")
    # Wrap in a markdown fence (balanced)
    body = out_text
    if body.count("```") % 2 != 0:
        body += "\n```"
    body = "```markdown\n" + body.rstrip() + "\n```"

    sys.stderr.write(f"[CHUNK {idx}] Printing output\n")
    print(f"\n[# {idx}]")
    print(f"meta.file: {f}")
    print(f"meta.heading_path: {' > '.join(hp)}")
    print(f"meta.page: {page}")
    print(f"meta.token_count: {token_count}")
    # Format embedding as PostgreSQL vector: [val1,val2,...]
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    print(f"meta.embedding: {embedding_str}")
    print(body)
    sys.stderr.write(f"[CHUNK {idx}] COMPLETE\n")


def main() -> None:
    root = Path("out").resolve()
    md_files = sorted(root.rglob("*.md"))
    if not md_files:
        print("No markdown files found under ./out")
        return

    for f in md_files:
        md_text = read_markdown(f)
        headings = find_headings(md_text)
        sections = build_sections(md_text, headings)
        sections = merge_short_sections(md_text, sections, MIN_CHARS)

        print(f"\n=== {f} ===")
        # Print first 10 chunks
        for i, sec in enumerate(sections[:10], start=1):
            text_slice = slice_text(
                md_text, sec["start_char"], sec["end_char"])
            print_chunk(f, i, sec, text_slice)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        # Handle piping to head/less
        sys.exit(0)
