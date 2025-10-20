from __future__ import annotations
from openai import AsyncAzureOpenAI
import requests
import argparse
import os
import re
import sys
import json
import io
import base64
import asyncio
import random
import csv
from pathlib import Path
from typing import Dict, List, Tuple

from dotenv import load_dotenv
from PIL import Image
from openai import AsyncAzureOpenAI, APIError

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling_core.types.doc import ImageRefMode

# ─────────────────────────── Azure OpenAI client ───────────────────────────

load_dotenv()

AZURE_OPENAI_ENDPOINT = (os.getenv("AZURE_OPENAI_ENDPOINT") or "").rstrip("/")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_VERSION = os.getenv("AZURE_OPENAI_VERSION")

AZURE_MODEL_FOR_DESCRIPTION = "gpt-5-nano"  # hardcoded

if not (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_VERSION):
    sys.exit("Missing Azure config. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_VERSION.")

aclient = AsyncAzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
)

# ─────────────────────────── CLI ───────────────────────────


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Docling → Markdown; inline CSV tables; Azure (gpt-5-nano) image descriptions in parallel."
    )
    p.add_argument("--in", dest="in_dir", required=True,
                   help="Input folder (e.g., ./data)")
    p.add_argument("--out", dest="out_dir", required=True,
                   help="Output folder (e.g., ./out)")
    p.add_argument(
        "--image-mode", choices=["referenced", "embedded"], default="referenced")
    p.add_argument("--describe-images", action="store_true",
                   help="Replace images/placeholders with full textual descriptions.")
    p.add_argument("--concurrency", type=int, default=10,
                   help="Max concurrent image descriptions.")
    return p.parse_args()

# ─────────────────────────── Conversion ───────────────────────────


def build_converter() -> DocumentConverter:
    # Ensure PDF pipelines actually render figure/page images so artifacts exist for placeholders
    pdf_opts = PdfPipelineOptions()
    pdf_opts.images_scale = 2.0
    pdf_opts.generate_page_images = True
    pdf_opts.generate_picture_images = True
    return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)})


def convert_one(converter: DocumentConverter, in_file: Path, out_root: Path, image_mode: ImageRefMode) -> Path:
    res = converter.convert(in_file)
    doc = res.document
    out_dir = out_root / in_file.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    md_path = out_dir / f"{in_file.stem}.md"
    doc.save_as_markdown(md_path, image_mode=image_mode)
    return md_path


# ─────────────────────────── Tables → fenced CSV blocks (quoted) ───────────────────────────
_PIPE = re.compile(r"^\s*\|.*\|\s*$")
_ALIGN = re.compile(r"^\s*\|?\s*(:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$")


def _split_cells(line: str) -> List[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def _csv_block(rows: List[List[str]]) -> str:
    # Quote ALL fields to be safe with commas; keep comma delimiter
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=",", quotechar='"',
                        quoting=csv.QUOTE_ALL, lineterminator="\n")
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().rstrip("\n")


def convert_pipe_tables_to_csv(md_text: str) -> str:
    lines = md_text.splitlines()
    out: List[str] = []
    i = 0
    in_code = False

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            in_code = not in_code
            out.append(line)
            i += 1
            continue

        if not in_code and i + 1 < len(lines) and _PIPE.match(lines[i]) and _ALIGN.match(lines[i + 1]):
            header = _split_cells(lines[i])
            i += 2
            body: List[List[str]] = []
            while i < len(lines) and _PIPE.match(lines[i]):
                body.append(_split_cells(lines[i]))
                i += 1
            csv_text = _csv_block([header] + body)
            out.append("```csv")
            out.append(csv_text)
            out.append("```")
            continue

        out.append(line)
        i += 1

    return "\n".join(out) + "\n"


# ─────────────────────────── Image discovery + placeholders ───────────────────────────
IMG_MD_RE = re.compile(r"!\[[^\]]*\]\((?!https?://)(?!data:)([^)]+)\)")
PLACEHOLDER_RE = re.compile(r"<!--\s*image\s*-->")


