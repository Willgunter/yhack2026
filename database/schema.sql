-- Praesidia Database Schema

-- Violations table to track AI governance incidents
CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_role TEXT,
    surface TEXT, -- github, slack, jira, cline
    action_type TEXT,
    action_content TEXT,
    verdict TEXT, -- allow, block, escalate
    severity TEXT, -- low, medium, high, critical
    cited_policy TEXT,
    reasoning TEXT,
    thought_process TEXT, -- DeepSeek R1 trace
    escalation_sent BOOLEAN DEFAULT FALSE,
    resolution TEXT
);

-- User Risk Profiles to monitor user behavior over time
CREATE TABLE user_risk_profiles (
    user_id TEXT PRIMARY KEY,
    user_name TEXT,
    user_role TEXT,
    department TEXT,
    total_violations INTEGER DEFAULT 0,
    current_risk_score DECIMAL(5,2) DEFAULT 0.0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy Acknowledgements for compliance tracking
CREATE TABLE policy_acknowledgements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES user_risk_profiles(user_id),
    video_id TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deadline TIMESTAMP WITH TIME ZONE
);
