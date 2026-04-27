# 14 · Anti‑patterns & common pitfalls

> A consolidated checklist of mistakes seen in real ALZ implementations.
> If you find yourself doing any of these, stop and reconsider.

[← 13 Documentation](13-documentation.md) · [Index](../README.md) · [References →](references.md)

Thirteen chapters of design decisions, tradeoffs, and recommendations culminate here. This chapter is the consolidation — a catalogue of every significant mistake this guide has warned against, organised by the same categories you have been building through: repository structure, tooling, authentication, pipelines, modules, state, testing, and operations. Think of it as the final exam — not a test of whether you remember the theory, but a structured exercise in honestly assessing how close your current implementation is to the practices this guide advocates. No real-world ALZ implementation scores perfectly on first review; the point is to identify the gaps, prioritise them by risk, and address them through the same PR process as everything else. Read each item as a question: *Is this us?*

---

## Repository & code structure

* ❌ **One mega‑repo with one giant Terraform state.** Blast radius =
  entire estate. Split state by (environment × workload). See
  [01](01-repository-topology.md), [07](07-state-management.md).
* ❌ **One repo per resource group.** Granularity gone mad; more pipeline
  glue than infrastructure.
* ❌ **Mixing application source code with IaC.** Different cadences,
  reviewers, and security models. Split.
* ❌ **Copy‑pasted "modules" folder across many repos.** Promote to a
  shared module repo with a registry.
* ❌ **Branch‑per‑environment** (`dev`, `staging`, `main`) with cherry‑
  picking between them. You will lose a hotfix eventually.
* ❌ **Tests, modules, and envs all jumbled together.** A consistent
  layout is a load‑bearing readability feature.

## Tooling & versioning

* ❌ **Authoring ARM JSON by hand.** Use Bicep.
* ❌ **Floating versions** (`source = "...?ref=main"`, `version = "latest"`).
  Reproducibility gone.
* ❌ **GitHub Actions referenced by mutable tags** (`@v3`). Pin by SHA.
* ❌ **Two IaC engines managing the same resource.** Drift wars.
* ❌ **Pulumi adopted by an ops‑background team without a software
  engineering culture.** Becomes spaghetti.
* ❌ **Provider versions unlocked.** A provider minor bump can rewrite
  half your plan unexpectedly.

## Authentication & secrets

* ❌ **Long‑lived service principal client secret in CI.** Use OIDC
  federation. Always.
* ❌ **One SPN with Owner @ tenant root for "convenience".** Catastrophic
  blast radius.
* ❌ **Federated credential subject `repo:org/repo:*`.** Defeats the
  purpose of federation.
* ❌ **Same identity used by humans and pipelines.** Audit becomes
  impossible.
* ❌ **Secrets stored in `terraform.tfvars` "just for now".** State files
  also leak them — see [07](07-state-management.md).
* ❌ **Adding `--allow-secret` to bypass scanners.** That's how real
  secrets get through.

## Pipelines & CI/CD

* ❌ **`apply` directly without an explicit `plan` artifact.** What was
  reviewed is not necessarily what was applied.
* ❌ **`continue-on-error: true`** to "make the build green" while
  investigating. Permanent.
* ❌ **`pull_request_target` with checkout of PR code from forks.**
  Privilege escalation vector.
* ❌ **`cancel-in-progress: true` on the deploy concurrency group.** An
  in‑flight `apply` should never be cancelled.
* ❌ **One pipeline that deploys all environments serially.** Use proper
  environment gates between non‑prod and prod.
* ❌ **Per‑repo bespoke workflows.** Drift within a quarter. Use reusable
  workflows.
* ❌ **No drift detection.** You're flying blind.

## Modules & registries

* ❌ **Inlined modules duplicated between landing zones.** "We'll DRY it
  later" never comes.
* ❌ **A "kitchen sink" module** with 80 boolean toggles. Split it.
* ❌ **Calling AVM resource modules directly from landing‑zone code.** No
  place to enforce enterprise opinions.
* ❌ **Wrapping AVM with a module that adds nothing.** Just call AVM
  directly.
* ❌ **Releasing a major version without a `MIGRATION.md`.** Consumers
  can't safely upgrade.
* ❌ **Pinning to a branch name** (`?ref=main`). "Worked yesterday".

