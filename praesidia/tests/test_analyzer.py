"""Tests for praesidia.core.analyzer"""

import pytest
from praesidia.core.analyzer import check_commit_accuracy, AccuracyResult


class TestVagueMessages:
    def test_empty_message_scores_zero(self):
        result = check_commit_accuracy("", [], total_files_changed=1)
        assert result.score == 0
        assert "empty" in result.reasons[0].lower()

    def test_vague_update(self):
        result = check_commit_accuracy("updates", [{"file": "auth.py", "risk_reasons": [], "extension": ".py"}], total_files_changed=3)
        assert result.score < 50

    def test_vague_fix(self):
        result = check_commit_accuracy("fix", [{"file": "user.py", "risk_reasons": [], "extension": ".py"}], total_files_changed=2)
        assert result.score < 50

    def test_wip_is_vague(self):
        result = check_commit_accuracy("wip", [], total_files_changed=5)
        assert result.score < 60


class TestMinorClaims:
    def test_minor_with_many_files(self):
        changes = [{"file": f"file{i}.py", "risk_reasons": [], "extension": ".py"} for i in range(4)]
        result = check_commit_accuracy("minor update", changes, total_files_changed=8, total_lines_added=100)
        assert result.score < 40
        assert any("minor" in r.lower() for r in result.reasons)

    def test_minor_with_few_files_ok(self):
        result = check_commit_accuracy("minor fix to readme", [], total_files_changed=1, total_lines_added=2)
        assert result.score >= 70


class TestTypoClaims:
    def test_typo_but_code_changed(self):
        changes = [{"file": "auth_handler.py", "risk_reasons": ["filename contains 'auth'"], "extension": ".py"}]
        result = check_commit_accuracy("fix typo", changes, total_files_changed=1)
        assert result.score < 70
        assert any("typo" in r.lower() or "code files" in r.lower() for r in result.reasons)


class TestUnmentionedAreas:
    def test_auth_changes_not_mentioned(self):
        changes = [{"file": "auth_middleware.py", "risk_reasons": [], "extension": ".py"}]
        result = check_commit_accuracy("update styles", changes, total_files_changed=2)
        # Auth area modified but "styles" doesn't mention auth
        assert result.score < 100
        assert any("auth" in r.lower() or "not mentioned" in r.lower() for r in result.reasons)

    def test_payment_changes_not_mentioned(self):
        changes = [{"file": "billing_service.py", "risk_reasons": [], "extension": ".py"}]
        result = check_commit_accuracy("refactor utils", changes, total_files_changed=2)
        assert any("payment" in r.lower() for r in result.reasons)


class TestGoodMessages:
    def test_descriptive_message_scores_high(self):
        changes = [{"file": "user_handler.py", "risk_reasons": [], "extension": ".py"}]
        result = check_commit_accuracy(
            "Add email validation to user registration handler",
            changes, total_files_changed=1, total_lines_added=15
        )
        assert result.score >= 70

    def test_specific_message_with_area(self):
        changes = [{"file": "auth.py", "risk_reasons": [], "extension": ".py"}]
        result = check_commit_accuracy(
            "Fix auth token expiration check in login flow",
            changes, total_files_changed=1, total_lines_added=5
        )
        assert result.score >= 80


class TestShortMessages:
    def test_short_msg_many_files(self):
        result = check_commit_accuracy("ok", [], total_files_changed=5, total_lines_added=50)
        assert result.score < 70  # Short message with many files should lose points
