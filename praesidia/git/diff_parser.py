"""
Praesidia Git Diff Parser
Parses raw git diff output into structured objects.
"""

import os
import re
import subprocess
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Chunk:
    header: str
    added_lines: List[str] = field(default_factory=list)
    context_lines: List[str] = field(default_factory=list)
    start_line: int = 0


@dataclass
class ParsedFile:
    filename: str
    file_type: str
    extension: str
    added_lines: List[str] = field(default_factory=list)
    removed_lines: List[str] = field(default_factory=list)
    chunks: List[Chunk] = field(default_factory=list)
    line_count_added: int = 0


def _get_extension(filename: str) -> str:
    _, ext = os.path.splitext(filename)
    return ext.lower()


def _get_file_type(extension: str) -> str:
    type_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".jsx": "javascript",
        ".tsx": "typescript",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".rb": "ruby",
        ".php": "php",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "header",
        ".cs": "csharp",
        ".swift": "swift",
        ".kt": "kotlin",
        ".json": "config",
        ".yaml": "config",
        ".yml": "config",
        ".toml": "config",
        ".xml": "config",
        ".env": "env",
        ".config": "config",
        ".ini": "config",
        ".cfg": "config",
        ".sh": "shell",
        ".bash": "shell",
        ".sql": "sql",
        ".html": "html",
        ".css": "css",
        ".md": "markdown",
        ".txt": "text",
        ".pem": "certificate",
        ".key": "key",
        ".cert": "certificate",
        ".p12": "certificate",
    }
    return type_map.get(extension, "unknown")


def parse_diff(diff_text: str) -> List[ParsedFile]:
    """
    Parse raw git diff output into a list of ParsedFile objects.
    Only added lines matter (+ prefix, not +++).
    """
    if not diff_text or not diff_text.strip():
        return []

    files = []
    current_file: Optional[ParsedFile] = None
    current_chunk: Optional[Chunk] = None

    for line in diff_text.split("\n"):
        # New file in diff
        if line.startswith("diff --git"):
            # Save previous file
            if current_file is not None:
                if current_chunk is not None:
                    current_file.chunks.append(current_chunk)
                current_file.line_count_added = len(current_file.added_lines)
                files.append(current_file)

            # Extract filename from "diff --git a/file b/file"
            match = re.search(r"b/(.+)$", line)
            filename = match.group(1) if match else "unknown"
            ext = _get_extension(filename)

            current_file = ParsedFile(
                filename=filename,
                file_type=_get_file_type(ext),
                extension=ext,
            )
            current_chunk = None
            continue

        # Skip metadata lines
        if line.startswith("index ") or line.startswith("---"):
            continue

        # New file path (use +++ for the actual name)
        if line.startswith("+++ b/"):
            if current_file is not None:
                current_file.filename = line[6:]
                ext = _get_extension(current_file.filename)
                current_file.extension = ext
                current_file.file_type = _get_file_type(ext)
            continue
        if line.startswith("+++ "):
            continue

        # Hunk header
        if line.startswith("@@"):
            if current_chunk is not None and current_file is not None:
                current_file.chunks.append(current_chunk)

            start_line = 0
            match = re.search(r"\+(\d+)", line)
            if match:
                start_line = int(match.group(1))

            current_chunk = Chunk(header=line, start_line=start_line)
            continue

        # Added line
        if line.startswith("+") and current_file is not None:
            content = line[1:]
            current_file.added_lines.append(content)
            if current_chunk is not None:
                current_chunk.added_lines.append(content)
            continue

        # Removed line
        if line.startswith("-") and current_file is not None:
            current_file.removed_lines.append(line[1:])
            continue

        # Context line
        if current_chunk is not None:
            current_chunk.context_lines.append(line)

    # Don't forget the last file
    if current_file is not None:
        if current_chunk is not None:
            current_file.chunks.append(current_chunk)
        current_file.line_count_added = len(current_file.added_lines)
        files.append(current_file)

    return files


def get_staged_diff() -> str:
    """Run git diff --staged and return the output string."""
    try:
        result = subprocess.run(
            ["git", "diff", "--staged"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def get_added_content(parsed_files: List[ParsedFile]) -> str:
    """Return a flat string of all added lines for Presidio scanning."""
    lines = []
    for pf in parsed_files:
        lines.extend(pf.added_lines)
    return "\n".join(lines)


def get_commit_message() -> str:
    """Get the commit message being used (from COMMIT_EDITMSG or args)."""
    # Try reading from the git commit message file
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        git_dir = result.stdout.strip()
        msg_file = os.path.join(git_dir, "COMMIT_EDITMSG")
        if os.path.exists(msg_file):
            with open(msg_file, "r") as f:
                return f.read().strip()
    except Exception:
        pass
    return ""
