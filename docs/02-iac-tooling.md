# 02 · IaC tooling — Bicep, Terraform, ARM, Pulumi

**In this chapter:**

- [How we got here](#how-we-got-here)
- [Decision framework](#decision-framework)
- [Summary recommendation](#summary-recommendation)
- [The contenders](#the-contenders)
- [Mixing engines — when, and how to survive it](#mixing-engines-when-and-how-to-survive-it)
- [Example — same resource in both engines](#example-same-resource-in-both-engines)
- [Anti‑patterns](#antipatterns)
- [References](#references)


> **Decision:** which IaC engine for which layer of the platform?
> A monolingual estate is simpler; a bilingual estate is sometimes correct.

[← 01 Repository topology](01-repository-topology.md) · [Index](../README.md) · [03 Modules & registries →](03-modules-and-registries.md)

Pick one primary Infrastructure as Code (IaC) engine per Azure Landing Zone (ALZ) layer, and default to the tool your team can operate confidently under pressure. For Azure-only greenfield estates, **Bicep + Deployment Stacks** is now a first-class default; for brownfield, multi-cloud, or Terraform-skilled teams, **Terraform with AzureRM/AzAPI** remains the safer operational bet. Keep platform and landing-zone code on the same engine unless you have a documented boundary and a specific reason to go bilingual. Do not choose on syntax aesthetics alone — choose on ownership, state tolerance, review quality, and who will maintain the estate at 2 a.m. Read on if you need to justify Bicep versus Terraform, decide whether Pulumi fits your team, or survive a mixed-engine ALZ without drift wars.

---

## How we got here

Bicep and Terraform are both first‑class Azure choices now, and the history matters because it explains why state, plan quality, and team familiarity still dominate the decision. The first wave of "Azure as code" was bash scripts wrapping `azure-cli` (then `az`), often committed alongside README sentences like *"run these in order, don't forget to set the subscription"*. Microsoft launched **Azure Resource Manager (ARM) JSON templates** in 2014 — a genuine declarative model, but the syntax made grown engineers cry. The same year, HashiCorp shipped Terraform; the **AzureRM provider** (2016) gave multi‑cloud teams a sane authoring experience and a real `plan` diff, and quickly became the default in enterprises.

That early Terraform lead explains why this decision still cannot be reduced to syntax. Microsoft responded with **Bicep** (public preview 2020, GA 2021) — essentially "ARM JSON, but lovable" — and then with **Deployment Stacks** (GA 2024) to close the state‑management gap that pushed many teams to Terraform in the first place. **Pulumi** (2018) bet on real programming languages and found a loyal niche but never displaced Terraform for ops‑led teams. Today the honest answer to "Bicep or Terraform?" is "whichever your team will still be operating well at 2 a.m." — both are first‑class on Azure in 2026, so the next step is to decide which lifecycle your team can actually own.

---

## Decision framework

That history leads to a practical rule: use the engine your operators can own for the full lifecycle, and treat mixed engines as an exception that needs an explicit boundary. Answer these questions in order before debating syntax or ecosystem preferences.

1. **Start with skills already on the team.** The single best predictor of long‑term success is whether the team already operates the tool well; a team fluent in Terraform will ship a better Terraform ALZ than a Bicep one even if Bicep is "theoretically" simpler for Azure‑only.

2. **Choose Bicep for pure Azure with no SaaS configuration.** Pure Azure, no SaaS configuration → **Bicep** is hard to argue against.

3. **Choose Terraform when the estate crosses Azure's boundary.** Any non‑Azure resources (GitHub, Entra B2B, Datadog, AWS DR site) → **Terraform**.

4. **Choose Bicep + Deployment Stacks when separate state is unacceptable.** If your operating model cannot accept a separate state store (security review, operational burden, blob/Cosmos availability concerns), Bicep + Deployment Stacks removes that burden entirely.

5. **Use AzAPI when Terraform needs same‑day Azure features.** Bicep reaches new Azure features the same day as the ARM REST API; Terraform AzureRM can lag by weeks or months; Terraform AzAPI is same day, at the cost of writing ARM‑shaped HCL.

6. **Prefer Terraform when PR review depends on the strongest plan output.** `terraform plan` is more accurate than `az deployment what-if` today, although the gap has narrowed considerably with Bicep's [`what-if` improvements](https://learn.microsoft.com/azure/azure-resource-manager/templates/deploy-what-if).

Quick reference by operating context:

| Context | Lead recommendation | Why |
|---------|---------------------|-----|
| Azure‑only greenfield | **Bicep + Deployment Stacks** | Native Azure, no separate state store, same‑day ARM API access. |
| Existing Terraform or multi‑cloud estate | **Terraform AzureRM/AzAPI** | Existing skills, reviewable `plan`, providers for Azure and non‑Azure systems. |
| Strong software‑engineering culture with cross‑cloud needs | **Pulumi** | Real programming languages and normal unit‑test frameworks. |
| Legacy ARM templates | **Decompile to Bicep** | ARM JSON remains a transport format, not a 2026 authoring target. |

If the framework still leaves you genuinely split — often because different platform layers are owned by teams with different skill sets — read the tool analysis first, then treat a bilingual estate as an explicit exception rather than the default.

---

## Summary recommendation

Because the framework is intentionally concise, the chapter needs a summary baseline before it goes deep: use Bicep or Terraform for the core ALZ layers, keep the choice consistent within a layer, and reserve ARM JSON and Pulumi for narrow cases. The short version below sets that baseline before the chapter goes deeper into each tool's strengths and failure modes:

| Layer | Recommended | Acceptable alternative |
|-------|-------------|------------------------|
| Foundation (mgmt groups, policy assignments) | **Bicep + Deployment Stacks** *or* **Terraform AzureRM/AzAPI** | ARM templates (legacy) |
| Platform (hub, identity, mgmt) | **Bicep** *or* **Terraform** — pick one and stick to it | — |
| Landing zones (workloads) | Same engine as platform | Mixed only with strong justification |
| Multi‑cloud workloads | **Terraform** or **Pulumi** | — |

The table deliberately puts ownership ahead of aesthetics, because the biggest mistake is choosing a tool for how pleasant it looks in a pull request rather than for *who maintains what tomorrow*. The right answer is whichever your engineers can operate confidently at 2 a.m.

> ⚖️ **The debate — is "team skill" really the deciding factor?**
>
> The "2 a.m." framing is popular advice, but critics argue it
> understates real structural differences between the tools.
>
> **The Bicep case beyond skills:** Bicep + Deployment Stacks eliminates
> an entire class of operational problems — state corruption, state
> surgery, backend lock contention, `terraform_remote_state` coupling —
> that affect even skilled Terraform operators. A mediocre team on Bicep
> may produce *safer* infrastructure than a good team on Terraform,
> simply because fewer things can go catastrophically wrong at 2 a.m.
>
> **The Terraform case beyond skills:** `terraform plan` output is
> genuinely more reliable for code review than `az deployment what-if`
> (which still has known gaps). Terraform's ecosystem of third‑party
> providers means you manage GitHub repos, Datadog monitors, PagerDuty
> schedules, and Azure resources in one workflow — Bicep can't. And for
> teams already running Terraform, migration cost is real and rarely
> justified by Bicep's simplicity alone.
>
> **Where the industry stands (2026):** Azure‑only greenfield projects
> increasingly default to Bicep; brownfield and multi‑cloud estates stay
> on Terraform. The "skills" heuristic is a useful tiebreaker, but
> pretending the tools are interchangeable undersells the architectural
> implications of each choice.

That disagreement is useful rather than academic, because it frames the tool-by-tool analysis that follows: each engine has a different failure mode, and your choice should make that failure mode explicit before you standardise on it.

---

## The contenders

With the recommendation baseline established, the real defaults for ALZ are Bicep and Terraform; ARM is now legacy authoring, Pulumi remains a specialist choice, and accelerators are scaffolding that help you start without deciding the engine for you. Looking at the contenders in that order makes the tradeoffs easier to compare, because the first two are tools you can run an estate on, while the latter cases are constraints around migration, team culture, and bootstrap.

### Bicep

Bicep is the strongest fit for Azure‑only estates that value native API coverage and do not want to manage a separate state file. It is Microsoft's first‑party domain-specific language (DSL), and it transpiles (compiles from one high‑level language to another) to ARM JSON.

**Strengths**
* Native Azure — every resource and API version is available *day one*.
* No state file to manage. Azure Resource Manager is the source of truth.
* **Deployment Stacks** (GA) give a Terraform‑like "what is managed by this
  deployment" model with `denySettings` for drift protection.
* Tight integration with `az deployment` and AVM (Azure Verified Modules).
* Excellent VS Code experience: type checking, intellisense, decompile from
  ARM.

**Weaknesses**
* Azure‑only. Useless for AWS/GCP, third‑party SaaS, GitHub, Datadog, etc.
* Looping/conditionals are less expressive than HCL (HashiCorp Configuration
  Language) or general‑purpose languages.
* Smaller community ecosystem of modules (though AVM closes the gap).
* `what-if` is powerful but has rough edges with complex resources
  (RBAC role assignments, child resources). Validate empirically.

### Terraform (with AzureRM and/or AzAPI providers)

Where Bicep optimises for Azure-native simplicity, Terraform is the safer choice when you need multi‑cloud reach, third‑party providers, or the strongest reviewable plan workflow. It remains the de‑facto multi‑cloud standard, which is why many brownfield ALZ estates stay with it even when Bicep would be technically sufficient for the Azure resources alone.

**Strengths**
* Huge ecosystem — providers for everything (Azure, AWS, GCP, GitHub, Azure
  DevOps, AAD/Entra, Datadog, Cloudflare…).
* `plan` produces a clear, reviewable diff — gold standard for PR workflows.
* HCL is mature and expressive (functions, dynamic blocks, for_each).
* Strong testing story (terratest, native `terraform test`).
* **AzAPI provider** closes the "new Azure feature" gap by calling the ARM REST
  API directly when AzureRM lags.

**Weaknesses**
* **State management is your problem.** Backends, locking, secrets in state,
  state surgery — all real operational concerns. See
  [07 state management](07-state-management.md).
* AzureRM provider sometimes lags new Azure features (mitigated by AzAPI).
* OpenTofu fork (post‑BSL licence change) is now production‑viable; choosing
  between Terraform and OpenTofu is a fresh decision in 2026.

> 📘 **BSL (Business Source Licence)** — in August 2023 HashiCorp relicensed Terraform from the permissive MPL 2.0 to the BSL 1.1, which restricts competitive commercial use. **OpenTofu** is the community fork that continues under the original open‑source licence.

### ARM (JSON)

ARM JSON is the original Azure declarative format, but in a modern ALZ it should remain a transport or migration format rather than hand‑authored platform code. You still benefit from its universality because Bicep compiles to it and existing deployments can be decompiled from it, yet that does not make it a pleasant or defensible authoring target in 2026.

**Strengths**
* Universally supported. Always works, no tooling required.
* Useful as a *transport format* — Bicep compiles to it; you can decompile
  existing deployments.

**Weaknesses**
* Authoring ARM JSON by hand in 2026 is an anti‑pattern. Use Bicep.

### Pulumi

Pulumi belongs in the conversation only when your platform team has the software‑engineering discipline to review infrastructure as program code. It gives you IaC in real programming languages such as TypeScript, Python, Go, and C#, which is powerful when the team can keep infrastructure intent visible through ordinary code review and dangerous when the code becomes an application in disguise.

**Strengths**
* Real language → unit tests with normal frameworks, complex logic, IDE.
* Cross‑cloud with one mental model.

**Weaknesses**
* Smaller community than Terraform.
* Conflates infrastructure and program logic — easy to write code that's hard
  to review as a "diff".
* Best suited to teams with a strong software‑engineering culture; less ideal
  for Ops‑background platform teams.

### ALZ accelerators

ALZ accelerators are best treated as a bootstrap mechanism for the repo and pipeline, after which you take ownership of the generated codebase. They are not an engine choice by themselves; instead, they give you a production-grade CI/CD pipeline, state storage or Deployment Stack parameters, managed identities, and an opinionated folder structure so you do not start from a blank repo. Understanding what each accelerator does — and what it *doesn't* do — matters because the accelerator's output becomes the codebase you will maintain for years.

> 📘 **Key terms**
>
> **ALZ accelerator** — an automation package that provisions the
> scaffolding (repos, pipelines, identities, state storage) needed to
> deploy an Azure Landing Zone via IaC. The accelerator is a *bootstrap*;
> the AVM modules it references are the *implementation*.
>
> **Bootstrap phase** — the one‑time setup that creates the version
> control repo, CI/CD pipelines, managed identities (with federated
> credentials for OIDC), and Terraform state storage accounts. All
> accelerators use a PowerShell module (`ALZ-PowerShell-Module`) for
> this step, regardless of whether the resulting IaC is Bicep or
> Terraform.

#### ALZ Bicep accelerator (AVM‑based)

The Bicep accelerator replaces the classic `Azure/ALZ-Bicep` repo, which is entering extended support and will be archived in February 2027. That matters because new Bicep ALZ implementations should start from the AVM-based path rather than from the classic repository.

| Aspect | Detail |
|--------|--------|
| **Input** | Interactive questionnaire via ALZ PowerShell module: target management‑group hierarchy, connectivity model (hub‑spoke or vWAN), regions, policy defaults, VCS choice (GitHub / Azure DevOps). |
| **Bootstrap** | Terraform provisions: a Git repo, CI/CD pipelines (GitHub Actions or ADO Pipelines), managed identities with OIDC federation, and storage accounts for Deployment Stack parameters. |
| **Output** | A ready‑to‑run repo containing AVM Bicep pattern modules (≈16 resource + 3 pattern modules), YAML‑driven configuration for management groups, policies, and connectivity, plus pipeline definitions that deploy via Deployment Stacks. |
| **Day‑2 workflow** | Edit YAML config or Bicep parameters → PR → pipeline runs `what-if` → merge → pipeline deploys via `az stack sub create`. |

#### ALZ Terraform accelerator (AVM‑based)

The Terraform accelerator follows the same pattern for Terraform estates: it replaces the classic `Azure/terraform-azurerm-caf-enterprise-scale` module, which is entering extended support and will be archived in August 2026. If you are starting today, the AVM-based accelerator is the path you should standardise on.

| Aspect | Detail |
|--------|--------|
| **Input** | Same PowerShell questionnaire: hierarchy, connectivity model, regions, VCS. Additionally: backend choice (azurerm storage), Terraform/OpenTofu version preference. |
| **Bootstrap** | Terraform provisions: a Git repo, CI/CD pipelines, managed identities with OIDC, a storage account for state, and a starter Terraform root module consuming AVM modules. |
| **Output** | A repo with a root module referencing AVM Terraform resource and pattern modules, `.tfvars` per environment, and pipeline definitions that run `terraform plan` on PR and `terraform apply` on merge. |
| **Day‑2 workflow** | Edit `.tf` / `.tfvars` → PR → pipeline runs `plan` + policy checks → merge → pipeline runs `apply`. |

#### ALZ Portal accelerator

| Aspect | Detail |
|--------|--------|
| **Input** | Browser‑based wizard at [aka.ms/alz/portal](https://aka.ms/alz/portal): click‑through selections for management groups, policies, connectivity, and identity. |
| **Bootstrap** | ARM deployment directly from the portal — no local tooling required. |
| **Output** | Deployed Azure resources (management groups, policies, hub network) in your tenant. **No repo, no pipeline, no IaC artifacts.** |
| **Day‑2 workflow** | None — portal‑deployed resources are not under source control. |

The portal accelerator is useful for **demos, proof‑of‑concept, and
learning** the ALZ architecture. It is **not suitable for production
GitOps** because there is no IaC to review, version, or roll back. If
you start here, plan to re‑deploy via Bicep or Terraform before
going live.

#### ALZ PowerShell module

The PowerShell module (`Azure/ALZ-PowerShell-Module`) is not a
standalone accelerator — it is the **bootstrap engine** used by both the
Bicep and Terraform accelerators. It collects configuration via an
interactive questionnaire, then invokes Terraform to provision the VCS
repo, pipelines, identities, and state storage. You can also run it
non‑interactively with a parameter file for repeatable bootstraps.

#### What all accelerators share

* **Opinionated defaults aligned to CAF** — management‑group hierarchy,
  default policy assignments, hub network topology.
* **AVM modules under the hood** — the accelerators don't invent their
  own resource definitions; they compose AVM resource and pattern modules.
* **You own the output.** The accelerator is a one‑time scaffold. Once
  the repo exists, you maintain it — updating AVM module versions,
  customising policies, adding landing zones. The accelerator doesn't
  "phone home" or auto‑update.
* **Interactive mode** — Running `Deploy-Accelerator` with no parameters
  launches a guided, interactive questionnaire that walks you through
  every decision. No need to craft a parameter file upfront.

Because that output becomes your long-lived platform code, you should **fork or wrap** the accelerator output rather than consume it raw. The module ownership and registry patterns covered in [03 modules & registries](03-modules-and-registries.md) are what let you keep that scaffold maintainable after the bootstrap phase is over.

> 🎥 **From the ALZ Weekly Questions** — [How to use AVM in ALZ, Bicep or Terraform?](https://www.youtube.com/watch?v=ry39tWr_SXc)
> As of early 2025, AVM is the **only** recommended module set for new ALZ deployments. The Bicep AVM accelerator now uses Deployment Stacks natively, giving Bicep parity with Terraform's state‑based lifecycle management.

#### SMB and right‑sized scenarios

Not every organisation needs the full three‑subscription, multi‑region ALZ layout. The accelerator now ships **SMB (small and medium business) scenarios** that drastically reduce Day‑1 cost and complexity:

| Setting | Full ALZ | SMB ALZ |
|---------|----------|---------|
| Subscriptions | 3+ (management, connectivity, identity) | **2** (management + connectivity combined, plus workload) |
| Firewall SKU | Standard or Premium | **Basic** |
| DDoS Protection | On by default | **Off** by default |
| Regions | Multi‑region recommended | **Single region** start |

The SMB scenario uses the **same modules and codebase** — only the `.tfvars` / `.bicepparam` defaults differ. This means you can grow in‑place: upgrading from Basic to Standard firewall, enabling DDoS, or adding a second region is a parameter change, not a repo migration.

> 🎥 **From the ALZ Weekly Questions** — [ALZ for SMB](https://www.youtube.com/watch?v=cyLhLJEYIkU)
> The SMB scenario was purpose‑built for organisations that need governance guardrails without enterprise‑level cost. Start small, grow in‑place.

#### The ALZ library tool (`alzlibtool`)

The accelerator story also depends on the ALZ library, which is a **data layer** separated from business logic — a set of JSON/YAML files that define management‑group archetypes, policy sets, and role assignments. The `alzlibtool` Go module exposes three key commands:

| Command | Purpose |
|---------|---------|
| `alzlib check` | Validates the library files against the schema — catches errors before deployment. |
| `alzlib generate` | Produces the JSON artefacts consumed by the Terraform provider or Bicep modules. |
| `alzlib document` | Auto‑generates human‑readable documentation of the entire policy landscape. |

The same Go module powers both the Terraform ALZ provider and the Bicep generation pipeline. The library is **composable**: you can layer ALZ base + Sovereign Landing Zone (SLZ) + your own local overrides.

> 🎥 **From the ALZ Weekly Questions** — [When to use SLZ over ALZ? + alzlibtool](https://www.youtube.com/watch?v=r8h7F6IJIqw)
> The `alzlibtool` is how both Bicep and Terraform stay in sync with the canonical ALZ policy set. Treat the library as data, the tool as compiler, and your IaC as consumer.

#### Understanding the Bicep file structure

When you move from the library data into the generated Bicep code, the file structure can look more fragmented than you might expect: the accelerator output contains multiple `.bicep` / `.bicepparam` file pairs rather than a single monolithic template. This split is not accidental, because ARM has a **4 MB deployment payload limit**, and a full ALZ deployment exceeds it. The accelerator therefore separates the deployment into files for management groups, policies, connectivity, and other domains, while a future Bicep feature — **extendable parameters** — should eventually allow a single parameter file to feed multiple Bicep files and reduce today's parameter repetition.

> 🎥 **From the ALZ Weekly Questions** — [Understanding ALZ Bicep File Structure](https://www.youtube.com/watch?v=sPA3YWkQ-4s)
> The Bicep modules can also be consumed **standalone**, without the accelerator. If you only need the connectivity module, reference it directly from the AVM registry.

#### Migrating from CAF‑Enterprise‑Scale

That same archive timeline becomes more concrete if you are already running the classic `Azure/terraform-azurerm-caf-enterprise-scale` module, which reaches its archive date on **1 August 2026**. A purpose‑built **Golang state migration tool** helps you move in two phases:

1. **Phase 1 — Connectivity and management resources** (VNets, firewalls, Log Analytics). The tool reads your existing state, maps resources from CAF‑ES module addresses to AVM module addresses, and generates Terraform `import` blocks.
2. **Phase 2 — Management groups and policies.** These are trickier because the policy structure changed between CAF‑ES and AVM. The tool produces an issues CSV listing resources that need manual attention.

The migration tool works from **any CAF‑ES version** — you don't need to be on the latest before migrating. However, older versions produce more entries in the issues CSV, which is why the most pragmatic ALZ-team guidance is to import only resources you cannot easily delete and recreate, such as ExpressRoute circuits, firewalls with BGP sessions, or DNS zones with live records. For management groups and policies, a clean re‑deploy is often easier to reason about, especially when Deployment Stacks can handle the cutover.

> 🎥 **From the ALZ Weekly Questions** — [Migrating from CAF-Enterprise-Scale to AVM](https://www.youtube.com/watch?v=DSBWjQlVpSs)
> The migration tool is also useful outside ALZ — it can recover or restructure any Terraform state file by mapping old module addresses to new ones.

#### Azure Migrate agent for platform landing zones

After the migration path, the newest accelerator-adjacent feature is the preview **Azure Migrate agent**, which builds on top of the accelerator rather than replacing it. Available in the Azure portal and VS Code, it lets you describe your desired landing zone in natural language and generates the accelerator configuration:

* Grounded on CAF and ALZ documentation — recommendations are not hallucinated.
* Uses an **MCP server** for customisation — you can extend it with your own policies or naming conventions.
* Includes **cost estimation** so you can see the monthly impact before deploying.
* Currently **Terraform‑only**; Bicep support is planned.

> 🎥 **From the ALZ Weekly Questions** — [Azure Migrate Agent Preview](https://www.youtube.com/watch?v=kFS9lNPuXxM) and [Azure Migrate Agent Deep Dive](https://www.youtube.com/watch?v=ODaFlsja308)
> The Migrate agent is ideal for initial exploration and configuration generation. For production deployments, always review the generated output before applying.

With all the options on the table, the practical question is which combination actually fits your team and organisation. That question becomes sharper when the answer appears to involve more than one engine, because mixed estates need boundaries as much as they need tooling.

---

## Mixing engines — when, and how to survive it

Avoid bilingual estates unless one of a few specific situations applies, and if you do mix engines, enforce hard ownership boundaries from the start. The previous section showed that Bicep and Terraform are both defensible defaults, but that does not mean you should let them manage the same estate casually.

Bilingual estates usually appear for a practical reason rather than as an architectural ideal:

* Foundation/policy is in **Bicep** (Microsoft accelerator), workloads are in
  **Terraform** because app teams already know it.
* Platform is in **Terraform** (multi‑cloud DR), but a specific workload uses
  **Bicep** because it needs a brand‑new Azure preview feature.

When one of those reasons is strong enough to justify the extra operating model, the rules are simple and non-negotiable:

1. **One engine per resource.** Never let two engines manage the same
   resource — drift wars guaranteed.
2. **Clear boundary at the resource group or subscription level.** Make it
   impossible for the boundary to be ambiguous.
3. **Shared naming/tagging convention.** Both engines must produce identical
   outputs.
4. **Document it loudly** in the top‑level README — every new joiner asks
   "why?".

Those rules are easier to understand when you compare the authoring and deployment workflow side by side, which is why the next section shows the same small resource in both engines without pretending the example alone should decide the estate standard.

---

## Example — same resource in both engines

Use the example as a syntax and workflow comparison, not as a reason to switch engines by itself. The same simple deployment — a virtual network (VNet) with two subnets — looks familiar in both tools, but the operational questions around state, plan output, and API coverage are different enough that the code sample is only a starting point.

### Bicep

```bicep
// modules/network/main.bicep
param location string = resourceGroup().location
param vnetName string
param addressSpace string
param subnets array

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ addressSpace ] }
    subnets: [for s in subnets: {
      name: s.name
      properties: { addressPrefix: s.prefix }
    }]
  }
}

output vnetId string = vnet.id
```

Deploy with:

```bash
az stack sub create \
  --name plat-net-prod \
  --location swedencentral \
  --template-file main.bicep \
  --deny-settings-mode denyDelete \
  --action-on-unmanage deleteAll
```

### Terraform

```hcl
# modules/network/main.tf
variable "location"     { type = string }
variable "vnet_name"    { type = string }
variable "address_space" { type = string }
variable "subnets"      { type = list(object({ name = string, prefix = string })) }

resource "azurerm_virtual_network" "this" {
  name                = var.vnet_name
  location            = var.location
  resource_group_name = var.rg_name
  address_space       = [var.address_space]
}

resource "azurerm_subnet" "this" {
  for_each             = { for s in var.subnets : s.name => s }
  name                 = each.value.name
  resource_group_name  = var.rg_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [each.value.prefix]
}

output "vnet_id" { value = azurerm_virtual_network.this.id }
```

Deploy with:

```bash
terraform init -backend-config=...
terraform plan -out=tfplan
terraform apply tfplan
```

The Bicep version is shorter, while the Terraform version gives you a richer plan diff and works against AWS tomorrow. Neither is "better" in isolation; they answer different questions, and the failures in the next section usually happen when teams forget which question they were trying to answer.

---

## Anti‑patterns

The failures to avoid are choosing tools for isolated features, hand‑authoring legacy formats, or letting multiple engines manage the same resources. By this point in the chapter, those mistakes should look familiar: each one breaks the ownership, lifecycle, or boundary rule that made the tool choice defensible in the first place. The recurring offenders:

* ❌ **Authoring ARM JSON by hand.** Use Bicep and `az bicep decompile` to
  migrate any inherited templates.
* ❌ **Two engines managing overlapping resources.** Drift wars; pick a side.
* ❌ **Choosing a tool for a single feature.** "I need Terraform because of
  one Datadog dashboard" — use the Datadog provider in a *separate* repo
  rather than rewriting your platform.
* ❌ **Pulumi without a programming culture.** It will rot into spaghetti.
* ❌ **Adopting community ALZ alternatives without due diligence.** Several
  "vibe‑coded" open‑source ALZ implementations look polished but lack
  testing, issue triage, and long‑term support. Before adopting any
  community project, check: contributor count, issue history (triaged
  regularly?), end‑to‑end test coverage, and whether the project has
  survived more than one Azure API breaking change.

> 🎥 **From the ALZ Weekly Questions** — [Community ALZ Projects + Right-Sized ALZ](https://www.youtube.com/watch?v=MznCQbT-EZw)
> The official ALZ repository has handled ~3 000 issues, triages twice weekly, and runs end‑to‑end tests. Evaluate any alternative against that baseline.

---

With the toolchain chosen, the estate has a shape from [01 repository topology](01-repository-topology.md) and a language from this chapter. The missing link is reuse: how do you avoid writing the same VNet module for each team that needs one, and how do you update it across 40 consumers without a week of coordinated PRs? Chapter 03 covers the module and registry architecture that turns "you have IaC" into "you have a maintainable IaC estate". The take-home from this chapter is simple: pick the engine your team owns confidently, keep it consistent within a layer, and put any deviation in writing.

## References

These are the source materials behind the tool recommendations and accelerator notes in this chapter.

* Microsoft, *Bicep documentation*:
  <https://learn.microsoft.com/azure/azure-resource-manager/bicep/>
* Microsoft, *Deployment stacks*:
  <https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks>
* Hashicorp, *AzureRM provider*:
  <https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs>
* Hashicorp, *AzAPI provider*:
  <https://registry.terraform.io/providers/Azure/azapi/latest/docs>
* Azure, *Verified Modules*: <https://aka.ms/avm>
* Azure, *ALZ‑Bicep (Classic — entering extended support)*: <https://github.com/Azure/ALZ-Bicep>
* Azure, *ALZ Terraform (Classic — entering extended support)*:
  <https://github.com/Azure/terraform-azurerm-caf-enterprise-scale>
* Azure, *ALZ accelerator (AVM‑based, current)*:
  <https://azure.github.io/Azure-Landing-Zones/accelerator/>
* Azure, *ALZ Terraform migration guide*:
  <https://aka.ms/alz/tf/migrate>
* OpenTofu: <https://opentofu.org/>
* 🎥 ALZ Weekly — *How to use AVM in ALZ, Bicep or Terraform?*:
  <https://www.youtube.com/watch?v=ry39tWr_SXc>
* 🎥 ALZ Weekly — *When to use SLZ over ALZ? + alzlibtool*:
  <https://www.youtube.com/watch?v=r8h7F6IJIqw>
* 🎥 ALZ Weekly — *Understanding ALZ Bicep File Structure*:
  <https://www.youtube.com/watch?v=sPA3YWkQ-4s>
* 🎥 ALZ Weekly — *Migrating from CAF-Enterprise-Scale to AVM*:
  <https://www.youtube.com/watch?v=DSBWjQlVpSs>
* 🎥 ALZ Weekly — *Community ALZ Projects + Right-Sized ALZ*:
  <https://www.youtube.com/watch?v=MznCQbT-EZw>
* 🎥 ALZ Weekly — *ALZ for SMB*:
  <https://www.youtube.com/watch?v=cyLhLJEYIkU>
* 🎥 ALZ Weekly — *Azure Migrate Agent Preview*:
  <https://www.youtube.com/watch?v=kFS9lNPuXxM>
* 🎥 ALZ Weekly — *Azure Migrate Agent Deep Dive*:
  <https://www.youtube.com/watch?v=ODaFlsja308>

---

[← 01 Repository topology](01-repository-topology.md) · [Index](../README.md) · [03 Modules & registries →](03-modules-and-registries.md)
