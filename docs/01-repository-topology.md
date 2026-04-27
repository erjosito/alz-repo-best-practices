# 01 · Repository topology — monorepo vs multi‑repo

> **Decision:** how many Git repositories will host your ALZ IaC, and what
> belongs in each?

[← Back to index](../README.md) · Next → [02 IaC tooling](02-iac-tooling.md)

---

## How we got here

In the early 2010s, when "infrastructure as code" still mostly meant Chef
cookbooks and Puppet manifests, the natural home was a single SVN or Git
repo per project. Then the **microservices wave** of 2014–2017 cargo‑culted
the same fragmentation onto infrastructure: every service got its own
repo, its own Terraform state, its own pipeline. Within a couple of years,
"how do I bump the VPC module across 80 repos?" became a recurring
LinkedIn post. By the late 2010s the pendulum swung the other way as
Google, Facebook, and Microsoft published essays on the productivity
benefits of monorepos backed by purpose‑built tooling (Bazel, Buck,
Source Depot). For IaC specifically, the Terraform community discovered
that **Git submodules don't fix the problem** and that **module registries
do** (Terraform Registry, then private registries, then OCI). Today most
mature ALZ implementations live in a *small number* of carefully chosen
repos — neither a single behemoth nor an unmanageable swarm — and that's
the option this chapter recommends.

## Why this is the first decision you make

Repository topology drives almost every other choice in this guide:
permissions, pipelines, branching, module versioning, and even who is on call
for what. Get it wrong and you will spend the next two years either drowning
in cross‑repo PRs or watching a single broken pipeline freeze the entire
estate.

Two extreme positions exist, with a sensible middle ground:

| Option | One‑liner |
|--------|-----------|
| **Pure monorepo** | One repo holds management groups, policies, platform, and every application landing zone. |
| **Pure multi‑repo** | Every workload, module, and platform component lives in its own repo. |
| **Layered "few‑repo" (recommended)** | A small, fixed number of repos aligned to ownership boundaries. |

---

## The three layers of an ALZ estate

Almost every ALZ implementation has these natural layers. Whether each is a
folder or a repo is the question:

```
┌─────────────────────────────────────────────────────────────┐
│  L1  Foundation     management groups, policies, RBAC       │
│      (rare changes, tenant-wide blast radius)               │
├─────────────────────────────────────────────────────────────┤
│  L2  Platform       hub network, identity, mgmt, security   │
│      (monthly changes, platform team owns)                  │
├─────────────────────────────────────────────────────────────┤
│  L3  Landing zones  per-app subscription "vending"          │
│      (daily changes, application teams contribute)          │
└─────────────────────────────────────────────────────────────┘
```

Below this sits **L0 — shared modules** (AVM consumption / wrappers), which is
arguably its own repo with its own release cadence.

---

## Option A — Pure monorepo

**Layout sketch**

```
alz/
├── foundation/        # mgmt groups, policy assignments
├── platform/
│   ├── connectivity/  # hub VNets, ER, firewall
│   ├── identity/
│   └── management/    # log analytics, automation
├── landingzones/
│   ├── corp-app01/
│   └── online-app42/
├── modules/           # local module library
└── .github/workflows/
```

### ✅ Pros
* **Atomic cross‑layer changes.** "Add a new region" can be one PR that
  touches policy, hub, and a workload simultaneously.
* **Single source of truth** for naming conventions, tags, module versions.
* **Easy refactoring** with codebase‑wide search/replace and IDE rename.
* **One pipeline framework** to maintain.

### ❌ Cons
* **Permissions are coarse.** GitHub repo roles apply to the whole repo;
  fine‑grained access requires CODEOWNERS + branch protection gymnastics.
* **Pipeline scaling.** A naive workflow that runs `terraform plan` on the
  whole repo on every PR becomes unusable past ~50 workloads. You **must**
  invest in path filters and matrix builds early.
* **Blast radius psychology.** Engineers see the foundation code next to their
  app code and either get scared to commit or, worse, don't.
* **Single CODEOWNERS becomes a 500‑line file** that nobody reviews.

### When it works
Small estates (<10 application landing zones), one platform team, no strict
separation of duties between platform and application teams.

---

## Option B — Pure multi‑repo

Every workload, every module, every policy set in its own repo.

### ✅ Pros
* **Crystal‑clear ownership** — repo = team = on‑call rotation.
* **Independent release cadence.** Workload A deploys 10× a day; the
  foundation deploys quarterly. Each gets the cadence it needs.
* **Smallest possible blast radius** per pipeline run.
* **Simple permissions** — GitHub team → repo mapping is 1:1.