## State management

* ❌ **State backend in the same subscription as the resources it
  manages.** A bad apply could nuke its own state storage. Separate sub.
* ❌ **State on engineer laptops.** Even in dev. Especially in dev.
* ❌ **`terraform_remote_state` cross‑references that leak producer
  secrets to consumers.** Use App Configuration outputs.
* ❌ **Editing state files by hand.** Even with `jq`.
* ❌ **Running `force-unlock` reflexively when a lock appears.**
  Investigate first — the previous run might still be applying.
* ❌ **Bicep prod deployments without Deployment Stacks.** No drift
  protection, no managed‑resources tracking.

## Testing & policy

* ❌ **All policy lives at PR time.** Anyone clicking in the portal
  bypasses your controls.
* ❌ **All policy lives in Azure Policy.** Developers find out at deploy
  time after a 15‑min plan. Move what you can earlier.
* ❌ **`soft_fail: true` on Checkov to "fix later".** Later never comes.
* ❌ **Integration tests against a shared sub with hard‑coded names.**
  Two PRs collide → both fail.
* ❌ **45‑minute test suites.** Engineers will avoid them. Trim or
  parallelise.
* ❌ **Custom rules in Rego when a built‑in PSRule rule exists.** Reinvented
  wheels rust.

## Code quality / DX

* ❌ **README that says "install Terraform 1.x"** without pinning.
* ❌ **Linters that produce warnings nobody reads.** Either fail the
  build or remove them.
* ❌ **Module READMEs written by hand.** Drift in one PR.
* ❌ **`make apply` that works against prod from a laptop.** Pipeline‑only.
* ❌ **Devcontainer that nobody uses.** Make it the only path or it dies.

## Manageability / day‑2

* ❌ **CODEOWNERS = `@org/everyone`.** Reviews become rubber stamps.
* ❌ **Resource locks that the pipeline SPN bypasses without anyone
  noticing.** Theatre.
* ❌ **No decommission process.** Subscriptions accumulate forever.
* ❌ **Runbooks in a wiki nobody can find at 2 a.m.** Keep them with the
  code.
* ❌ **Engineers fixing prod by editing in the portal "just this once".**
  Either it goes through code or your code is no longer authoritative.
* ❌ **Drift alerts that nobody triages.** Either set an SLA or remove
  the alert.

## Naming & tagging

* ❌ **Inventing your own resource abbreviations.** Use Microsoft's CAF
  list.
* ❌ **Free‑text tags** (`Owner: "John (he sits next to Sara)"`). Tags are
  data.
* ❌ **`Environment` values that drift** (`Prod`, `prod`, `Production`).
  Pick canonical values; deny the rest.
* ❌ **Required tags enforced only by training docs.** Enforce with
  policy.
* ❌ **Naming module added "later".** Names are the hardest thing to
  refactor.

## Documentation

* ❌ **Wiki‑only documentation** (Confluence, SharePoint). Decays fast,
  can't be PR‑reviewed.
* ❌ **Architecture diagrams in proprietary binary formats.** No diff, no
  merge.
* ❌ **TODO comments instead of issues.** Go unread.
* ❌ **One giant `docs/all.md`.** Split.
* ❌ **Documenting implementation rather than design.** Code is the
  implementation; docs explain *why*.

## Operational

* ❌ **Pager configured but no on‑call rota.** Alerts go nowhere at 2 a.m.
* ❌ **No SLO on time‑to‑production for a typical PR.** Improvement is
  invisible without a baseline.
* ❌ **No mechanism to retire old subscriptions.** Cost balloons silently.
* ❌ **No fire drills** for state recovery, credential leak, full‑estate
  outage. The first time you do it should not be in production.

---

Working through this list is most useful not as a one-time audit but as a recurring exercise — quarterly for a mature platform, monthly when the estate is growing quickly. When you find an anti-pattern you are currently living with, resist the temptation to note it privately and move on. Open an issue, assign an owner, and track its remediation alongside everything else the team ships. The self-assessment below gives you a structured framework for that conversation — a score honest enough to be useful and specific enough to drive action.

## A "is your repo healthy?" self‑assessment

Score yourself out of 20:

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

---

[← 13 Documentation](13-documentation.md) · [Index](../README.md) · [References →](references.md)