def list_md_images_with_line_numbers(md_path: Path) -> List[Tuple[int, str]]:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    hits: List[Tuple[int, str]] = []
    for i, line in enumerate(lines):
        m = IMG_MD_RE.search(line)
        if m:
            hits.append((i, m.group(1)))
    return hits


def list_placeholders_with_line_numbers(md_path: Path) -> List[int]:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    return [i for i, line in enumerate(lines) if PLACEHOLDER_RE.search(line)]


def guess_pdf_artifact_images(md_path: Path) -> List[Path]:
    stem = md_path.stem
    artifacts_dir = md_path.parent / f"{stem}_artifacts"
    if not artifacts_dir.exists():
        return []
    return sorted([p for p in artifacts_dir.glob("*.png")])


def image_to_png_data_url(path: Path) -> str:
    p = path if path.is_absolute() else path.resolve()
    with Image.open(p) as im:
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return "data:image/png;base64," + b64


FULL_DESCRIPTION_PROMPT = (
    "Produce an ACCESSIBILITY DESCRIPTION for a blind reader. "
    "Return a COMPLETE, FACTUAL description of the image.\n"
    "If it is a CHART or TABLE:\n"
    " - Identify chart type and axes (names, units, scales, ranges).\n"
    " - Decode the legend; list EACH SERIES with key points.\n"
    " - Extract visible VALUES (approximate if needed) for peaks, lows, totals, comparisons.\n"
    " - Summarize trends, correlations, outliers, notable labels/annotations.\n"
    "If it is NOT a chart:\n"
    " - Describe layout, objects, text, colors, positions, relationships.\n"
    "ALWAYS include legible text/OCR (titles, labels) in quotes.\n"
    "Write 8–15 concise sentences. No opinions; no markdown images."
)


async def _describe_one_with_retry(sema: asyncio.Semaphore, idx: int, data_url: str, retries: int = 3) -> Tuple[int, str]:
    delay = 0.8
    for attempt in range(1, retries + 1):
        async with sema:
            try:
                resp = await aclient.chat.completions.create(
                    model=AZURE_MODEL_FOR_DESCRIPTION,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": FULL_DESCRIPTION_PROMPT},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }],
                )
                text = (resp.choices[0].message.content or "").strip()
                if text:
                    return idx, text
                raise RuntimeError("empty description")
            except APIError as e:
                status = getattr(e, "status_code", None)
                if status in (429, 500, 502, 503, 504) and attempt < retries:
                    await asyncio.sleep(delay + random.random() * 0.4)
                    delay *= 2
                    continue
                try:
                    detail = e.response.json()
                except Exception:
                    detail = {"message": str(e)}
                sys.stderr.write(
                    f"[azure error] {status} {json.dumps(detail)[:800]}\n")
                return idx, ""
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(delay + random.random() * 0.4)
                    delay *= 2
                    continue
                sys.stderr.write(f"[caption error] {e}\n")
                return idx, ""
    return idx, ""


async def describe_images_in_parallel(md_path: Path, line_to_imgpath: List[Tuple[int, Path]], concurrency: int) -> Dict[int, Tuple[str, str]]:
    """
    returns: {line_no: (relative_path_str, description_text)}
    """
    sema = asyncio.Semaphore(max(1, concurrency))
    tasks = []
    refs: Dict[int, str] = {}

    for line_no, img_path in line_to_imgpath:
        # prepare relative reference string for the MD
        if img_path.exists():
            rel = img_path if img_path.is_absolute() else img_path.resolve()
            try:
                rel = rel.relative_to(md_path.parent)
            except ValueError:
                # if not under md folder, keep absolute
                rel = rel
            refs[line_no] = rel.as_posix()
            data_url = image_to_png_data_url(img_path)
            tasks.append(asyncio.create_task(
                _describe_one_with_retry(sema, line_no, data_url)))
        else:
            refs[line_no] = ""
            async def _noop(idx=line_no): return (
                idx, "(Image file not found for description.)")
            tasks.append(asyncio.create_task(_noop()))

    out: Dict[int, Tuple[str, str]] = {}
    for t in asyncio.as_completed(tasks):
        try:
            idx, desc = await t
            out[idx] = (refs.get(idx, ""), desc)
        except Exception as e:
            sys.stderr.write(f"[async task error] {e}\n")
    return out


