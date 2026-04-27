# 12 · Naming, tagging & metadata conventions

> **Decision:** what do you call things, and what metadata travels with
> them? The boring stuff that breaks everything if you skip it.

[← 11 Manageability](11-manageability.md) · [Index](../README.md) · [13 Documentation →](13-documentation.md)

---

## Why this gets a whole chapter

Naming and tagging are the **load‑bearing infrastructure of every other
process**: cost reporting, access control, automation, decommissioning,
disaster recovery — all rely on consistent metadata. A weak convention
costs you forever.

The opposite is also true: an over‑engineered convention nobody can remember
gets violated immediately. Aim for **rigorous but humane**.

---

## Naming convention

### Anatomy

```
<resource-abbr>-<workload>-<env>-<region-abbr>-<instance>
```

Examples:

```
vnet-hub-prod-swc-01
rg-platform-connectivity-prod-swc
sa-tflogs-prod-swc-001       (no dashes, lowercase, ≤ 24 chars)
kv-platform-prod-swc-01      (≤ 24 chars, globally unique)
nsg-app01-web-prod-swc-01
```

Rules:

* Lowercase only. Azure is mostly case‑insensitive, but tools, KQL, and
  bash scripts aren't.
* Use `-` separators except where Azure forbids them (storage, ACR, KV).
* **Region abbreviations** (3 letters): pick once and document. Examples:
  `swc` (Sweden Central), `weu` (West Europe), `nwe` (North Europe), `wus2`
  (West US 2). Don't invent new ones; consult your standards page.
* **Instance suffix** (`-01`, `-02`) — even for resources you expect to be
  singletons. The day you need a second one, your name doesn't fight you.
* **Avoid embedding subscription / tenant info in names.** Tags and the
  scope hierarchy already convey it.

### Canonical resource abbreviations

Use the [Microsoft CAF resource abbreviations list][caf-abbr] as a starting
point. Don't invent your own — they aren't worth the bus‑factor cost.

[caf-abbr]: https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations

### Length & character constraints

Some Azure resources have nasty limits — **plan for the worst**:

| Resource | Max length | Allowed |
|----------|-----------|---------|
| Storage account | 24 | a‑z, 0‑9 |
| Key Vault | 24 | a‑z, A‑Z, 0‑9, `-` |
| ACR | 50 | a‑z, A‑Z, 0‑9 |
| Function App | 60 | a‑z, A‑Z, 0‑9, `-` |
| VM (Windows) | 15 | a‑z, A‑Z, 0‑9, `-` |
| Resource Group | 90 | broad |

For names that don't fit your convention, define **shortened forms**
explicitly in your naming module — don't truncate ad‑hoc.

### Code it, don't print it

Build a **naming module** in `alz-modules`:

```hcl
module "naming" {
  source  = "Azure/naming/azurerm"
  version = "0.4.2"
  suffix  = ["${var.workload}", var.env, local.region_abbr]
}

resource "azurerm_storage_account" "logs" {
  name = module.naming.storage_account.name_unique
  ...
}
```

