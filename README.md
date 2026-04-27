# Azure Landing Zones – Infrastructure-as-Code Repository Best Practices

> A field guide for **DevOps architects** and **platform engineers** designing the
> Git repositories, pipelines, and operating model that will deliver an Azure
> Landing Zone (ALZ) implementation at enterprise scale.

This guide is **opinionated but balanced**: every chapter focuses on the
*design decisions* you have to make, the *tradeoffs* of each option, and a
*recommendation* for the typical enterprise scenario. Anti-patterns are called
out explicitly.

---

## Why this guide exists

When the first Azure Landing Zone accelerators appeared in 2020–2021, most enterprise teams focused on the *content* of the landing zone: which policies to apply, how to structure management groups, which connectivity model to adopt. The *repository* that would host and maintain that content was treated as an afterthought — a place to put ARM templates or Terraform files before the real work began. Years later, those same teams found the infrastructure code was solid but the operational model around it had accumulated technical debt that was genuinely hard to pay down: long-lived pipeline secrets that could not be rotated without downtime, state files covering entire environments with no blast-radius control, naming conventions that existed only in a Confluence page nobody had updated since 2022, and modules copy-pasted so many times that fixing a bug meant finding every copy first.

This guide exists to address the repository and operating model — not the policy library or the network topology, but the decisions that determine whether your ALZ implementation remains manageable at year three as much as at day one. It draws on official Microsoft guidance, community patterns from the IaC ecosystem, and the lessons of platform engineering teams that have operated Azure estates at enterprise scale. The "How we got here" narratives at the start of each chapter trace how the industry's tooling and thinking evolved to produce the current best practices — so you understand not just *what* to do, but *why* the field landed there.

It is written for platform engineers and DevOps architects who are either building a new ALZ implementation or inheriting one that needs to be brought up to a higher standard. If you are starting fresh, read the chapters in order. If you are inheriting an existing estate, start with the TL;DR below and Chapter 14 — the anti-pattern checklist is the fastest way to identify where the most pressing technical debt lives.

---

## How to read this guide

The chapters are loosely ordered from "high‑level strategy" to
"day‑2 operations". You can read them in order, or jump straight to the
decision you are wrestling with – every page links to its neighbours.

| # | Topic | Decision in one sentence |
|---|-------|--------------------------|
| 01 | [Repository topology – monorepo vs multi‑repo](docs/01-repository-topology.md) | How many Git repositories, and what goes in each? |
| 02 | [IaC tooling – Bicep, Terraform, ARM, Pulumi](docs/02-iac-tooling.md) | Which language/engine for which layer of the platform? |
| 03 | [Module & registry strategy (AVM, ALZ modules)](docs/03-modules-and-registries.md) | Where do reusable modules live and how are they versioned? |
| 04 | [Branching, environments & promotion](docs/04-branching-and-environments.md) | How does a change flow from a developer laptop to prod? |
| 05 | [Authentication & identity for pipelines](docs/05-authentication.md) | OIDC, federated credentials, MIs, service principals. |
| 06 | [Secrets & supply‑chain security](docs/06-security.md) | Secrets handling, signed commits, SBOMs, dependency hygiene. |
| 07 | [State management (Terraform & deployment stacks)](docs/07-state-management.md) | Backends, locking, blast‑radius, drift. |
| 08 | [CI/CD pipeline patterns](docs/08-cicd-pipelines.md) | GitHub Actions vs Azure DevOps; PR vs deploy workflows. |
| 09 | [Testing, validation & policy‑as‑code](docs/09-testing-and-policy.md) | what‑if, plan, PSRule, Conftest, OPA, Checkov. |
| 10 | [Code quality, linting & developer experience](docs/10-code-quality.md) | Pre-commit hooks, formatters, devcontainers. |
| 11 | [Manageability & day‑2 operations](docs/11-manageability.md) | Drift, blast radius, ownership (CODEOWNERS), runbooks. |
| 12 | [Naming, tagging & metadata conventions](docs/12-naming-and-tagging.md) | The boring stuff that breaks everything if you skip it. |
| 13 | [Documentation & onboarding](docs/13-documentation.md) | ADRs, READMEs, diagrams-as-code. |
| 14 | [Anti-patterns & common pitfalls](docs/14-anti-patterns.md) | A checklist of things you will regret. |

A consolidated list of external references is in
[`docs/references.md`](docs/references.md).

---

## Scope and assumptions

* **Target audience:** platform engineering teams shipping an ALZ implementation
  to one or more Azure tenants for an enterprise IT estate.
* **Definition of "ALZ":** the Microsoft Azure Landing Zones conceptual
  architecture (management groups, policies, platform subscriptions, application
  landing zones). See the
  [Cloud Adoption Framework – Landing Zone docs][caf-alz].
* **Out of scope:** application‑level CI/CD, AKS cluster patterns, Azure
  Policy authoring (referenced but not deep‑dived), and the underlying
  networking topology (covered only where it affects repository design).

[caf-alz]: https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/

---

## A quick TL;DR for the impatient

If you take nothing else from this guide:

1. **Separate "platform" from "application landing zones"** at the repository
   level. Mixing them is the single biggest source of long‑term pain.
2. **Use OIDC federated credentials** for all pipeline auth. Never store an
   Azure secret in a CI/CD variable in 2026.
3. **Pin every module by version**, never by `main`. Use semantic versioning
   and a private registry (or git tags) as the source of truth.
4. **Treat policy as the API contract** between the platform team and
   application teams – not as a guard‑rail bolted on later.
5. **Keep the blast radius of any single `apply` small.** One state file per
   environment per workload, not one giant state file for the whole tenant.

The rest of this repo explains *why*.

---

## Contributing

This is a living document. Open a PR with proposals; substantive changes are
expected to come with an [ADR](docs/13-documentation.md#architecture-decision-records).

## License

Content is published under [MIT](LICENSE) – use it, fork it, ship it.