def replace_lines_with_codefenced_descriptions(md_path: Path, line_to_ref_and_desc: Dict[int, Tuple[str, str]]) -> None:
    """
    Replace target lines with:
      ```image description
      reference: "<relpath>"
      <description>
      ```
    """
    lines = md_path.read_text(encoding="utf-8").splitlines()
    out: List[str] = []
    for idx, line in enumerate(lines):
        if idx in line_to_ref_and_desc:
            rel, desc = line_to_ref_and_desc[idx]
            desc = desc.strip() or "(No description returned.)"
            out.append("```image description")
            out.append(f'reference: "{rel}"')
            out.append(desc)
            out.append("```")
        else:
            out.append(line)
    md_path.write_text("\n".join(out) + "\n", encoding="utf-8")

# ─────────────────────────── Orchestration ───────────────────────────


def main() -> None:
    args = parse_args()
    in_dir = Path(args.in_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    files = sorted([p for p in in_dir.iterdir()
                   if p.suffix.lower() in {".pdf", ".docx", ".pptx"}])
    if not files:
        sys.exit(f"No .pdf/.docx/.pptx in {in_dir}")

    image_mode = ImageRefMode.REFERENCED if args.image_mode == "referenced" else ImageRefMode.EMBEDDED
    converter = build_converter()

    for f in files:
        md_path = convert_one(converter, f, out_dir, image_mode)
        print(f"[ok] {f.name} -> {md_path}")

        # 1) Convert pipe tables to inline fenced CSV (quoted fields)
        md_text = md_path.read_text(encoding="utf-8")
        new_md = convert_pipe_tables_to_csv(md_text)
        if new_md != md_text:
            md_path.write_text(new_md, encoding="utf-8")

        # 2) Replace images/placeholders with full descriptions (parallel + retries) → fenced block
        if args.describe_images:
            # Normal Markdown images
            img_hits = list_md_images_with_line_numbers(md_path)
            line_to_imgpath: List[Tuple[int, Path]] = []
            for line_no, rel in img_hits:
                p = Path(rel)
                if not p.is_absolute():
                    p = (md_path.parent / p).resolve()
                line_to_imgpath.append((line_no, p))

            # PDF placeholders: map each <!-- image --> to artifact PNGs by order
            placeholder_lines = list_placeholders_with_line_numbers(md_path)
            if placeholder_lines:
                # Guess artifacts folder and images
                stem = md_path.stem
                artifacts_dir = md_path.parent / f"{stem}_artifacts"
                artifact_imgs = sorted(artifacts_dir.glob(
                    "*.png")) if artifacts_dir.exists() else []
                for i, line_no in enumerate(placeholder_lines):
                    p = artifact_imgs[i] if i < len(
                        artifact_imgs) else Path("/nonexistent.png")
                    line_to_imgpath.append((line_no, p))

            if line_to_imgpath:
                # Dedup by line number, keep first occurrence
                seen = set()
                dedup: List[Tuple[int, Path]] = []
                for ln, p in sorted(line_to_imgpath, key=lambda t: t[0]):
                    if ln in seen:
                        continue
                    seen.add(ln)
                    dedup.append((ln, p))

                line_to_ref_and_desc = asyncio.run(
                    describe_images_in_parallel(md_path, dedup, args.concurrency))
                if line_to_ref_and_desc:
                    replace_lines_with_codefenced_descriptions(
                        md_path, line_to_ref_and_desc)


if __name__ == "__main__":
    main()