Or for Bicep, the [Azure naming Bicep module](https://github.com/nianton/azure-naming).
Either way, **never let humans type the name into a parameter file** —
typos become permanent.

---

## Tagging convention

### Mandatory tags

Every resource (and every resource group) must carry these. Enforce via
Azure Policy `Append` (auto‑apply RG tags to resources) and `Audit`/`Deny`
for the rest.

| Tag key | Example | Notes |
|---------|---------|-------|
| `CostCenter` | `CC-12345` | Charging code; numeric ideally. |
| `Owner` | `team-app01@contoso.com` | Group address, not a person. |
| `Environment` | `prod`, `nonprod`, `sandbox` | Drives a lot of automation. |
| `Workload` | `app01`, `connectivity-hub` | The "what". |
| `BusinessUnit` | `corp`, `online` | The "for whom". |
| `DataClassification` | `public`, `internal`, `confidential`, `restricted` | Drives policy decisions. |
| `Criticality` | `1`, `2`, `3`, `4` | Tier for SLA / DR. |
| `ManagedBy` | `iac`, `manual` | Detect drift; expect `iac` everywhere. |
| `Repo` | `alz-platform` | The Git repo of authority. |
| `DeploymentId` | `<commit-sha>` or `<run-id>` | Trace a resource to a pipeline run. |

### Optional but useful

| Tag key | Example | Use |
|---------|---------|-----|
| `DeleteAt` | `2026-12-31` | For sandbox / time‑bounded resources; cleanup automation. |
| `Project` | `migration-2026` | Programme tracking. |
| `Compliance` | `pci`, `gdpr` | Regulatory scope. |

### Inheritance & enforcement

Tags do **not** inherit automatically from RG to resource (despite many
tutorials implying so). Implement:

* **Policy `modify` effect** to auto‑append RG tags to resources at creation.
  Use sparingly — too many `modify` policies make `terraform plan` noisy.
* **Module defaults** — every module accepts a `tags` map and merges with
  its own additions. Do **not** rely on `default_tags` in the AzureRM
  provider for required tags; module‑level merging is more explicit.

```hcl
locals {
  base_tags = {
    Environment        = var.env
    Workload           = var.workload
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = var.data_classification
    BusinessUnit       = var.business_unit
    Criticality        = var.criticality
    ManagedBy          = "iac"
    Repo               = "alz-platform"
    DeploymentId       = var.deployment_id
  }

  tags = merge(local.base_tags, var.additional_tags)
}
```

### Tag reporting

Run a weekly Resource Graph query to find non‑compliant resources:

```kusto
Resources
| where tags !has "CostCenter" or tags !has "Owner" or tags !has "Environment"
| project name, type, subscriptionId, resourceGroup, tags
```

Send the count + worst offenders to a dashboard; gate the next quarterly
budget on improvement.

---

## Management group / subscription naming

These are top‑level too — bake them into the foundation:

```
Tenant Root
├── alz                          (intermediate root)
│   ├── alz-platform
│   │   ├── alz-platform-connectivity
│   │   ├── alz-platform-identity
│   │   └── alz-platform-management
│   ├── alz-landingzones
│   │   ├── alz-corp
│   │   └── alz-online
│   ├── alz-decommissioned
│   └── alz-sandboxes
└── (legacy)
```

Subscription names mirror the MG path:

```
sub-platform-connectivity-prod
sub-corp-app01-prod
sub-corp-app01-nonprod
sub-sandbox-jdoe
```

Document the tree in the foundation repo's `docs/management-groups.md`.

---

## Region strategy

Pick a small number of **primary regions** (typically 2 per geo for DR
pairing) and don't deploy outside them without an exception process.

* **Primary:** `swedencentral`
* **Paired:** `northeurope` (DR target for Sweden)
* **Approved exception:** `westeurope` (legacy)

Bake the allowed list into a policy:

```bicep
// policies/restrict-regions.bicep
param allowedLocations array = [
  'swedencentral'
  'northeurope'
  'westeurope'
]
```

The policy assignment is **`deny`** in landing zones; **`audit`** in
sandbox.

---

## Anti‑patterns

* ❌ **Inventing your own resource abbreviations.** Use Microsoft's CAF
  list; the bus factor is too high otherwise.
* ❌ **Free‑text tags** (`Owner: "John (he sits next to Sara)"`). Tags are
  data; treat them as such.
* ❌ **Required tags enforced only by training docs.** People forget.
  Enforce with policy.
* ❌ **Names that include the subscription ID** ("just in case"). The
  scope is already there.
* ❌ **`Environment` tag values that drift** (`Prod`, `prod`, `Production`).
  Pick canonical values and `Deny` anything else with policy.
* ❌ **Tagging at the resource level only**, ignoring RG. RG tags are the
  inheritance source for `modify` policies.
* ❌ **Naming module added "later".** Names are the hardest thing to
  refactor — costs days of pipeline work per resource type.

---

## References

* Microsoft, *CAF — Naming and tagging*:
  <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/naming-and-tagging>
* Microsoft, *Resource abbreviations*:
  <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations>
* Microsoft, *Resource naming rules*:
  <https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules>
* `Azure/naming` Terraform module:
  <https://registry.terraform.io/modules/Azure/naming/azurerm/latest>
* `nianton/azure-naming` Bicep module:
  <https://github.com/nianton/azure-naming>

---

[← 11 Manageability](11-manageability.md) · [Index](../README.md) · [13 Documentation →](13-documentation.md)
