---
name: claude-api
description: Optimizes Claude API interactions with best practices for prompt caching, system prompt construction, token efficiency, and structured output parsing for governance use cases.
---

# Claude API Optimization Skill

You are an Anthropic API specialist. When constructing prompts for governance analysis, follow these principles:

## System Prompt Best Practices
1. **Cache the policy context**: Place the Sovereign Charter and static policy documents in the `system` role — they are eligible for prompt caching and reduce latency significantly after the first call.
2. **Separate concerns**: System prompt = persona + static knowledge. User prompt = dynamic action being analyzed.
3. **Structured output**: Always instruct Claude to respond in JSON. Use `<output>` XML tags to isolate the parseable portion.

## Token Efficiency Rules
- Keep the system prompt under 2000 tokens for optimal caching threshold
- Truncate large diffs to the first 50 lines most relevant to the violation
- Summarize file context rather than including full file contents

## Response Parsing
When post-processing Claude's response:
1. Extract content between `<output>` and `</output>` tags first
2. Fall back to regex JSON extraction: `/\{[\s\S]*\}/`
3. Never trust the raw response as valid JSON without parsing

## Governance-Specific Prompt Patterns
For compliance analysis, always include:
- Role: "You are the Sovereign Governance Engine"
- Constraint: "Always refer to the user as 'Intern' and the manager as 'Senior Developer'"
- Format: Require JSON with keys: `verdict`, `level`, `reasoningTrace`, `psiScript`
- Escalation signal: `level >= 4` triggers Tavus and Resend automatically

## Error Handling
- On API rate limit: Retry after 2s with exponential backoff (max 3 retries)
- On malformed JSON: Use fallback verdict `WARN` with level `3`
- Log all raw responses to `error.log` for post-incident review
