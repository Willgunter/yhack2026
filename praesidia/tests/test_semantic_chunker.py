"""Tests for praesidia.git.semantic_chunker"""

import pytest
from praesidia.git.semantic_chunker import (
    triage, extract_semantic_changes, summarize_changes, build_k2_context,
    RiskLevel, TriageResult,
)
from praesidia.git.diff_parser import ParsedFile
from praesidia.core.scrubber import Finding


def _make_file(filename, extension=".py", added_lines=None, removed_lines=None):
    pf = ParsedFile(
        filename=filename,
        file_type="python",
        extension=extension,
        added_lines=added_lines or ["line1", "line2"],
        removed_lines=removed_lines or [],
    )
    pf.line_count_added = len(pf.added_lines)
    return pf


class TestTriage:
    def test_auth_file_is_high_risk(self):
        files = [_make_file("auth_handler.py")]
        result = triage(files, [])
        assert len(result.high_risk) == 1
        assert len(result.low_risk) == 0
        assert "auth" in result.risk_reasons["auth_handler.py"][0]

    def test_env_extension_is_high_risk(self):
        files = [_make_file("production.env", extension=".env")]
        result = triage(files, [])
        assert len(result.high_risk) == 1

    def test_clean_file_is_low_risk(self):
        files = [_make_file("utils.py")]
        result = triage(files, [])
        assert len(result.low_risk) == 1
        assert len(result.high_risk) == 0

    def test_presidio_flagged_file_is_high_risk(self):
        files = [_make_file("readme.py")]
        findings = [Finding(entity_type="EMAIL_ADDRESS", score=0.9, text="a@b.com", start=0, end=7, filename="readme.py")]
        result = triage(files, findings)
        assert len(result.high_risk) == 1
        assert "PII detected" in result.risk_reasons["readme.py"][0]

    def test_mixed_files(self):
        files = [
            _make_file("auth.py"),
            _make_file("utils.py"),
            _make_file("config.json", extension=".json"),
        ]
        result = triage(files, [])
        assert len(result.high_risk) == 2  # auth.py and config.json
        assert len(result.low_risk) == 1   # utils.py


class TestExtractSemanticChanges:
    def test_extracts_high_risk_details(self):
        files = [_make_file("user_model.py", added_lines=["email = 'test@test.com'", "name = 'John'"])]
        reasons = {"user_model.py": ["filename contains 'user'"]}
        changes = extract_semantic_changes(files, reasons)
        assert len(changes) == 1
        assert changes[0]["file"] == "user_model.py"
        assert changes[0]["risk_level"] == "HIGH"
        assert changes[0]["line_count"] == 2

    def test_caps_at_50_lines(self):
        lines = [f"line_{i}" for i in range(100)]
        files = [_make_file("auth.py", added_lines=lines)]
        changes = extract_semantic_changes(files)
        assert len(changes[0]["added_lines"]) == 50


class TestSummarizeChanges:
    def test_summarize_added(self):
        files = [_make_file("new_file.py", added_lines=["a", "b", "c"], removed_lines=[])]
        summary = summarize_changes(files)
        assert "Adds to new_file.py" in summary
        assert "+3/-0" in summary

    def test_summarize_modified(self):
        files = [_make_file("old_file.py", added_lines=["new"], removed_lines=["old"])]
        summary = summarize_changes(files)
        assert "Modifies old_file.py" in summary

    def test_summarize_empty(self):
        assert summarize_changes([]) == ""

    def test_summarize_multiple(self):
        files = [_make_file("a.py"), _make_file("b.py")]
        summary = summarize_changes(files)
        assert "a.py" in summary
        assert "b.py" in summary
        assert ";" in summary


class TestBuildK2Context:
    def test_builds_context_string(self):
        changes = [{"file": "auth.py", "risk_reasons": ["contains auth"], "line_count": 5, "added_lines": ["pass"]}]
        ctx = build_k2_context(changes, "fix auth bug")
        assert "COMMIT MESSAGE: fix auth bug" in ctx
        assert "auth.py" in ctx
        assert "contains auth" in ctx
