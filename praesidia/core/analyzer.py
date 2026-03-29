"""
Praesidia Code Analyzer
Local heuristic commit accuracy checker + K2 Think V2 legal/policy analysis.
"""

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AccuracyResult:
    score: int  # 0-100
    reasons: List[str] = field(default_factory=list)


@dataclass
class Violation:
    regulation: str
    confidence: float
    description: str
    suggested_fix: str = ""


@dataclass
class K2Result:
    violations: List[Violation] = field(default_factory=list)
    commit_accuracy_score: int = 0
    commit_accuracy_reasons: List[str] = field(default_factory=list)
    raw_response: str = ""


# Vague commit message patterns
VAGUE_PATTERNS = [
    r"^(update|updates|updated)s?$",
    r"^(fix|fixes|fixed)$",
    r"^(change|changes|changed)s?$",
    r"^misc\.?$",
    r"^(minor|small)\s*(update|change|fix|tweak)?s?\.?$",
    r"^wip\.?$",
    r"^(stuff|things)\.?$",
    r"^(test|testing)\.?$",
    r"^(refactor|cleanup|clean up)\.?$",
    r"^\.+$",
    r"^-+$",
    r"^initial commit\.?$",
    r"^save\.?$",
    r"^commit\.?$",
]

# Keywords that map to code areas
AREA_KEYWORDS = {
    "auth": ["auth", "login", "session", "token", "password", "credential", "oauth"],
    "payment": ["payment", "billing", "price", "charge", "invoice", "stripe", "card"],
    "user": ["user", "profile", "account", "registration", "signup"],
    "data": ["database", "migration", "schema", "model", "query", "sql"],
    "api": ["endpoint", "route", "controller", "handler", "api", "rest"],
    "config": ["config", "env", "settings", "environment", "secret"],
    "security": ["permission", "role", "access", "encrypt", "cert", "key", "private"],
    "medical": ["patient", "health", "medical", "hipaa", "diagnosis", "prescription"],
}


def check_commit_accuracy(
    commit_message: str,
    semantic_changes: List[Dict[str, Any]],
    total_files_changed: int = 0,
    total_lines_added: int = 0,
) -> AccuracyResult:
    """
    Local heuristic check: does the commit message accurately describe the changes?
    No API call — runs instantly.

    Returns AccuracyResult with score (0-100) and list of reasons.
    """
    if not commit_message or not commit_message.strip():
        return AccuracyResult(score=0, reasons=["Commit message is empty"])

    msg = commit_message.strip().lower()
    reasons = []
    score = 100  # Start perfect, deduct for issues

    # --- Check 1: Is the message too vague? ---
    for pattern in VAGUE_PATTERNS:
        if re.match(pattern, msg, re.IGNORECASE):
            score -= 50
            reasons.append(f"Commit message is vague: '{commit_message.strip()}'")
            break

    # --- Check 2: Message length vs change size ---
    msg_words = len(commit_message.split())
    if msg_words < 3 and total_files_changed > 2:
        score -= 20
        reasons.append(
            f"Message is only {msg_words} words but {total_files_changed} files changed"
        )

    if msg_words < 3 and total_lines_added > 20:
        score -= 15
        reasons.append(
            f"Message is only {msg_words} words but {total_lines_added}+ lines added"
        )

    # --- Check 3: "minor"/"small" claims vs actual scope ---
    if any(w in msg for w in ["minor", "small", "tiny", "little", "trivial"]):
        if total_files_changed > 3:
            score -= 25
            reasons.append(
                f"Message says 'minor' but {total_files_changed} files changed"
            )
        if total_lines_added > 30:
            score -= 20
            reasons.append(
                f"Message says 'minor' but {total_lines_added}+ lines added"
            )
        if len(semantic_changes) > 0:
            score -= 15
            reasons.append(
                f"Message says 'minor' but {len(semantic_changes)} high-risk files modified"
            )

    # --- Check 4: "typo"/"docs" claims but code files changed ---
    if any(w in msg for w in ["typo", "typos", "docs", "readme", "comment", "whitespace"]):
        code_extensions = {".py", ".js", ".ts", ".java", ".go", ".rs", ".rb", ".c", ".cpp"}
        code_files_changed = [
            c for c in semantic_changes
            if c.get("extension", "") in code_extensions
        ]
        if code_files_changed:
            score -= 30
            files_list = ", ".join(c["file"] for c in code_files_changed[:3])
            reasons.append(
                f"Message says 'typo/docs' but code files modified: {files_list}"
            )

    # --- Check 5: High-risk files not mentioned in message ---
    changed_areas = set()
    for change in semantic_changes:
        filename = change.get("file", "").lower()
        for area, keywords in AREA_KEYWORDS.items():
            if any(kw in filename for kw in keywords):
                changed_areas.add(area)

    mentioned_areas = set()
    for area, keywords in AREA_KEYWORDS.items():
        if any(kw in msg for kw in keywords):
            mentioned_areas.add(area)

    unmentioned = changed_areas - mentioned_areas
    if unmentioned and len(changed_areas) > 0:
        score -= min(20, len(unmentioned) * 10)
        areas_str = ", ".join(unmentioned)
        reasons.append(
            f"High-risk areas modified but not mentioned in message: {areas_str}"
        )

    # Clamp score
    score = max(0, min(100, score))

    return AccuracyResult(score=score, reasons=reasons)


