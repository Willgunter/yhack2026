"""Tests for praesidia.core.user_registry"""

import os
import tempfile
import pytest
from praesidia.core.user_registry import (
    ensure_users_table, create_user, get_user, get_manager,
    resolve_user, get_all_users, seed_demo_data, DEMO_IDS,
)


@pytest.fixture
def temp_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


class TestCreateAndGetUser:
    def test_create_user_returns_id(self, temp_db):
        uid = create_user("Test User", "test@example.com", db_path=temp_db)
        assert uid
        assert len(uid) == 36  # UUID format

    def test_get_user_by_id(self, temp_db):
        uid = create_user("Alice", "alice@test.com", role="developer", phone="+15551234567", db_path=temp_db)
        user = get_user(uid, db_path=temp_db)
        assert user is not None
        assert user["display_name"] == "Alice"
        assert user["email"] == "alice@test.com"
        assert user["role"] == "developer"
        assert user["phone"] == "+15551234567"

    def test_get_nonexistent_user(self, temp_db):
        ensure_users_table(temp_db)
        user = get_user("nonexistent-id", db_path=temp_db)
        assert user is None


class TestResolveUser:
    def test_resolve_by_email(self, temp_db):
        create_user("Bob", "bob@test.com", git_email="bob.git@test.com", db_path=temp_db)
        user = resolve_user(email="bob@test.com", db_path=temp_db)
        assert user is not None
        assert user["display_name"] == "Bob"

    def test_resolve_by_git_email(self, temp_db):
        create_user("Carol", "carol@test.com", git_email="carol.dev@test.com", db_path=temp_db)
        user = resolve_user(git_email="carol.dev@test.com", db_path=temp_db)
        assert user is not None
        assert user["display_name"] == "Carol"

    def test_resolve_by_slack_id(self, temp_db):
        create_user("Dave", "dave@test.com", slack_user_id="U_DAVE_123", db_path=temp_db)
        user = resolve_user(slack_user_id="U_DAVE_123", db_path=temp_db)
        assert user is not None
        assert user["display_name"] == "Dave"

    def test_resolve_by_jira_username(self, temp_db):
        create_user("Eve", "eve@test.com", jira_username="eve.dev", db_path=temp_db)
        user = resolve_user(jira_username="eve.dev", db_path=temp_db)
        assert user is not None

    def test_resolve_no_match(self, temp_db):
        ensure_users_table(temp_db)
        user = resolve_user(email="nobody@test.com", db_path=temp_db)
        assert user is None

    def test_resolve_no_params(self, temp_db):
        ensure_users_table(temp_db)
        user = resolve_user(db_path=temp_db)
        assert user is None


class TestGetManager:
    def test_get_manager_chain(self, temp_db):
        mgr_id = create_user("Manager", "mgr@test.com", role="manager", db_path=temp_db)
        dev_id = create_user("Dev", "dev@test.com", role="developer", manager_id=mgr_id, db_path=temp_db)

        manager = get_manager(dev_id, db_path=temp_db)
        assert manager is not None
        assert manager["display_name"] == "Manager"

    def test_get_manager_no_manager(self, temp_db):
        uid = create_user("Solo", "solo@test.com", db_path=temp_db)
        manager = get_manager(uid, db_path=temp_db)
        assert manager is None


class TestSeedDemoData:
    def test_seed_creates_four_users(self, temp_db):
        count = seed_demo_data(db_path=temp_db)
        assert count == 4
        users = get_all_users(db_path=temp_db)
        assert len(users) == 4

    def test_seed_is_idempotent(self, temp_db):
        first = seed_demo_data(db_path=temp_db)
        second = seed_demo_data(db_path=temp_db)
        assert first == 4
        assert second == 0  # Already seeded

    def test_seed_manager_chain(self, temp_db):
        seed_demo_data(db_path=temp_db)
        alice = get_user(DEMO_IDS["alice"], db_path=temp_db)
        assert alice["manager_id"] == DEMO_IDS["bob"]

        bob = get_user(DEMO_IDS["bob"], db_path=temp_db)
        assert bob["manager_id"] == DEMO_IDS["carol"]

        carol = get_user(DEMO_IDS["carol"], db_path=temp_db)
        assert carol["manager_id"] is None

    def test_seed_has_platform_ids(self, temp_db):
        seed_demo_data(db_path=temp_db)
        alice = get_user(DEMO_IDS["alice"], db_path=temp_db)
        assert alice["slack_user_id"] == "U_ALICE_DEMO"
        assert alice["git_email"] == "alice@acme.com"
        assert alice["jira_username"] == "alice.dev"
