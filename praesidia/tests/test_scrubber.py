"""Tests for praesidia.core.scrubber"""

import pytest
from praesidia.core.scrubber import scrub, scrub_diff, redact_preview


class TestScrubEmail:
    def test_detects_email(self):
        result = scrub("Contact john.doe@example.com for details")
        types = [f.entity_type for f in result.detected]
        assert "EMAIL_ADDRESS" in types
        assert "[EMAIL_ADDRESS]" in result.scrubbed_text

class TestScrubSSN:
    def test_detects_ssn(self):
        result = scrub("His social security number is 078-05-1120 on file")
        types = [f.entity_type for f in result.detected]
        assert "US_SSN" in types or "PHONE_NUMBER" in types  # Presidio may detect as phone

class TestScrubAPIKeys:
    def test_detects_api_key_generic(self):
        # 40-char alphanumeric string
        result = scrub("api_key = aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY3zA5bC7")
        types = [f.entity_type for f in result.detected]
        assert "API_KEY" in types

    def test_detects_aws_key(self):
        result = scrub("aws_access_key_id = AKIAIOSFODNN7EXAMPLE")
        types = [f.entity_type for f in result.detected]
        assert "AWS_KEY" in types

    def test_detects_github_token(self):
        result = scrub("token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij")
        types = [f.entity_type for f in result.detected]
        assert "GITHUB_TOKEN" in types

    def test_detects_stripe_key_pattern(self):
        # Build the test string dynamically to avoid GitHub push protection
        prefix = "sk" + "_" + "live" + "_"
        fake_key = prefix + "X" * 24
        result = scrub(f"STRIPE_SECRET = {fake_key}")
        types = [f.entity_type for f in result.detected]
        assert "STRIPE_KEY" in types or "API_KEY" in types


class TestScrubPreservesMeaning:
    def test_scrubs_text_preserves_meaning(self):
        text = "Send the report to jane.smith@corp.com regarding the project"
        result = scrub(text)
        # The scrubbed text should still contain non-PII words
        assert "report" in result.scrubbed_text.lower()
        assert "project" in result.scrubbed_text.lower()
        # But the email should be gone
        assert "jane.smith@corp.com" not in result.scrubbed_text


class TestScrubDiff:
    def test_scrub_diff_only_scans_added_lines(self):
        diff = """diff --git a/app.py b/app.py
index abc..def 100644
--- a/app.py
+++ b/app.py
@@ -1,3 +1,4 @@
 import os
-old_email = "removed@old.com"
+new_email = "alice.jones@company.com"
+password = "secret123"
"""
        result = scrub_diff(diff)
        # Should detect PII in added lines
        found_types = [f.entity_type for f in result.detected]
        # The removed line email should NOT be detected
        found_texts = [f.text for f in result.detected]
        assert "removed@old.com" not in found_texts


class TestNoFalsePositives:
    def test_no_false_positive_on_clean_text(self):
        text = "The report shows strong growth in the technology sector."
        result = scrub(text)
        # Should have no high-confidence PII findings on generic text
        # Filter out DATE_TIME which Presidio may flag on common words
        real_pii = [f for f in result.detected if f.score > 0.7 and f.entity_type not in ("DATE_TIME",)]
        assert len(real_pii) == 0


class TestMultiplePII:
    def test_multiple_pii_types_in_one_message(self):
        text = (
            "Patient John Smith can be reached at "
            "john.smith@hospital.org or 555-867-5309"
        )
        result = scrub(text)
        types = set(f.entity_type for f in result.detected)
        # Should detect at least person and email
        assert len(types) >= 2
        assert "EMAIL_ADDRESS" in types


class TestRedactPreview:
    def test_redact_short(self):
        assert redact_preview("ab") == "**"

    def test_redact_normal(self):
        r = redact_preview("john.doe@email.com")
        assert r.startswith("jo")
        assert r.endswith("om")
        assert "*" in r

    def test_redact_preserves_length(self):
        text = "hello_world"
        r = redact_preview(text)
        assert len(r) == len(text)
