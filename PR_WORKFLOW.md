# Draft PR verification and human merge

Agents prepare and verify changes. The Product Owner makes the final merge decision and performs the merge. This workflow applies to implementation, documentation, and repository maintenance.

## 1. Open a draft

The implementation owner works on a dedicated branch and opens one draft PR per bounded task. Include the problem, resulting behavior, scope, relevant requirements, and verification evidence. Keep affected documentation and the working record current in the same PR. Commit and push only the task's changes; preserve unrelated work. Document any dependency on another unmerged PR.

## 2. Verify independently

The coordinator or repository manager assigns a fresh-context reviewer that did not author the changes. Give it the PR diff, exact head commit SHA, requirements, and acceptance criteria. The reviewer inspects the implementation and affected documentation, runs proportionate checks, and reports commands, results, unrun checks, and limitations. Author self-review is useful but does not replace independent review.

Record findings with IDs, severity, evidence, and a proposed fix. The implementation owner fixes blockers and resolves material findings by a fix or evidence-based disposition. Human decisions about scope or reserved risk remain with the Product Owner. The reviewer verifies repairs and affected behavior on the new head commit. Any later push invalidates the prior readiness decision until the changed areas and required checks are verified again. Reuse unaffected evidence only when its continued applicability is documented.

## 3. Prepare for the human's merge

Keep the PR draft while blockers, required verification, or dependencies remain unresolved. Once the current head is independently verified, required checks pass, and no blocker or unresolved material finding remains, the coordinator or repository manager may mark it ready for review without another permission request. Leave it draft if the Product Owner explicitly requested that it remain draft, and still provide the merge brief.

Add a concise merge brief to the PR and report it to the Product Owner:

- PR link, base branch, and exact verified head SHA.
- What changed and why, including documentation changes.
- Independent reviewer and findings with their dispositions.
- Verification commands and results, relevant CI results, and unrun checks with reasons.
- Remaining risks, dependencies, and any decision needed.
- Deployment effects and recovery steps when applicable; state when merging triggers an existing deployment workflow.

Readiness is an agent assessment. It does not imply human acceptance, permission to deploy, or that the change has shipped. If review or required checks are unavailable, report the specific gap and leave the PR draft pending the Product Owner's disposition.

## 4. Human merge and follow-through

Agents never merge PRs or enable auto-merge. The Product Owner reviews the prepared candidate and performs the merge. After observing the actual merge, the coordinator or repository manager records the merge commit and updates project status. Perform deployment, publication, or post-merge actions only within existing authorization; record their actual outcomes separately.

## Responsibilities and repository protections

The implementation owner authors and repairs changes. The independent reviewer verifies them. The repository manager coordinates review, checks documentation and repository hygiene, tracks unfinished work, and prepares the merge handoff; the coordinator retains project integration ownership. Assign one editor per file and avoid duplicate PRs. Use existing implementation context rather than relearning the project or repeating unaffected checks.

GitHub rulesets and account permissions enforce protections separately from these instructions. The recommended baseline is to block force pushes and deletion on default/release branches, require PRs, and require reliable applicable CI checks. Feature branches follow project conventions. Changing protections, CI, access, or release workflows requires the applicable authorization.

Record which GitHub identity opens PRs. When agents use the Product Owner's account, GitHub cannot distinguish agent actions from human actions, and that account cannot approve its own PRs. Record agent verification as evidence; do not claim it is a formal approval by the Product Owner. Configure required human approvals only when the repository's identities and permissions support that workflow. Do not bypass protections to make a candidate mergeable.
