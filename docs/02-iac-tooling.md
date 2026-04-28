# 02 · IaC tooling — Bicep, Terraform, ARM, Pulumi

**In this chapter:**

- [How we got here](#how-we-got-here)
- [TL;DR recommendation](#tldr-recommendation)
- [The contenders](#the-contenders)
- [Decision criteria](#decision-criteria)
- [Mixing engines — when, and how to survive it](#mixing-engines-when-and-how-to-survive-it)
- [Example — same resource in both engines](#example-same-resource-in-both-engines)
- [Anti‑patterns](#antipatterns)
- [References](#references)


> **Decision:** which IaC engine for which layer of the platform?
> A monolingual estate is simpler; a bilingual estate is sometimes correct.

[← 01 Repository topology](01-repository-topology.md) · [Index](../README.md) · [03 Modules & registries →](03-modules-and-registries.md)

Choosing between Bicep and Terraform has launched more heated team debates than almost any other IaC decision. Behind the enthusiasm, the real question is operational: which tool will your team still be maintaining confidently — under pressure, at an unglamorous 2 a.m. — in three years? This chapter walks through each contender honestly, including where each one quietly fails, and gives you a decision framework for estates ranging from single-cloud greenfields to messy multi-cloud realities.

---

## How we got here

The first wave of "Azure as code" was bash scripts wrapping `azure-cli`
(then `az`), often committed alongside README sentences like *"run these
in order, don't forget to set the subscription"*. Microsoft launched **ARM
JSON templates** in 2014 — a genuine declarative model, but the syntax
made grown engineers cry. The same year, HashiCorp shipped Terraform; the
**AzureRM provider** (2016) gave multi‑cloud teams a sane authoring
experience and a real `plan` diff, and quickly became the default in
enterprises. Microsoft watched the migration and responded with **Bicep**
(public preview 2020, GA 2021) — essentially "ARM JSON, but lovable" —
and then with **Deployment Stacks** (GA 2024) to close the
state‑management gap that pushed many teams to Terraform in the first
place. **Pulumi** (2018) bet on real programming languages and found a
loyal niche but never displaced Terraform for ops‑led teams. Today the
honest answer to "Bicep or Terraform?" is "whichever your team will still
be operating well at 2 a.m." — both are first‑class on Azure in 2026.

## TL;DR recommendation

The short version, before we go deeper into each tool's strengths and failure modes:

| Layer | Recommended | Acceptable alternative |
|-------|-------------|------------------------|
| Foundation (mgmt groups, policy assignments) | **Bicep + Deployment Stacks** *or* **Terraform AzureRM/AzAPI** | ARM templates (legacy) |
| Platform (hub, identity, mgmt) | **Bicep** *or* **Terraform** — pick one and stick to it | — |
| Landing zones (workloads) | Same engine as platform | Mixed only with strong justification |
| Multi‑cloud workloads | **Terraform** or **Pulumi** | — |

**The biggest mistake** is choosing on aesthetics rather than on *who maintains
what tomorrow*. The right answer is whichever your engineers can operate
confidently at 2 a.m.

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

---

## The contenders

### Bicep

Microsoft's first‑party DSL (domain‑specific language) that transpiles
(compiles from one high‑level language to another) to ARM JSON.

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

The de‑facto multi‑cloud standard.

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

The original.

**Strengths**
* Universally supported. Always works, no tooling required.
* Useful as a *transport format* — Bicep compiles to it; you can decompile
  existing deployments.

**Weaknesses**
* Authoring ARM JSON by hand in 2026 is an anti‑pattern. Use Bicep.

### Pulumi

IaC in real programming languages (TypeScript, Python, Go, C#).

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

These aren't an engine choice — they're a *starting point* that
bootstraps a production‑grade CI/CD pipeline, state storage, identities,
and an opinionated folder structure so you don't start from a blank
repo. Understanding what each accelerator does — and what it *doesn't*
do — is critical, because the accelerator's output becomes the codebase
you will maintain for years.

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

Replaces the classic `Azure/ALZ-Bicep` repo (entering extended support;
archived February 2027).

| Aspect | Detail |
|--------|--------|
| **Input** | Interactive questionnaire via ALZ PowerShell module: target management‑group hierarchy, connectivity model (hub‑spoke or vWAN), regions, policy defaults, VCS choice (GitHub / Azure DevOps). |
| **Bootstrap** | Terraform provisions: a Git repo, CI/CD pipelines (GitHub Actions or ADO Pipelines), managed identities with OIDC federation, and storage accounts for Deployment Stack parameters. |
| **Output** | A ready‑to‑run repo containing AVM Bicep pattern modules (≈16 resource + 3 pattern modules), YAML‑driven configuration for management groups, policies, and connectivity, plus pipeline definitions that deploy via Deployment Stacks. |
| **Day‑2 workflow** | Edit YAML config or Bicep parameters → PR → pipeline runs `what-if` → merge → pipeline deploys via `az stack sub create`. |

#### ALZ Terraform accelerator (AVM‑based)

Replaces the classic `Azure/terraform-azurerm-caf-enterprise-scale`
module (entering extended support; archived August 2026).

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

You should **fork or wrap** the accelerator output, not consume it raw — see
[03 modules & registries](03-modules-and-registries.md).

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

The ALZ library is a **data layer** separated from business logic — a set of JSON/YAML files that define management‑group archetypes, policy sets, and role assignments. The `alzlibtool` Go module exposes three key commands:

| Command | Purpose |
|---------|---------|
| `alzlib check` | Validates the library files against the schema — catches errors before deployment. |
| `alzlib generate` | Produces the JSON artefacts consumed by the Terraform provider or Bicep modules. |
| `alzlib document` | Auto‑generates human‑readable documentation of the entire policy landscape. |

The same Go module powers both the Terraform ALZ provider and the Bicep generation pipeline. The library is **composable**: you can layer ALZ base + Sovereign Landing Zone (SLZ) + your own local overrides.

> 🎥 **From the ALZ Weekly Questions** — [When to use SLZ over ALZ? + alzlibtool](https://www.youtube.com/watch?v=r8h7F6IJIqw)
> The `alzlibtool` is how both Bicep and Terraform stay in sync with the canonical ALZ policy set. Treat the library as data, the tool as compiler, and your IaC as consumer.

#### Understanding the Bicep file structure

If you open the Bicep accelerator output, you will find multiple `.bicep` / `.bicepparam` file pairs rather than a single monolithic template. This is not accidental — ARM has a **4 MB deployment payload limit**, and a full ALZ deployment exceeds it. The accelerator splits the deployment into separate files for management groups, policies, connectivity, and so on.

A future Bicep feature — **extendable parameters** — will allow a single parameter file to feed multiple Bicep files, reducing duplication. Until then, expect some parameter repetition across files.

> 🎥 **From the ALZ Weekly Questions** — [Understanding ALZ Bicep File Structure](https://www.youtube.com/watch?v=sPA3YWkQ-4s)
> The Bicep modules can also be consumed **standalone**, without the accelerator. If you only need the connectivity module, reference it directly from the AVM registry.

#### Migrating from CAF‑Enterprise‑Scale

The classic `Azure/terraform-azurerm-caf-enterprise-scale` module enters its archive date on **1 August 2026**. A purpose‑built **Golang state migration tool** helps you move:

1. **Phase 1 — Connectivity and management resources** (VNets, firewalls, Log Analytics). The tool reads your existing state, maps resources from CAF‑ES module addresses to AVM module addresses, and generates Terraform `import` blocks.
2. **Phase 2 — Management groups and policies.** These are trickier because the policy structure changed between CAF‑ES and AVM. The tool produces an issues CSV listing resources that need manual attention.

The migration tool works from **any CAF‑ES version** — you don't need to be on the latest before migrating. However, older versions produce more entries in the issues CSV.

**Practical advice from the ALZ team:** Only import resources you cannot easily delete and recreate (ExpressRoute circuits, firewalls with BGP sessions, DNS zones with live records). For management groups and policies, consider a clean re‑deploy and let Deployment Stacks handle the cutover.

> 🎥 **From the ALZ Weekly Questions** — [Migrating from CAF-Enterprise-Scale to AVM](https://www.youtube.com/watch?v=DSBWjQlVpSs)
> The migration tool is also useful outside ALZ — it can recover or restructure any Terraform state file by mapping old module addresses to new ones.

#### Azure Migrate agent for platform landing zones

A preview **Azure Migrate agent** builds on top of the accelerator (it is not a replacement). Available in the Azure portal and VS Code, it lets you describe your desired landing zone in natural language and generates the accelerator configuration:

* Grounded on CAF and ALZ documentation — recommendations are not hallucinated.
* Uses an **MCP server** for customisation — you can extend it with your own policies or naming conventions.
* Includes **cost estimation** so you can see the monthly impact before deploying.
* Currently **Terraform‑only**; Bicep support is planned.

> 🎥 **From the ALZ Weekly Questions** — [Azure Migrate Agent Preview](https://www.youtube.com/watch?v=kFS9lNPuXxM) and [Azure Migrate Agent Deep Dive](https://www.youtube.com/watch?v=ODaFlsja308)
> The Migrate agent is ideal for initial exploration and configuration generation. For production deployments, always review the generated output before applying.

With all the options on the table, the practical question is which combination actually fits your team and organisation.

---

## Decision criteria

### 1. Skills already on the team

The single best predictor of long‑term success. A team fluent in Terraform
will ship a better Terraform ALZ than a Bicep one even if Bicep is
"theoretically" simpler for Azure‑only.

### 2. Single cloud or multi‑cloud?

* Pure Azure, no SaaS configuration → **Bicep** is hard to argue against.
* Any non‑Azure resources (GitHub, Entra B2B, Datadog, AWS DR site) →
  **Terraform**.

### 3. State tolerance

If your operating model cannot accept a separate state store (security review,
operational burden, blob/Cosmos availability concerns), Bicep + Deployment
Stacks removes that burden entirely.

### 4. Speed of access to new Azure features

* Bicep: same day as ARM REST API.
* Terraform AzureRM: weeks–months lag.
* Terraform AzAPI: same day, at the cost of writing ARM‑shaped HCL.

### 5. Policy / "what‑if" reliability

`terraform plan` is more accurate than `az deployment what-if` today, although
the gap has narrowed considerably with Bicep's
[`what-if` improvements](https://learn.microsoft.com/azure/azure-resource-manager/templates/deploy-what-if).

If the criteria above still leave you genuinely split — often because different platform layers are owned by teams with different skill sets — a bilingual estate is sometimes the honest answer.

---

## Mixing engines — when, and how to survive it

Bilingual estates exist, usually because:

* Foundation/policy is in **Bicep** (Microsoft accelerator), workloads are in
  **Terraform** because app teams already know it.
* Platform is in **Terraform** (multi‑cloud DR), but a specific workload uses
  **Bicep** because it needs a brand‑new Azure preview feature.

If you go bilingual, enforce these rules:

1. **One engine per resource.** Never let two engines manage the same
   resource — drift wars guaranteed.
2. **Clear boundary at the resource group or subscription level.** Make it
   impossible for the boundary to be ambiguous.
3. **Shared naming/tagging convention.** Both engines must produce identical
   outputs.
4. **Document it loudly** in the top‑level README — every new joiner asks
   "why?".

---

## Example — same resource in both engines

For reference, here is the same simple deployment (a VNet with two subnets) in
each. Notice the difference in *what you have to think about*.

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

The Bicep version is shorter; the Terraform version gives you a richer plan
diff and works against AWS tomorrow. Neither is "better" — they answer
different questions.

---

## Anti‑patterns

Most IaC tool mistakes fall into two camps: picking a tool for the wrong reasons, or letting two engines drift into each other's territory. The recurring offenders:

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

With the toolchain chosen, the estate has a shape (Chapter 01) and a language (this chapter). The missing link is reuse: how do you avoid writing the same VNet module for each team that needs one, and how do you update it across 40 consumers without a week of coordinated PRs? Chapter 03 covers the module and registry architecture that turns "we have IaC" into "we have a maintainable IaC estate". The take-home from this chapter is simple: pick the engine your team owns confidently, keep it consistent within a layer, and put any deviation in writing.

## References

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
