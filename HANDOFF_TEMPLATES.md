# Software prompt templates

Companion to Software Operating Guide v2.3. Optional prompts for a Claude or Codex project/chat or local session, not mandatory forms. Include only what is useful or not already in the repository. Unfilled fields confer no permission.

## A. Start a product or major feature (interview first)

I want to build [brief description]. Interview me in detail using the current tool's supported question mechanism. Ask about the user, essential behavior, edge cases, hard parts, constraints, and tradeoffs; skip obvious questions. Keep going until it is covered, then write a complete spec to docs/ and normalize the essentials into PROJECT_BRIEF.md: acceptance criteria, non-goals, constraints, and permissions. Name the files and interfaces involved, state what is out of scope, and end with an end-to-end verification step. Then stop and present the V1 contract for approval (Gate A).

Known context: references, existing repositories, budget and external-action permissions, difficult parts.

This is design work: use the coordinator and architect roles in docs/AGENT_ROLES.md, with the configured provider and authorized model settings.

## B. First batch in a new project

Before sending real work: the shared policy and role contracts are accessible in the actual execution environment, configured model and effort are set, and PROJECT_BRIEF.md and WORKING_RECORD.md are committed and pushed. Local agents read CLAUDE.md or AGENTS.md; remote workers need the ignored policy files supplied explicitly or authorized for tracking.

Send one small, real piece of work first. Propose threads and wait for my go-ahead. Run at most two threads at a time. Open the finished thread and check how it reported, what it assumed, and what it could not reach. Fix gaps once in the shared policy and both CLAUDE.md and AGENTS.md where applicable, then send the rest.

## C. Build an approved spec

The spec in [path] and PROJECT_BRIEF.md are approved (Gates A and B). Implement V1. Split it into bounded tasks with owners, files in scope, and acceptance checks. Run at most three threads at once, each on its own branch with one draft PR. Use the implementer role for well-specified work and the architect for hard design questions; do not send an unsettled design to the implementer. Follow docs/AGENT_ROLES.md using the current provider's supported delegation tools and authorized model settings. Run the reviewer on a fresh context before calling anything review-ready. Update WORKING_RECORD.md and docs as you go. Ask me only at the gates or for a material exception, batch non-urgent questions, and return with a review-ready candidate, evidence, and limitations.

Variants: "Start now without asking me to confirm" or "Propose threads first."

## D. Independent review

Review [commit or PR] against [requirements or brief sections] using a fresh context. You have not seen the author's reasoning; do not ask for it. Report blocking, material, and editorial findings with IDs, file and line, evidence, consequence, and a proposed fix, plus the exact PR head SHA, what you actually ran, and what you could not validate. Include documentation accuracy. Do not edit the implementation. The implementation owner records dispositions, fixes blockers, and requests verification of repairs and affected behavior on the new head. Leave unresolved human decisions with me. Do not merge or enable auto-merge.

## E. A decision that needs the human

- Decision needed and why it is reserved or unresolved:
- Relevant approval or constraint:
- Recommendation and evidence:
- Alternatives, including a suitable free option:
- One-time and recurring cost, limits, and upgrade trigger:
- Consequence of delay, and work that can continue:

## F. Bug or update intake

Paste the report, stack trace, or change request. Route it to the thread already working in that area if one exists; otherwise start one. Reproduce first with a failing test where practical, fix the root cause, and verify. If it changes an accepted decision, update the ADR in the same PR.

## G. Client engagement

- Client, and the project it lives in (one project and repository set per client):
- Scope: inclusions, exclusions, acceptance criteria, revision limit, data and integration items, milestones:
- Data: synthetic by default; any real data and the confidentiality terms that apply:
- Change requests: write a change proposal (scope, time, cost) for me; do not agree to it:
- Durability deliverables: tests, CHANGELOG, setup and recovery notes, dependency and license summary, maintenance boundary:

## H. Compact working record

- Current code snapshot and stage:
- Approved scope, UX references, and release permissions:
- Current tasks, owners, dependencies, next step:
- Checks completed with results; unrun checks and reasons:
- Decisions, review findings, and dispositions:
- Draft/ready PR link, base branch, verified head SHA, independent reviewer, and merge-brief status:
- Usage and cost posture, limits, unresolved risks:
- Blockers or human decisions needed:
- Candidate and release location, recovery notes, limitations:

## I. Prepare a draft for my merge

Coordinate verification of [draft PR] using PR_WORKFLOW.md. Assign a fresh-context reviewer, inspect the latest head and affected docs, resolve findings with the implementation owner, and verify repairs and applicable checks. Keep it draft while blockers, dependencies, or required verification remain unresolved. Once verified, mark it ready for review unless I explicitly asked you to keep it draft. Return a merge brief with PR link, base and exact head SHA, changes, review dispositions, check results and limitations, remaining risks or decisions, and any deployment effects. Update WORKING_RECORD.md. I perform the merge; do not merge or enable auto-merge.

## J. Merge brief

- PR link, base branch, verified head SHA, draft/ready status:
- What changed and why, including affected documentation:
- Independent reviewer, findings, and dispositions:
- Commands/results, relevant CI, unrun checks and reasons:
- Remaining risks, dependencies, decisions needed:
- Deployment effects and recovery steps, if applicable:
- Next action: Product Owner review and merge.
