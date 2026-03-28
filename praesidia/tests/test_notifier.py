"""Tests for praesidia.core.notifier"""

import os
import tempfile
import pytest
from praesidia.core.notifier import (
    notify_violation, ViolationEvent, _print_notification,
)
from praesidia.core.user_registry import seed_demo_data, DEMO_IDS


@pytest.fixture
def temp_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    seed_demo_data(db_path=path)
    yield path
    os.unlink(path)


@pytest.fixture
def sample_event():
    return ViolationEvent(
        source="github",
        pii_types=["EMAIL_ADDRESS", "US_SSN"],
        audit_id="test-audit-123",
        timestamp="2026-03-28T14:32:00Z",
        detail="Test violation event",
    )


class TestNotifyViolation:
    def test_resolves_known_user(self, temp_db, sample_event):
        results = notify_violation(
            sample_event,
            email="alice@acme.com",
            db_path=temp_db,
        )
        assert results["resolved"] is True

    def test_unresolved_user_returns_false(self, temp_db, sample_event):
        results = notify_violation(
            sample_event,
            email="nobody@unknown.com",
            db_path=temp_db,
        )
        assert results["resolved"] is False

    def test_sms_fallback_without_twilio(self, temp_db, sample_event, capsys):
        """Without Twilio credentials, SMS should fall back to console."""
        # Ensure no Twilio env vars
        old_sid = os.environ.pop("TWILIO_ACCOUNT_SID", None)
        try:
            results = notify_violation(
                sample_event,
                email="alice@acme.com",
                db_path=temp_db,
            )
            captured = capsys.readouterr()
            # Should print console fallback
            assert "PRAESIDIA NOTIFICATION" in captured.out
            assert "SMS" in captured.out
        finally:
            if old_sid:
                os.environ["TWILIO_ACCOUNT_SID"] = old_sid

    def test_desktop_only_for_github(self, temp_db):
        slack_event = ViolationEvent(source="slack", pii_types=["PERSON"])
        results = notify_violation(
            slack_event,
            email="alice@acme.com",
            db_path=temp_db,
        )
        # Desktop notification should not fire for non-github sources
        assert "desktop" not in results

    def test_github_includes_desktop(self, temp_db, sample_event):
        results = notify_violation(
            sample_event,
            email="alice@acme.com",
            db_path=temp_db,
        )
        # Should attempt desktop notification for github source
        assert "desktop" in results

    def test_manager_notification(self, temp_db, sample_event):
        results = notify_violation(
            sample_event,
            email="alice@acme.com",
            db_path=temp_db,
        )
        # Alice reports to Bob, so manager SMS should be attempted
        assert "sms_manager" in results


class TestViolationEvent:
    def test_default_values(self):
        event = ViolationEvent(source="slack")
        assert event.source == "slack"
        assert event.pii_types == []
        assert event.audit_id == ""
        assert event.detail == ""

    def test_with_all_fields(self):
        event = ViolationEvent(
            source="github",
            pii_types=["EMAIL_ADDRESS"],
            audit_id="abc123",
            timestamp="2026-03-28T12:00:00Z",
            detail="Test detail",
        )
        assert event.source == "github"
        assert len(event.pii_types) == 1


class TestPrintNotification:
    def test_prints_formatted_output(self, capsys):
        event = ViolationEvent(
            source="slack",
            pii_types=["PERSON", "EMAIL_ADDRESS"],
            timestamp="2026-03-28T14:00:00Z",
        )
        _print_notification(
            channel="TEST",
            recipient="Test User",
            event=event,
            note="This is a test",
        )
        captured = capsys.readouterr()
        assert "PRAESIDIA NOTIFICATION" in captured.out
        assert "TEST" in captured.out
        assert "Test User" in captured.out
        assert "slack" in captured.out
