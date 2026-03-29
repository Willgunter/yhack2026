"""Tests for praesidia.git.diff_parser"""

import pytest
from praesidia.git.diff_parser import parse_diff, get_added_content


SINGLE_FILE_DIFF = """diff --git a/app.py b/app.py
index 1234567..abcdefg 100644
--- a/app.py
+++ b/app.py
@@ -10,6 +10,8 @@ def main():
     print("hello")
+    email = "test@example.com"
+    api_key = "sk_live_abc123"
     return True
"""

MULTI_FILE_DIFF = """diff --git a/config.py b/config.py
index aaa..bbb 100644
--- a/config.py
+++ b/config.py
@@ -1,3 +1,5 @@
 DB_HOST = "localhost"
+DB_PASSWORD = "super_secret"
+DB_PORT = 5432
 DB_NAME = "myapp"
diff --git a/handler.py b/handler.py
index ccc..ddd 100644
--- a/handler.py
+++ b/handler.py
@@ -5,4 +5,6 @@ class UserHandler:
     def get(self, user_id):
-        return None
+        user = db.query(user_id)
+        return user.to_dict()
"""

EMPTY_DIFF = ""

REMOVAL_ONLY_DIFF = """diff --git a/old.py b/old.py
index eee..fff 100644
--- a/old.py
+++ b/old.py
@@ -1,4 +1,2 @@
 import os
-import sys
-import json
 print("done")
"""


class TestParseSingleFileDiff:
    def test_parses_single_file_diff(self):
        files = parse_diff(SINGLE_FILE_DIFF)
        assert len(files) == 1
        assert files[0].filename == "app.py"
        assert files[0].line_count_added == 2

    def test_added_lines_content(self):
        files = parse_diff(SINGLE_FILE_DIFF)
        added = files[0].added_lines
        assert any("email" in line for line in added)
        assert any("api_key" in line for line in added)


class TestParseMultiFileDiff:
    def test_parses_multi_file_diff(self):
        files = parse_diff(MULTI_FILE_DIFF)
        assert len(files) == 2
        filenames = [f.filename for f in files]
        assert "config.py" in filenames
        assert "handler.py" in filenames

    def test_correct_line_counts(self):
        files = parse_diff(MULTI_FILE_DIFF)
        config = next(f for f in files if f.filename == "config.py")
        handler = next(f for f in files if f.filename == "handler.py")
        assert config.line_count_added == 2
        assert handler.line_count_added == 2


class TestOnlyReturnsAddedLines:
    def test_only_returns_added_lines(self):
        files = parse_diff(MULTI_FILE_DIFF)
        for f in files:
            for line in f.added_lines:
                # Added lines should not start with - or @@
                assert not line.startswith("-")
                assert not line.startswith("@@")

    def test_removal_only_has_no_added(self):
        files = parse_diff(REMOVAL_ONLY_DIFF)
        assert len(files) == 1
        assert files[0].line_count_added == 0


class TestExtractsLineNumbers:
    def test_extracts_line_numbers(self):
        files = parse_diff(SINGLE_FILE_DIFF)
        assert len(files[0].chunks) == 1
        chunk = files[0].chunks[0]
        assert chunk.start_line == 10


class TestIdentifiesFileType:
    def test_identifies_file_type(self):
        files = parse_diff(SINGLE_FILE_DIFF)
        assert files[0].file_type == "python"
        assert files[0].extension == ".py"

    def test_config_file_type(self):
        diff = """diff --git a/settings.json b/settings.json
--- a/settings.json
+++ b/settings.json
@@ -1 +1,2 @@
+{"debug": true}
"""
        files = parse_diff(diff)
        assert files[0].file_type == "config"
        assert files[0].extension == ".json"


class TestEmptyDiff:
    def test_empty_diff_returns_empty_list(self):
        assert parse_diff(EMPTY_DIFF) == []
        assert parse_diff("") == []
        assert parse_diff("   \n\n  ") == []


class TestGetAddedContent:
    def test_get_added_content(self):
        files = parse_diff(MULTI_FILE_DIFF)
        content = get_added_content(files)
        assert "DB_PASSWORD" in content
        assert "user.to_dict()" in content
