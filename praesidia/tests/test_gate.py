"""Tests for praesidia.core.gate"""

import os
import tempfile
import pytest
from praesidia.core.gate import (
    requires_approval, process_decision, build_person3_payload, Decision
)
from praesidia.core.scrubber import Finding


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.fixture
def sample_findings():
    return [
        Finding(entity_type="EMAIL_ADDRESS", score=0.95, text="test@example.com", start=0, end=16),
        Finding(entity_type="PERSON", score=0.85, text="John Smith", start=20, end=30),
    ]


@pytest.fixture
def low_confidence_findings():
    return [
        Finding(entity_type="DATE_TIME", score=0.5, text="next Friday", start=0, end=11),
    ]


class TestRequiresApproval:
    def test_high_confidence_requires_approval(self, sample_findings):
        assert requires_approval(sample_findings) is True

    def test_low_confidence_no_approval(self, low_confidence_findings):
        assert requires_approval(low_confidence_findings) is False

    def test_empty_findings_no_approval(self):
        assert requires_approval([]) is False


class TestProcessDecision:
    def test_approved_decision(self, sample_findings, temp_db):
        result = process_decision(
            decision="APPROVED",
            user="dev1",
            findings=sample_findings,
            original="Contact test@example.com for John Smith",
            source="github",
            manager="mgr1",
            db_path=temp_db,
        )
        assert result.decision == Decision.APPROVED
        assert result.user == "dev1"
        assert result.source == "github"
        assert result.original_hash  # Should be a SHA256 hash
        assert len(result.original_hash) == 64
        assert result.audit_id

    def test_cancelled_decision(self, sample_findings, temp_db):
        result = process_decision(
            decision="CANCELLED",
            user="dev1",
            findings=sample_findings,
            original="some content",
            source="slack",
            db_path=temp_db,
        )
        assert result.decision == Decision.CANCELLED

    def test_edit_decision(self, sample_findings, temp_db):
        result = process_decision(
            decision="EDIT",
            user="dev1",
            findings=sample_findings,
            original="some content",
            source="teams",
            db_path=temp_db,
        )
        assert result.decision == Decision.EDIT

    def test_never_stores_raw_pii(self, sample_findings, temp_db):
        result = process_decision(
            decision="APPROVED",
            user="dev1",
            findings=sample_findings,
            original="test@example.com",
            source="github",
            db_path=temp_db,
        )
        # The hash should NOT be the raw text
        assert result.original_hash != "test@example.com"
        assert len(result.original_hash) == 64


class TestBuildPerson3Payload:
    def test_payload_structure(self, sample_findings, temp_db):
        gate_result = process_decision(
            decision="APPROVED",
            user="dev1",
            findings=sample_findings,
            original="test content",
            source="slack",
            manager="mgr1",
            db_path=temp_db,
        )
        payload = build_person3_payload(gate_result, "scrubbed [EMAIL_ADDRESS] for [PERSON]")

        assert payload["source"] == "slack"
        assert payload["author"] == "dev1"
        assert payload["manager"] == "mgr1"
        assert payload["human_approved"] is True
        assert "EMAIL_ADDRESS" in payload["pii_detected"]
        assert len(payload["pii_findings"]) == 2
        assert payload["audit_id"] == gate_result.audit_id

    def test_payload_redacts_text(self, sample_findings, temp_db):
        gate_result = process_decision(
            decision="APPROVED",
            user="dev1",
            findings=sample_findings,
            original="test",
            source="github",
            db_path=temp_db,
        )
        payload = build_person3_payload(gate_result, "scrubbed")
        for pf in payload["pii_findings"]:
            # Redacted text should have asterisks
            assert "*" in pf["redacted_text"]
