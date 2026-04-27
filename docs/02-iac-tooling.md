# 02 · IaC tooling — Bicep, Terraform, ARM, Pulumi

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

---

## The contenders

### Bicep

Microsoft's first‑party DSL that transpiles to ARM JSON.

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
* Looping/conditionals are less expressive than HCL or general‑purpose
  languages.
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

These aren't an engine choice — they're a *starting point*:

* **ALZ Bicep** (`Azure/ALZ-Bicep`) — modular Bicep implementation.
* **ALZ Terraform module** (`Azure/terraform-azurerm-caf-enterprise-scale`,
  also known as CAF/ESLZ Terraform) — opinionated, batteries‑included.
* **ALZ Portal accelerator** — click‑through deploy; good for demos, not for
  production GitOps.
* **ALZ PowerShell module** — bootstraps an end‑to‑end deployment from a
  questionnaire.

You should **fork or wrap** an accelerator, not consume it raw — see
[03 modules & registries](03-modules-and-registries.md).

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
* Azure, *ALZ‑Bicep*: <https://github.com/Azure/ALZ-Bicep>
* Azure, *Terraform CAF/ESLZ module*:
  <https://github.com/Azure/terraform-azurerm-caf-enterprise-scale>
* OpenTofu: <https://opentofu.org/>

---

[← 01 Repository topology](01-repository-topology.md) · [Index](../README.md) · [03 Modules & registries →](03-modules-and-registries.md)
