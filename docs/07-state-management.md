# 07 · State management

> **Decision:** for Terraform, where does state live, how is it locked, and
> what is the blast radius of a single `apply`? For Bicep, the equivalent
> question is how you carve up Deployment Stacks.

[← 06 Security](06-security.md) · [Index](../README.md) · [08 CI/CD pipeline patterns →](08-cicd-pipelines.md)

---

## Why this is not a footnote

State is the **most operationally dangerous** part of Terraform. A corrupt
state file at 2 a.m. on a Friday is a career‑defining moment. Get the
shape right up front:

* **One state file per (environment × workload).** Not per repo, not per
  team — per *unit of deployment*.
* **Backend that supports locking.** No exceptions.
* **Treat state like a secret store.** Encrypted at rest with CMK, network
  isolated, access audited.

For Bicep, **Deployment Stacks** play the same role: scope = blast radius.

---

## Terraform backend choice

| Backend | Recommendation |
|---------|----------------|
| `azurerm` (Azure Storage) | **Default for Azure‑native shops.** Supports OIDC, blob lease locking, CMK, private endpoint. |
| Terraform Cloud / Enterprise (HCP) | Strong if you also want run UI, Sentinel policy, and dynamic provider credentials. Costs money. |
| `s3` + DynamoDB | Only if you genuinely have AWS in the picture. |
| Local state | **Never.** Not even for dev. |

### Recommended `azurerm` backend setup

One **dedicated subscription** (`sub-tfstate-prod`) hosts state for
everything. Inside, **one storage account per environment**, **one container
per workload**, and **one blob (state file) per environment‑workload**.

```
sub-tfstate-prod/
├── rg-tfstate-prod
│   └── sttfstateprod001
│       ├── platform-connectivity-prod
│       │   └── terraform.tfstate
│       ├── platform-identity-prod
│       │   └── terraform.tfstate
│       ├── lz-corp-app01-prod
│       │   └── terraform.tfstate
│       └── ...
```

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfstate-prod"
    storage_account_name = "sttfstateprod001"
    container_name       = "platform-connectivity-prod"
    key                  = "terraform.tfstate"
    use_oidc             = true
    use_azuread_auth     = true
  }
}
```

Hardening checklist for the storage account:

- [ ] Public network access **disabled**, private endpoint only.
- [ ] **AAD auth** for blob (`use_azuread_auth = true`); shared‑key access
      disabled at the storage account level.
- [ ] **Customer‑managed key** (CMK) in a Key Vault you control.
- [ ] **Soft delete** for blobs and containers (≥ 30 days).
- [ ] **Versioning** enabled — `terraform.tfstate` versions are your
      "undo" button.
- [ ] **Diagnostic logs** to a Log Analytics workspace; alert on any
      access from outside the runner subnets.
- [ ] **RBAC**: only the deploy SPN has `Storage Blob Data Contributor`;
      humans only via PIM with elevation alerts.

---

## Locking

Terraform's `azurerm` backend uses **blob leases** for locking. This is
sufficient and battle‑tested. Behaviour:

* Each `plan` / `apply` acquires a lease on the state blob.
* If a lease is held, other operations fail fast with the lock ID.
* If a runner crashes mid‑apply, the lease eventually expires (default 60s
  acquire retry) — but a manual `terraform force-unlock <ID>` is sometimes
  needed.

### Pipeline contract

* **Concurrency control** at the pipeline level (`concurrency: deploy-<env>`
  in GitHub Actions) so you never enqueue two `apply`s for the same state.
* If a job fails mid‑apply, the next job blocks on lock, alerts the team,
  and someone investigates *before* force‑unlocking.

---

## Blast radius — how to size state files

The smaller the state, the smaller the blast radius of a corruption or a
bad apply, but the more cross‑state references you need. The sweet spot:

| Layer | Recommended state granularity |
|-------|------------------------------|
| Foundation | One state per *environment* (prod, nonprod). |
| Platform — connectivity | One state per *environment × region* (one for `prod-westeurope`, one for `prod-northeurope`). |
| Platform — identity / mgmt | One state per *environment*. |
| Landing zone | One state per *(workload × environment)*. Never share. |

Rule of thumb: **a single `apply` should touch resources owned by one team
and deployable in under 15 minutes.** If `plan` takes 20 minutes, your state
is too big.

---

## Cross‑state references

Workload state needs the hub VNet ID. Two patterns:

### A) `terraform_remote_state` data source

```hcl
data "terraform_remote_state" "connectivity" {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-tfstate-prod"
    storage_account_name = "sttfstateprod001"
    container_name       = "platform-connectivity-prod"
    key                  = "terraform.tfstate"
    use_oidc             = true
  }
}