def analyze_with_k2(
    scrubbed_context: str,
    commit_message: str = "",
    org_policies: str = "",
    semantic_changes: Optional[List[Dict[str, Any]]] = None,
) -> K2Result:
    """
    Run legal/policy analysis via K2 Think V2 on Cerebras Inference.
    OpenAI-compatible API.

    Falls back to console output + mock result if no API key.
    """
    api_key = os.environ.get("CEREBRAS_API_KEY", "")
    model = os.environ.get("K2_MODEL", "k2-think-v2")

    # Fetch organisational memory from Mem0
    mem0_context = ""
    mem0_key = os.environ.get("MEM0_API_KEY", "")
    if mem0_key:
        try:
            import urllib.request as _req
            import json as _json
            mem_req = _req.Request(
                "https://api.mem0.ai/v1/memories/search/",
                data=_json.dumps({"query": scrubbed_context[:200], "limit": 5}).encode(),
                headers={
                    "Authorization": f"Token {mem0_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with _req.urlopen(mem_req, timeout=8) as r:
                memories = _json.loads(r.read())
                if memories:
                    mem_lines = [m.get("memory", "") for m in memories if m.get("memory")]
                    mem0_context = "\n".join(mem_lines)
                    print(f"[Mem0] Retrieved {len(mem_lines)} memories for context")
        except Exception as mem_err:
            print(f"[Mem0] Could not retrieve memories: {mem_err}")

    # Build the analysis prompt
    prompt = _build_k2_prompt(scrubbed_context, commit_message, org_policies or mem0_context, semantic_changes)

    if not api_key:
        # Console fallback for demo
        print("\n" + "=" * 60)
        print("  K2 THINK V2 ANALYSIS (API key not configured)")
        print("=" * 60)
        print("  Would send the following prompt to K2:")
        print(f"  Model: {model}")
        print(f"  Context length: {len(prompt)} chars")
        print("  ---")
        # Print first 500 chars of prompt
        for line in prompt[:500].split("\n"):
            print(f"  {line}")
        if len(prompt) > 500:
            print(f"  ... ({len(prompt) - 500} more chars)")
        print("=" * 60 + "\n")

        # Return mock result for demo
        return K2Result(
            violations=[
                Violation(
                    regulation="GDPR Art. 5(1)(f)",
                    confidence=0.85,
                    description="Hardcoded personal data in source code violates data minimization and integrity principles",
                    suggested_fix="Move personal data to environment variables or a secure vault",
                ),
            ],
            commit_accuracy_score=35,
            commit_accuracy_reasons=["Commit message does not describe data handling changes"],
            raw_response="[MOCK] K2 API key not configured — showing demo result",
        )

    # Real K2 API call via Cerebras OpenAI-compatible endpoint
    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://api.cerebras.ai/v1",
            api_key=api_key,
        )

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a compliance analysis AI. Analyze code changes for legal and "
                        "policy violations. Respond in JSON format with keys: violations (array "
                        "of {regulation, confidence, description, suggested_fix}), "
                        "commit_accuracy_score (0-100), commit_accuracy_reasons (array of strings)."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=2000,
        )

        raw = response.choices[0].message.content or ""
        return _parse_k2_response(raw)

    except Exception as e:
        print(f"[K2] Error calling Cerebras API: {e}")
        return K2Result(
            raw_response=f"Error: {e}",
            commit_accuracy_score=50,
            commit_accuracy_reasons=["K2 analysis failed — manual review recommended"],
        )


def _build_k2_prompt(
    scrubbed_context: str,
    commit_message: str,
    org_policies: str,
    semantic_changes: Optional[List[Dict[str, Any]]],
) -> str:
    """Build the analysis prompt for K2."""
    parts = []

    parts.append("TASK: Analyze the following code changes for compliance violations.\n")

    if commit_message:
        parts.append(f"COMMIT MESSAGE: \"{commit_message}\"\n")

    if org_policies:
        parts.append("ORGANIZATION POLICIES:")
        parts.append(org_policies)
        parts.append("")

    if semantic_changes:
        parts.append("CODE CHANGES:")
        for i, change in enumerate(semantic_changes, 1):
            parts.append(f"\n--- File {i}: {change.get('file', 'unknown')} ---")
            parts.append(f"Risk reasons: {', '.join(change.get('risk_reasons', []))}")
            parts.append(f"Lines added: {change.get('line_count', 0)}")
            added = change.get("added_lines", [])
            if added:
                parts.append("Content (excerpt):")
                for line in added[:30]:
                    parts.append(f"  {line}")

    if scrubbed_context:
        parts.append("\nSCRUBBED CONTENT (PII replaced with [TYPE] tags):")
        parts.append(scrubbed_context)

    parts.append("\nANALYZE FOR:")
    parts.append("1. Data handling violations (GDPR, HIPAA, CCPA)")
    parts.append("2. Access control / authentication issues")
    parts.append("3. Company policy conflicts")
    parts.append("4. Financial regulation issues (SEC, SOX)")
    parts.append("5. Commit message accuracy vs actual changes")
    parts.append("\nRespond in JSON format.")

    return "\n".join(parts)


def _parse_k2_response(raw: str) -> K2Result:
    """Parse K2's JSON response into a K2Result."""
    try:
        # Try to extract JSON from response (may have markdown fences)
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(raw)

        violations = []
        for v in data.get("violations", []):
            violations.append(Violation(
                regulation=v.get("regulation", "Unknown"),
                confidence=float(v.get("confidence", 0.5)),
                description=v.get("description", ""),
                suggested_fix=v.get("suggested_fix", ""),
            ))

        return K2Result(
            violations=violations,
            commit_accuracy_score=int(data.get("commit_accuracy_score", 50)),
            commit_accuracy_reasons=data.get("commit_accuracy_reasons", []),
            raw_response=raw,
        )
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        return K2Result(
            raw_response=raw,
            commit_accuracy_score=50,
            commit_accuracy_reasons=[f"Could not parse K2 response: {e}"],
        )
