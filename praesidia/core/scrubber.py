"""
Praesidia PII/PHI Scrubber
Runs fully locally using Microsoft Presidio. Nothing leaves the machine.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine


CONFIDENCE_THRESHOLD = 0.65

# Built-in entity types to detect
ENTITIES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "US_SSN",
    "CREDIT_CARD",
    "MEDICAL_LICENSE",
    "US_PASSPORT",
    "IP_ADDRESS",
    "DATE_TIME",
    "LOCATION",
    "US_BANK_NUMBER",
]


@dataclass
class Finding:
    entity_type: str
    score: float
    text: str
    start: int
    end: int
    line_number: Optional[int] = None
    filename: Optional[str] = None


@dataclass
class ScrubResult:
    detected: List[Finding] = field(default_factory=list)
    scrubbed_text: str = ""


def _build_custom_recognizers() -> List[PatternRecognizer]:
    """Build custom pattern recognizers for API keys and tokens."""
    recognizers = []

    # Generic API key: 32-45 alphanumeric characters
    recognizers.append(PatternRecognizer(
        supported_entity="API_KEY",
        name="generic_api_key_recognizer",
        patterns=[Pattern(
            name="generic_api_key",
            regex=r"(?<![a-zA-Z0-9])[a-zA-Z0-9]{32,45}(?![a-zA-Z0-9])",
            score=0.7,
        )],
        supported_language="en",
    ))

    # Bearer token
    recognizers.append(PatternRecognizer(
        supported_entity="BEARER_TOKEN",
        name="bearer_token_recognizer",
        patterns=[Pattern(
            name="bearer_token",
            regex=r"Bearer\s[a-zA-Z0-9\-._~+/]+=*",
            score=0.9,
        )],
        supported_language="en",
    ))

    # AWS access key
    recognizers.append(PatternRecognizer(
        supported_entity="AWS_KEY",
        name="aws_key_recognizer",
        patterns=[Pattern(
            name="aws_key",
            regex=r"AKIA[0-9A-Z]{16}",
            score=0.99,
        )],
        supported_language="en",
    ))

    # Stripe secret key
    recognizers.append(PatternRecognizer(
        supported_entity="STRIPE_KEY",
        name="stripe_key_recognizer",
        patterns=[Pattern(
            name="stripe_key",
            regex=r"sk_live_[a-zA-Z0-9]{24}",
            score=0.99,
        )],
        supported_language="en",
    ))

    # GitHub personal access token
    recognizers.append(PatternRecognizer(
        supported_entity="GITHUB_TOKEN",
        name="github_token_recognizer",
        patterns=[Pattern(
            name="github_token",
            regex=r"ghp_[a-zA-Z0-9]{36}",
            score=0.99,
        )],
        supported_language="en",
    ))

    return recognizers


def _build_analyzer() -> AnalyzerEngine:
    """Build and configure the Presidio analyzer with custom recognizers."""
    analyzer = AnalyzerEngine()
    for recognizer in _build_custom_recognizers():
        analyzer.registry.add_recognizer(recognizer)
    return analyzer


# Module-level singletons (initialized on first use)
_analyzer: Optional[AnalyzerEngine] = None
_anonymizer: Optional[AnonymizerEngine] = None


def _get_analyzer() -> AnalyzerEngine:
    global _analyzer
    if _analyzer is None:
        _analyzer = _build_analyzer()
    return _analyzer


def _get_anonymizer() -> AnonymizerEngine:
    global _anonymizer
    if _anonymizer is None:
        _anonymizer = AnonymizerEngine()
    return _anonymizer


# All entity types including custom ones
ALL_ENTITIES = ENTITIES + ["API_KEY", "BEARER_TOKEN", "AWS_KEY", "STRIPE_KEY", "GITHUB_TOKEN"]


def scrub(text: str) -> ScrubResult:
    """
    Scrub PII/PHI from text. Runs fully locally.

    Returns ScrubResult with detected findings and scrubbed text
    where PII is replaced with [TYPE] placeholders.
    """
    if not text or not text.strip():
        return ScrubResult(detected=[], scrubbed_text=text)

    analyzer = _get_analyzer()

    results = analyzer.analyze(
        text=text,
        entities=ALL_ENTITIES,
        language="en",
        score_threshold=CONFIDENCE_THRESHOLD,
    )

    findings = []
    for result in results:
        findings.append(Finding(
            entity_type=result.entity_type,
            score=round(result.score, 4),
            text=text[result.start:result.end],
            start=result.start,
            end=result.end,
        ))

    # Sort findings by position (descending) for replacement
    findings.sort(key=lambda f: f.start)

    # Build scrubbed text by replacing PII with [TYPE] tags
    scrubbed = text
    # Replace from end to preserve positions
    for f in sorted(findings, key=lambda f: f.start, reverse=True):
        scrubbed = scrubbed[:f.start] + f"[{f.entity_type}]" + scrubbed[f.end:]

    return ScrubResult(detected=findings, scrubbed_text=scrubbed)


def scrub_diff(diff_text: str) -> ScrubResult:
    """
    Scrub PII/PHI from a git diff. Only scans added lines (+ prefix, not +++).

    Returns ScrubResult with detected findings including line numbers,
    and scrubbed text of only the added lines.
    """
    if not diff_text or not diff_text.strip():
        return ScrubResult(detected=[], scrubbed_text=diff_text)

    lines = diff_text.split("\n")
    added_lines = []
    line_numbers = []
    current_line = 0
    current_file = ""

    for line in lines:
        # Track current file
        if line.startswith("+++ b/"):
            current_file = line[6:]
            continue
        if line.startswith("+++ "):
            current_file = line[4:]
            continue

        # Track line numbers from hunk headers
        if line.startswith("@@"):
            match = re.search(r"\+(\d+)", line)
            if match:
                current_line = int(match.group(1)) - 1
            continue

        # Skip diff metadata lines
        if line.startswith("---") or line.startswith("diff ") or line.startswith("index "):
            continue

        # Count lines in the new file
        if line.startswith("+"):
            current_line += 1
            content = line[1:]  # Strip the + prefix
            added_lines.append(content)
            line_numbers.append((current_line, current_file))
        elif not line.startswith("-"):
            # Context line (no prefix or space prefix)
            current_line += 1

    if not added_lines:
        return ScrubResult(detected=[], scrubbed_text="")

    # Scan all added content together
    added_text = "\n".join(added_lines)
    result = scrub(added_text)

    # Map findings back to line numbers
    char_offset = 0
    line_offsets = []
    for i, line in enumerate(added_lines):
        line_offsets.append(char_offset)
        char_offset += len(line) + 1  # +1 for newline

    for finding in result.detected:
        # Find which line this finding is on
        for i, offset in enumerate(line_offsets):
            next_offset = line_offsets[i + 1] if i + 1 < len(line_offsets) else char_offset
            if offset <= finding.start < next_offset:
                if i < len(line_numbers):
                    finding.line_number = line_numbers[i][0]
                    finding.filename = line_numbers[i][1]
                break

    return result


def redact_preview(text: str) -> str:
    """
    Create a redacted preview showing first 2 and last 2 chars.
    e.g. "john.doe@email.com" -> "jo**************om"
    """
    if len(text) <= 4:
        return "*" * len(text)
    return text[:2] + "*" * (len(text) - 4) + text[-2:]
