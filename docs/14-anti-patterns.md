# 14 · Anti‑patterns & common pitfalls

**In this chapter:**

- [Decision framework](#decision-framework)
- [Repository & code structure](#repository-code-structure)
- [Tooling & versioning](#tooling-versioning)
- [Authentication & secrets](#authentication-secrets)
- [Pipelines & CI/CD](#pipelines-cicd)
- [Modules & registries](#modules-registries)
- [State management](#state-management)
- [Testing & policy](#testing-policy)
- [Code quality / DX](#code-quality-dx)
- [Manageability / day‑2](#manageability-day2)
- [Naming & tagging](#naming-tagging)
- [Documentation](#documentation)
- [Operational](#operational)


> A consolidated checklist of mistakes seen in real ALZ implementations.
> If you find yourself doing any of these, stop and reconsider.

[← 13 Documentation](13-documentation.md) · [Index](../README.md) · [References →](references.md)

Use this chapter as a 30-minute health check for any existing Azure Landing Zone (ALZ) repository. The previous chapters gave you the recommended patterns one topic at a time; this final chapter pulls those warnings into a single checklist so you can test an implementation quickly and honestly. Each section maps back to the part of the guide that explains the healthier pattern, and each anti-pattern is phrased as something you might actually find in a real repository rather than as an abstract rule.

That checklist format is deliberate. Anti-patterns are easier to recognise when they are concrete, so this chapter stays more list-heavy than the rest of the book while still giving you enough context to understand why each item is dangerous. No real ALZ implementation scores perfectly on first review; the point is to identify the gaps, prioritise them by risk, and address them through the same pull request process as everything else. Read each item as a question: *Is this us?*

---

## Decision framework

Start with the scorecard before you inspect the individual categories, because the score gives you a useful sense of whether you are dealing with isolated hygiene work or a deeper platform design problem. If you cannot answer Yes to all of these, you have at least one anti-pattern somewhere below; the value of the exercise is not the number itself, but the conversation it forces about which risks you are accepting deliberately and which ones simply accumulated unnoticed. Score yourself out of 20:

- [ ] State files are split per (env × workload).
- [ ] No long‑lived Azure secrets in any CI system.
- [ ] OIDC federation in use, with restrictive `subject` claims.
- [ ] Modules pinned by exact version, never by branch.
- [ ] Reusable pipeline templates shared across repos.
- [ ] Pre‑commit hooks installed and run in CI.
- [ ] Plan posted as a PR comment for every PR.
- [ ] Policy gates run at PR time *and* at runtime.
- [ ] CODEOWNERS exist and are reviewed quarterly.
- [ ] Branch protection requires CODEOWNERS + signed commits.
- [ ] Drift detection runs weekly per state file.
- [ ] Required tags enforced via Azure Policy.
- [ ] Module READMEs auto‑generated and CI‑verified.
- [ ] Devcontainer or `mise`/`asdf` pinning all toolchain versions.
- [ ] At least 5 ADRs in `docs/adr/`.
- [ ] At least 3 runbooks in `docs/runbooks/`.
- [ ] Decommission process documented and exercised.
- [ ] Naming convention enforced via a naming module.
- [ ] Storage account hosting state is private endpoint + CMK only.
- [ ] State recovery has been tested in the last 6 months.

| Score | Verdict |
|-------|---------|
| 18–20 | World class — write a blog post. |
| 14–17 | Solid — pick the next two and improve. |
| 10–13 | Functional — significant risk in 1–2 areas. |
| < 10  | Stop and re‑plan before scaling further. |

Working through this list is most useful not as a one-time audit but as a recurring exercise — quarterly for a mature platform, monthly when the estate is growing quickly. When you find an anti-pattern you are currently living with, resist the temptation to note it privately and move on. Open an issue, assign an owner, and track its remediation alongside everything else the team ships. The self-assessment above gives you a structured framework for that conversation — a score honest enough to be useful and specific enough to drive action — and the first place that score usually breaks down is the shape of the repository itself.

---

## Repository & code structure

Repository boundaries and state layout are not cosmetic choices; they decide who can review a change, how much infrastructure a single mistake can touch, and how easy it is for a new engineer to understand where intent lives. The anti-patterns in this section all start from the same assumption, namely that you can tidy structure later once the platform is bigger. In practice, the opposite is true: structure is easiest to fix while the estate is still small, and it becomes expensive precisely when you most need it to be predictable.

* ❌ **One mega‑repo with one giant Terraform state.** A single repository can be a valid starting point, but a single state file for the whole estate turns every plan into a high-stakes operation because the blast radius is the entire environment. Split state by environment and workload so a failure in one area cannot lock, drift, or destroy unrelated infrastructure. See [01 repository topology](01-repository-topology.md) and [07 state management](07-state-management.md).
* ❌ **One repo per resource group.** This looks like strong isolation until you realise the repository boundary no longer matches any meaningful ownership boundary. You end up with more pipeline glue than infrastructure, cross-resource changes require choreography across many repositories, and reviewers lose the ability to reason about a workload as a whole.
* ❌ **Mixing application source code with IaC.** Application code and platform IaC usually move at different cadences, have different reviewers, and carry different security expectations. Keeping them together makes branch protection, CODEOWNERS, and deployment approvals either too strict for developers or too loose for infrastructure.
* ❌ **Copy‑pasted "modules" folder across many repos.** Copying a module folder feels faster than publishing a shared module, but every copy immediately becomes its own fork with its own bugs, defaults, and undocumented patches. Promote common code to a shared module repository and consume it through a registry so fixes and versioning are explicit.
* ❌ **Branch‑per‑environment** (`dev`, `staging`, `main`) with cherry‑picking between them. Environment branches make Git history carry deployment state, which means every hotfix depends on humans remembering which commits moved where. Model environments as folders, workspaces, stacks, or pipeline inputs instead, and let Git branches represent code review rather than runtime topology.
* ❌ **Tests, modules, and envs all jumbled together.** A consistent layout is a load-bearing readability feature because reviewers need to know whether they are looking at reusable code, environment composition, or validation logic before they can judge the change. When those concerns sit in one undifferentiated tree, every review starts with archaeology.

Once the repository tells you where responsibility lives, the next question is whether two engineers running the same code with the same inputs will get the same result. That takes you from structure into tooling and versioning, where the same discipline has to apply to every binary, provider, action, and module reference.

## Tooling & versioning

A reviewed plan is only meaningful if you can reproduce the tools, providers, actions, and module versions that produced it. The mistakes in this section often hide behind harmless language such as "latest" or "main", but mutable inputs break the link between review and deployment. Pinning is not bureaucracy; it is how you make a future plan comparable to the one someone approved yesterday.

* ❌ **Large ARM JSON templates without tooling assistance.** Raw Azure Resource Manager (ARM) JSON is three to five times more verbose than Bicep or Terraform equivalents, which makes pull request reviews harder, merge conflicts more frequent, and resource references error-prone. The VS Code ARM extension and ARM TTK mitigate some of this, but at scale a higher-level language such as Bicep, Terraform, or Pulumi, with modules, loops, and type-checked references, pays for itself quickly. See [02 IaC tooling](02-iac-tooling.md).
* ❌ **Floating versions** (`source = "...?ref=main"`, `version = "latest"`). Floating versions make yesterday's reviewed code behave differently tomorrow even when the repository did not change. Pin exact versions or immutable references so upgrades become deliberate pull requests with visible diffs.
* ❌ **GitHub Actions referenced by mutable tags** (`@v3`). A tag can move, and when it does, your pipeline changes outside your review process. Pin actions by SHA, use automation to raise update PRs, and treat the workflow runtime as part of the supply chain.
* ❌ **Two IaC engines managing the same resource.** When Terraform, Bicep, Pulumi, or portal automation all believe they own the same object, drift becomes a negotiation between tools rather than a controlled change. Assign one authoritative owner per resource and make any handoff explicit.
* ❌ **Pulumi adopted by an ops‑background team without a software engineering culture.** Pulumi can be excellent when the team is comfortable with application structure, testing, dependency management, and code review discipline. Without that culture, the freedom of a general-purpose language turns infrastructure into spaghetti faster than a declarative tool would.
* ❌ **Provider versions unlocked.** Provider minor releases can change defaults, resource schemas, and diff behaviour in ways that rewrite half your plan unexpectedly. Lock provider versions and upgrade them intentionally, with plan output reviewed as a real platform change.

Pinning removes one source of surprise, but a deterministic toolchain still cannot protect you if the identity running it is too powerful or too easy to steal. That is why versioning naturally leads into authentication and secrets, where the same reviewed workflow can become dangerous if its credentials are broad or persistent.

## Authentication & secrets

Convenience credentials become estate-wide blast radius when pipeline identity, human access, and secrets are not separated. In an ALZ repository, authentication is part of the architecture: it decides which branch, workflow, environment, or person is allowed to change which scope. The safest pattern is to make short-lived, narrowly scoped, auditable credentials the default path, and to treat any long-lived secret as technical debt with a due date.

* ❌ **Long‑lived service principal client secret in CI.** A stored client secret turns every workflow runner, repository administrator, and secret export path into a potential route to Azure. Use OpenID Connect (OIDC) federation so the pipeline receives a short-lived token only when the expected repository, branch, and workflow context match.
* ❌ **One SPN with Owner @ tenant root for "convenience".** A tenant-root Owner service principal can change almost anything, so a compromised workflow becomes a tenant-wide incident. Scope identities to the smallest management group, subscription, or resource group they need, and separate plan, apply, and break-glass permissions where possible.
* ❌ **Federated credential subject `repo:org/repo:*`.** Broad subject claims defeat the point of federation because any branch, tag, or workflow context in the repository can potentially mint a token. Bind the subject to the specific branch, environment, or reusable workflow that should deploy, and review those claims with the same care as role assignments.
* ❌ **Same identity used by humans and pipelines.** Shared identities make audit trails ambiguous, which means you cannot tell whether a change came from a reviewed workflow or a person at a terminal. Give pipelines their own identities, require humans to use named accounts, and make break-glass activity visible.
* ❌ **Secrets stored in `terraform.tfvars` "just for now".** Terraform variable files have a habit of being committed, copied into artifacts, or reflected into state, and state files can leak sensitive values even when the variable file is later cleaned up. Store secrets in Key Vault or another managed secret store, and pass references rather than values wherever the platform allows it. See [07 state management](07-state-management.md).
* ❌ **Adding `--allow-secret` to bypass scanners.** Secret-scanner bypasses are rarely temporary because the pressure that created them usually returns. If the scanner is wrong, fix the rule or document the exception narrowly; if it is right, rotate the credential and remove the secret instead of teaching the pipeline to ignore it.

After identity is narrowed and secrets are out of the repository, the next risk is the path those identities use to make changes. Pipelines should turn the controls above into the default route, not into optional ceremony, because a safe credential still needs a safe delivery process around it.

## Pipelines & CI/CD

The continuous integration and continuous delivery (CI/CD) path is where repository structure, pinned tooling, and scoped identity either come together as a safe delivery path or fall apart into manual exceptions. A good ALZ pipeline preserves the reviewed plan, applies only after the right gates have passed, reuses hardened workflow templates, and keeps watching for drift after deployment. The anti-patterns below weaken that chain at different points, but they all have the same effect: they make it harder to prove what changed, who approved it, and whether production still matches code.

* ❌ **`apply` directly without an explicit `plan` artifact.** If the apply job recalculates the plan without preserving the reviewed artifact, the change applied to Azure might not be the change reviewers saw. Store the plan, bind approval to that artifact, and make the apply consume it rather than silently planning again.
* ❌ **`continue-on-error: true`** to "make the build green" while investigating. A temporary bypass in CI becomes permanent because the visible signal turns green and the pressure to fix the underlying failure disappears. If a control is noisy, tune it; if it is broken, fail loudly until it is repaired.
* ❌ **`pull_request_target` with checkout of PR code from forks.** `pull_request_target` runs with elevated permissions from the base repository, so checking out untrusted fork code inside that context creates a privilege-escalation path. Use safer pull request events for untrusted code, or separate metadata processing from code execution.
* ❌ **`cancel-in-progress: true` on the deploy concurrency group.** Cancelling a plan job is usually fine, but cancelling an in-flight apply can leave locks, partial deployments, or inconsistent external state. Protect deployment concurrency so applies serialize without being interrupted midway.
* ❌ **One pipeline that deploys all environments serially.** A single serial pipeline makes every environment wait for every other one and encourages broad permissions because the workflow must touch everything. Use environment-specific jobs, approvals, and gates so non-production remains fast while production stays controlled.
* ❌ **Per‑repo bespoke workflows.** Custom workflows feel locally efficient until small differences in flags, permissions, and gates create divergent security postures across repositories. Put the common logic in reusable workflows or shared templates, and let repositories provide parameters rather than copy-pasted YAML.
* ❌ **No drift detection.** A pipeline that only runs on pull requests assumes Azure never changes outside Git, which is not a safe assumption in a real estate. Schedule drift detection per state file or deployment stack, route findings to an owner, and treat untriaged drift as an operational incident.

Pipelines can enforce safe movement through environments, but they still depend on the building blocks they deploy. Those building blocks are the modules and registries that either concentrate enterprise standards or spread duplication across the estate, so the next set of mistakes moves from workflow mechanics into reusable design.

## Modules & registries

Modules are supposed to convert repeated design decisions into reusable, versioned platform primitives. They fail when duplication, branch pins, and over-flexible wrappers turn that leverage into hidden coupling. The healthiest module strategy is opinionated enough to enforce enterprise defaults, small enough to remain understandable, and versioned enough that consumers can upgrade deliberately.

* ❌ **Inlined modules duplicated between landing zones.** "We'll DRY it later" rarely survives contact with delivery pressure because every duplicate gains its own local assumptions. Extract shared logic before the third copy, publish it, and make consumers pin a version so fixes have a route back to every workload.
* ❌ **A "kitchen sink" module** with 80 boolean toggles. A module with dozens of feature flags usually represents several different products hiding behind one interface. Split it into smaller modules with clear responsibilities, and compose them at the landing-zone layer where the architecture is visible.
* ❌ **Calling AVM resource modules directly from landing‑zone code.** Azure Verified Modules (AVM) are useful building blocks, but direct consumption leaves no place to enforce your naming, tagging, diagnostics, policy, and security defaults consistently. Wrap AVM where you need enterprise opinion, and make the wrapper the supported path for landing-zone teams.
* ❌ **Wrapping AVM with a module that adds nothing.** A wrapper that simply passes every input through creates another API surface without adding governance value. If you are not constraining defaults, simplifying inputs, or enforcing standards, call AVM directly and avoid owning a pointless abstraction.
* ❌ **Releasing a major version without a `MIGRATION.md`.** A breaking module release without migration guidance pushes every consumer into reverse engineering. Document what changed, why it changed, the safest upgrade path, and any state moves or import steps before you ask teams to adopt the new major version.
* ❌ **Pinning to a branch name** (`?ref=main`). Branch pins make module consumption depend on whatever happened to be on that branch at plan time. Publish immutable versions or tags, then let automated dependency updates raise visible PRs when consumers should move.

A registry gives you controlled distribution, but the applied infrastructure still depends on state that records what already exists. That makes state management the next place where small shortcuts can turn into large outages, because the module version tells you what should happen while state tells the tool what already did happen.

## State management

State is a protected production dependency, not a local cache or an implementation detail. It contains the map between code and deployed resources, often includes sensitive outputs, and determines what the next apply believes it is allowed to change. Treat it as isolated, remote, locked, recoverable, and never hand-edited, because state failure is one of the few IaC problems that can turn a small mistake into a platform-wide recovery exercise.

* ❌ **State backend in the same subscription as the resources it manages.** A bad apply, accidental deletion, or subscription-level lockout can damage the very storage account you need to recover. Keep state in a separate, tightly controlled subscription with private access, strong backup, and permissions that are independent from the workloads being managed.
* ❌ **State on engineer laptops.** Local state means the truth about infrastructure lives on a device that can be lost, overwritten, or unavailable when someone else needs to deploy. Use remote state even for development so locking, backup, and audit behaviour match the rest of the estate.
* ❌ **`terraform_remote_state` cross‑references that leak producer secrets to consumers.** Remote state exposes outputs from one stack to another, and those outputs often include values the consumer does not need to see. Publish only the required contract through a safer channel such as App Configuration, Key Vault references, or a deliberately shaped output module.
* ❌ **Editing state files by hand.** Manual state edits bypass the tool's safety checks and can create a mismatch that only appears during the next destructive plan. Use supported commands such as import, state mv, or deployment-stack operations, and peer-review the recovery procedure before touching production state.
* ❌ **Running `force-unlock` reflexively when a lock appears.** A lock is a signal that another operation might still be changing infrastructure. Investigate the running job, confirm it is dead, and record why you are unlocking before you remove the protection that prevents concurrent writes.
* ❌ **Bicep prod deployments without Deployment Stacks.** Without Deployment Stacks, Bicep has weaker managed-resource tracking and drift protection for production scopes. Use stacks where they fit so Azure understands the intended resource set and can help you detect or control unmanaged changes.

Once state is protected, you still need confidence that proposed changes are safe before they reach it and that runtime controls catch anything code review misses. Testing and policy provide those two layers, but only when they are placed where teams cannot easily bypass them or learn to ignore them.

## Testing & policy

Controls that run too late, too slowly, or only in one layer train teams to work around them. The point of testing and policy in an ALZ repository is not to create a perfect gate at one moment; it is to create a feedback ladder, with fast checks in the pull request, stronger validation before deployment, and Azure Policy enforcing the non-negotiables at runtime. The anti-patterns below either collapse that ladder into one slow gate or leave a gap large enough for portal changes to walk through.

* ❌ **All policy lives at PR time.** Pull request checks only evaluate code that passes through the repository. Anyone with portal access, another deployment tool, or a legacy script can bypass them unless Azure Policy or equivalent runtime control enforces the same constraints in the platform.
* ❌ **All policy lives in Azure Policy.** Azure Policy is essential, but if developers only discover violations after a long plan or failed deployment, they will see governance as a late surprise. Move checks that can be evaluated statically into pre-commit, CI, PSRule, Checkov, or equivalent tools so feedback arrives while the change is still cheap.
* ❌ **`soft_fail: true` on Checkov to "fix later".** A soft-failing scanner teaches the organisation that the signal is optional. Either fail the build on rules you care about, narrow the ruleset to reduce noise, or remove the check until you are ready to enforce it.
* ❌ **Integration tests against a shared sub with hard‑coded names.** Shared subscriptions and fixed names make parallel pull requests collide, which turns valid changes into flaky failures. Create isolated test scopes, generate unique names, and clean them up automatically so tests can run concurrently.
* ❌ **45‑minute test suites.** Slow tests are avoided, skipped, or moved out of the developer path, which means they stop protecting the work they were meant to protect. Split fast PR checks from deeper scheduled or pre-release tests, and parallelise anything that must remain in the critical path.
* ❌ **Custom rules in Rego when a built‑in PSRule rule exists.** Custom policy code has maintenance cost, documentation cost, and interpretation cost. Prefer built-in rules when they express the control you need, and reserve custom rules for genuinely local requirements.

Good controls should feel like part of the development workflow rather than a separate compliance ritual. That makes developer experience the next practical concern, because the easiest safe path is the one teams will actually use when delivery pressure rises.

## Code quality / DX

Developer experience guardrails should be pinned, automated, and hard to ignore. In infrastructure repositories, developer experience is not a luxury layer on top of governance; it is how you make the governed path faster than the unsafe path. The common failure mode is to document a good practice without making it executable, which leaves every engineer to rebuild the toolchain by memory.

* ❌ **README that says "install Terraform 1.x"** without pinning. A vague version range guarantees different engineers and runners will eventually plan with different binaries. Pin exact versions through `.terraform-version`, `mise`, `asdf`, a devcontainer, or the pipeline image, and make the README point to that source of truth.
* ❌ **Linters that produce warnings nobody reads.** Warning-only linters create noise without changing behaviour because the build still passes and the pull request still merges. Decide which rules matter enough to fail, tune the rest, and remove checks that nobody is prepared to act on.
* ❌ **Module READMEs written by hand.** Hand-written module inputs and outputs drift as soon as the interface changes under delivery pressure. Generate README content from the module source, fail CI when generated docs are stale, and reserve hand-written prose for intent and examples.
* ❌ **`make apply` that works against prod from a laptop.** A local command that can change production bypasses the audit trail, approval gates, and identity controls you built into the pipeline. Keep local commands limited to validation, formatting, planning in safe scopes, or ephemeral development environments.
* ❌ **Devcontainer that nobody uses.** A devcontainer is only valuable if it is the normal way to get the right tools, not an optional artefact that drifts behind the README. Make it easy, current, and used in CI where possible, or choose another toolchain-pinning mechanism that the team will actually adopt.

A smooth developer path gets changes into the platform safely, but the platform also needs owners after the merge. Day-2 manageability is where IaC stops being a deployment technique and becomes an operating model, with named humans responsible for the resources code creates.

## Manageability / day‑2

Day-2 ownership fails when reviews, runbooks, locks, drift, and decommissioning have no accountable owner. The first apply is only the beginning of an ALZ lifecycle: resources need change review, exceptions need expiry, subscriptions need retirement, and production incidents need responders who can find the right runbook at 2 a.m. The anti-patterns here are dangerous because they often look like administration rather than architecture until something goes wrong.

* ❌ **CODEOWNERS = `@org/everyone`.** A review requirement that names everyone effectively names no one, because responsibility diffuses across the whole organisation. Map paths to the smallest accountable team that can make an informed decision, and review those mappings as teams and repositories change.
* ❌ **Resource locks that the pipeline SPN bypasses without anyone noticing.** Locks become theatre when the automation identity can remove or ignore them without visibility. If locks are part of your control model, test how the pipeline behaves against them, document the break-glass path, and alert on lock removal.
* ❌ **No decommission process.** Subscriptions, role assignments, private endpoints, and diagnostic settings accumulate when retirement is not a defined workflow. Document how a workload leaves the estate, who approves it, how data is retained, and how state is cleaned up.
* ❌ **Runbooks in a wiki nobody can find at 2 a.m.** Incident documentation that lives outside the repository is hard to review, hard to version, and often hard to locate under pressure. Keep runbooks with the code, link them from alerts, and test them during drills.
* ❌ **Engineers fixing prod by editing in the portal "just this once".** A portal fix may solve the immediate incident, but it also makes code stop being authoritative unless the change is reconciled immediately. Capture emergency changes as follow-up PRs, or the next apply may undo them without understanding why they existed.
* ❌ **Drift alerts that nobody triages.** An alert without an owner or service-level agreement becomes background noise. Route drift findings to a team, define how quickly they must be classified, and close the loop by either reconciling code or removing unauthorized changes.

Operations also depends on the metadata you attach to resources, because responders and cost owners cannot manage what they cannot identify. That brings the checklist to naming and tagging, where small inconsistencies become large reporting and automation problems.

## Naming & tagging

Names and tags are governed data, not free text or conventions that live only in training. They drive ownership, cost allocation, policy targeting, automation, and incident response, which means inconsistency becomes an operational defect rather than a cosmetic annoyance. The safest pattern is to encode naming and tagging rules in modules and policy so the estate stays queryable as it grows.

* ❌ **Inventing your own resource abbreviations.** Local abbreviations feel harmless until they collide with Microsoft Cloud Adoption Framework (CAF) guidance, Azure constraints, or another team's convention. Start from Microsoft's CAF list, document any deliberate exceptions, and keep the naming module aligned with that source.
* ❌ **Free‑text tags** (`Owner: "John (he sits next to Sara)"`). Tags are data that automation and reporting need to parse. Use stable identifiers such as team names, cost centres, service IDs, or distribution lists, and keep human commentary in documentation or issue trackers.
* ❌ **`Environment` values that drift** (`Prod`, `prod`, `Production`). Multiple spellings of the same environment break queries, policy filters, and cost reports. Define canonical values, enforce them with policy or module validation, and migrate old values rather than teaching every report to handle every variant.
* ❌ **Required tags enforced only by training docs.** Training explains the rule, but it does not stop a deployment that omits the tag. Enforce required tags in modules and Azure Policy so missing metadata fails close to the point of creation.
* ❌ **Naming module added "later".** Names are among the hardest things to refactor because they often appear in DNS, diagnostics, access policies, state, and downstream integrations. Build the naming module early, even if the first version is small, so the estate grows around one contract.

Consistent metadata makes the estate easier to operate, but the reasoning behind the estate still needs to be captured somewhere durable. Documentation is where those design decisions either remain reviewable or decay into folklore, so the next anti-patterns focus on where knowledge lives and how it changes.

## Documentation

Documentation that cannot be reviewed, diffed, generated, or tied to design decisions decays immediately. In an IaC repository, docs are not a separate publishing exercise; they are part of the same change system as the code, which means pull requests should update decisions, diagrams, examples, and runbooks when the platform changes. The anti-patterns below all move knowledge out of that reviewable path.

* ❌ **Wiki‑only documentation** (Confluence, SharePoint). A wiki can be useful for broad collaboration, but if it is the only source of platform documentation, design knowledge sits outside code review and drifts from the implementation. Keep authoritative ALZ docs with the repository, and link outward only for supplementary material.
* ❌ **Architecture diagrams in proprietary binary formats.** Binary diagrams cannot be meaningfully diffed, merged, or reviewed in a pull request. Prefer text-based diagrams, generated diagrams, or formats with a reviewable source so architecture changes travel with the code they describe.
* ❌ **TODO comments instead of issues.** TODO comments hide future work in files that nobody scans during planning. Convert them into issues with owners, priorities, and links back to the code so the work can be triaged instead of rediscovered by accident.
* ❌ **One giant `docs/all.md`.** A single documentation dump becomes hard to navigate and impossible to review coherently. Split docs by decision area, runbook, or module so readers can find the context they need and reviewers can assess one topic at a time.
* ❌ **Documenting implementation rather than design.** Code already shows what is deployed; documentation should explain why the design exists, which tradeoffs were accepted, and what would cause you to revisit the decision. If the prose merely restates resource arguments, it will age worse than the code.

By this point the checklist has covered the repository, the delivery path, the deployed state, and the knowledge around it. The final group asks whether the operating model is ready for the moments when the platform is under pressure, because the best repository design still fails if nobody can respond, measure flow, or retire what is no longer needed.

## Operational

Operational readiness requires named responders, measured flow, retirement paths, and practiced failure drills. These are not afterthoughts to add once the ALZ is stable; they are the mechanisms that tell you whether the platform is healthy, whether delivery is improving, and whether the team can recover when a high-impact failure occurs. The last anti-patterns therefore focus on the human and procedural side of running the estate.

* ❌ **Pager configured but no on‑call rota.** An alerting tool without a named responder is just delayed email. Define the rota, escalation path, and ownership model before you rely on paging as an operational control.
* ❌ **No SLO on time‑to‑production for a typical PR.** Without a service-level objective for delivery flow, you cannot tell whether gates are protecting the platform or quietly making teams bypass it. Measure how long a normal change takes from pull request to production, then improve the bottlenecks deliberately.
* ❌ **No mechanism to retire old subscriptions.** Old subscriptions keep consuming cost, policy assignments, role assignments, and operational attention long after the workload has gone away. Give retirement the same workflow discipline as creation: approval, dependency checks, data retention, state cleanup, and final deletion.
* ❌ **No fire drills** for state recovery, credential leak, full‑estate outage. The first time you test recovery should not be in production during an incident. Practice the scenarios that would hurt most, record what failed, and turn the lessons into issues, runbook updates, and pipeline improvements.

A strong score at the top of this chapter does not mean you are finished; it means the platform has habits that let it keep improving. Re-run the checklist after major platform changes, after incidents, and before scaling to new business units, because anti-patterns usually return quietly through exceptions that were supposed to be temporary.

---

[← 13 Documentation](13-documentation.md) · [Index](../README.md) · [References →](references.md)