resource "azurerm_virtual_network_peering" "to_hub" {
  remote_virtual_network_id = data.terraform_remote_state.connectivity.outputs.hub_vnet_id
  ...
}
```

**Pros:** simple, no extra infrastructure, real‑time.
**Cons:** the consumer needs **read access to the producer's state file** —
which contains all of the producer's secrets in cleartext.

### B) Outputs in Azure (recommended)

The producer writes its outputs to **Azure App Configuration** or **tagged
on a known resource group**:

```hcl
resource "azurerm_app_configuration_key" "hub_vnet_id" {
  configuration_store_id = data.azurerm_app_configuration.platform.id
  key                    = "platform/connectivity/hub-vnet-id/${var.env}"
  value                  = azurerm_virtual_network.hub.id
  label                  = var.env
}
```

The consumer reads via the same App Configuration:

```hcl
data "azurerm_app_configuration_key" "hub_vnet_id" {
  configuration_store_id = data.azurerm_app_configuration.platform.id
  key                    = "platform/connectivity/hub-vnet-id/${var.env}"
  label                  = var.env
}
```

**Pros:** consumers never see producer state. Outputs are first‑class,
versioned in App Configuration, with point‑in‑time history.
**Cons:** an extra component; subtle race if consumer reads before producer
publishes.

For Bicep, the equivalent is `existing` lookups or App Configuration / RG
tags — Bicep has no remote‑state concept by design.

---

## State surgery — when you must

Avoid it. When unavoidable:

1. **Always back up** the current state first:
   `terraform state pull > backup-$(date +%s).tfstate`
2. Use `terraform state mv` / `rm` / `import` rather than hand‑editing JSON.
3. Do it from a controlled runner, not your laptop, so the action is logged.
4. Open a PR with a `STATE-SURGERY.md` describing the why and the commands.
5. Run `plan` afterwards — it must show **no changes**, otherwise stop.

For the `import` workflow, prefer **HCL `import` blocks** (Terraform 1.5+)
over the legacy CLI command — they are reviewable in PR.

```hcl
import {
  to = azurerm_resource_group.legacy
  id = "/subscriptions/.../resourceGroups/rg-legacy"
}
```

---

## Bicep — Deployment Stacks

Bicep doesn't have state, but **Deployment Stacks** give you the same
benefits:

* A stack tracks the resources it deployed.
* `denySettings` blocks out‑of‑band modifications (`denyDelete` or
  `denyWriteAndDelete`).
* `actionOnUnmanage` controls what happens to resources removed from the
  template (`detach`, `delete`, or `deleteAll`).

Carve stacks the same way you'd carve Terraform state — one stack per
(workload × environment), scoped at subscription or resource group.

```bash
az stack sub create \
  --name lz-corp-app01-prod \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @prod.bicepparam \
  --deny-settings-mode denyWriteAndDelete \
  --deny-settings-excluded-actions "Microsoft.Compute/virtualMachines/start/action" \
  --action-on-unmanage deleteAll
```

Tradeoff vs raw `az deployment`: stacks are slower to create but vastly
safer for production. For ephemeral PR environments, raw deployments are
fine; for prod, stacks.

---

## Drift detection

Run a scheduled `plan` (or `what‑if` for Bicep) per state/stack, weekly:

* Empty diff → all green.
* Non‑empty diff → post to a "platform drift" Teams channel; create an
  issue; require triage within an SLA.

For Bicep stacks with `denySettings`, drift should be impossible by
construction — but human break‑glass paths exist, so verify.

See [11 manageability](11-manageability.md) for full drift handling.

---

## Anti‑patterns

* ❌ **One state file for the whole estate.** "Apply" becomes a ritual,
  changes pile up, and one mistake breaks everything.
* ❌ **Local state on engineer laptops.** Even in dev. Especially in dev.
* ❌ **State backend in the same subscription as the resources it
  manages.** A bad `apply` could nuke the storage account holding the
  state. Put state in its own subscription.
* ❌ **Sharing state files across teams via `terraform_remote_state`
  without realising it leaks all producer secrets.** Use App Configuration
  outputs instead.
* ❌ **Editing state files by hand.** Even with `jq`. There is no
  validation; one typo and the state is unrecoverable.
* ❌ **Bicep deployments without stacks for prod.** You lose drift
  protection.

---

## References

* Hashicorp, *Backend configuration*:
  <https://developer.hashicorp.com/terraform/language/settings/backends/azurerm>
* Hashicorp, *State*:
  <https://developer.hashicorp.com/terraform/language/state>
* Microsoft, *Deployment stacks*:
  <https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks>
* Microsoft, *Storage account security baseline*:
  <https://learn.microsoft.com/security/benchmark/azure/baselines/storage-security-baseline>
* Hashicorp, *`import` blocks*:
  <https://developer.hashicorp.com/terraform/language/import>

---

[← 06 Security](06-security.md) · [Index](../README.md) · [08 CI/CD pipeline patterns →](08-cicd-pipelines.md)