### ❌ Cons
* **Cross‑cutting changes are nightmarish.** Bumping a module version across
  60 repos = 60 PRs, 60 reviews, 60 pipeline runs (Renovate/Dependabot helps,
  doesn't eliminate).
* **Drift between repos.** Conventions, pipeline templates, even tool versions
  diverge. You end up needing a "templates" repo + scaffolding tool
  (cookiecutter, Backstage, `gh repo template`) just to keep them aligned.
* **Discoverability suffers.** New engineers ask "where is X?" constantly.

### When it works
Very large estates (100+ landing zones), strong platform engineering investment
in a self‑service portal/scaffolding (Backstage, internal CLI), strict
regulatory separation between teams.

---

## Option C — Layered "few‑repo" (recommended default)

The pragmatic compromise. **Three to five repos**, aligned to the natural
ownership boundaries:

| Repo | Owner | Cadence | Typical blast radius |
|------|-------|---------|----------------------|
| `alz-foundation` | Cloud governance | Quarterly | Tenant |
| `alz-platform` | Platform engineering | Weekly | Platform subs |
| `alz-modules` | Platform engineering | On change (semver) | None (artifact only) |
| `alz-landingzones` *or* one repo per business unit | App teams + platform reviewers | Daily | One subscription |
| `alz-policies` (optional) | Security/governance | Weekly | Tenant policy |

### ✅ Pros
* Ownership boundaries match real‑world team boundaries.
* Each repo has a *coherent* CODEOWNERS, branch protection, and approval
  policy.
* Module repo can publish to a registry (ACR / Terraform Cloud / private
  registry) and consumers pin versions — see
  [03 modules & registries](03-modules-and-registries.md).
* Foundation repo can require *much* stricter controls (mandatory pair review,
  manual approval, change‑advisory ticket reference) without slowing daily
  workload deployments.

### ❌ Cons
* Cross‑repo refactors still require coordination — but they are rare by
  construction (foundation rarely changes).
* Need a shared **pipeline template repo** (`alz-pipeline-templates`) or
  reusable workflows so the four repos don't drift in their CI definitions.

### When it works
**This is the right answer for ~80 % of enterprise ALZ implementations.**

---

## Decision framework

Ask these questions in order:

1. **How many teams will commit to IaC?**
   * 1 team → monorepo is fine.
   * 2–10 teams → layered few‑repo.
   * 10+ teams → layered few‑repo with one landing‑zone repo per business unit,
     or full multi‑repo if you have the platform investment.

2. **What is your regulatory posture?**
   * If auditors require separation of duties between *who can change policy*
     and *who can deploy workloads* → at minimum split foundation/policy from
     workloads.

3. **Do you have a self‑service developer portal?**
   * Yes (Backstage, internal CLI) → multi‑repo becomes viable.
   * No → stay layered; the discovery cost of multi‑repo is too high.

4. **What is the deployment frequency of each layer?**
   * Wildly different cadences → split repos. Putting a quarterly‑changing
     foundation in the same pipeline trigger as daily workloads is friction.

---

## Anti‑patterns

* ❌ **One mega‑repo with one giant Terraform state.** A single
  `terraform apply` that touches every subscription. The blast radius of a
  bad commit is the entire estate. See
  [07 state management](07-state-management.md).
* ❌ **One repo per resource group.** Granularity gone mad — you'll spend
  more time on repo plumbing than on infrastructure.
* ❌ **"Modules" folder duplicated across 40 repos.** Promote to a shared
  module repo + registry the moment you have *any* duplication.
* ❌ **Mixing application code (Helm charts, app source) in the IaC repo.**
  Different release cadence, different reviewers, different security model.

---

## Reference layouts

### Recommended starter layout (`alz-platform`)

```
alz-platform/
├── README.md
├── CODEOWNERS
├── docs/                    # ADRs, diagrams
├── envs/
│   ├── prod/
│   │   ├── connectivity/
│   │   ├── identity/
│   │   └── management/
│   └── nonprod/
│       └── ...
├── modules/                 # thin wrappers around AVM
├── policies/                # custom policy definitions (if any)
├── scripts/
└── .github/
    ├── workflows/
    └── CODEOWNERS
```

### Recommended starter layout (`alz-landingzones`)

```
alz-landingzones/
├── README.md
├── CODEOWNERS               # per-folder ownership
├── _shared/                 # naming, tagging modules
├── corp/
│   ├── app01-prod/
│   ├── app01-nonprod/
│   └── app02-prod/
├── online/
│   └── ...
└── .github/workflows/
```

`CODEOWNERS` uses path globs so each landing zone has its own approvers:

```
/corp/app01-* @org/team-app01
/corp/app02-* @org/team-app02
/_shared/     @org/platform-engineering
```

---

## References

* Microsoft, *CAF — Landing zones implementation options*:
  <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/implementation-options>
* Microsoft, *ALZ Bicep — recommended repo structure*:
  <https://github.com/Azure/ALZ-Bicep/wiki>
* Hashicorp, *Recommended Terraform code structure*:
  <https://developer.hashicorp.com/terraform/cloud-docs/recommended-practices>
* GitHub, *Monorepo vs polyrepo*:
  <https://github.blog/engineering/architecture-optimization/monorepo-vs-polyrepo/>

---

[← Back to index](../README.md) · Next → [02 IaC tooling](02-iac-tooling.md)
