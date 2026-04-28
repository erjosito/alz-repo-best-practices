# References & further reading

**In this chapter:**

- [Microsoft — Cloud Adoption Framework](#microsoft-cloud-adoption-framework)
- [Microsoft — Bicep & Deployment Stacks](#microsoft-bicep-deployment-stacks)
- [Microsoft — Identity & Security](#microsoft-identity-security)
- [Microsoft — Governance & Policy](#microsoft-governance-policy)
- [Azure Verified Modules](#azure-verified-modules)
- [ALZ accelerators](#alz-accelerators)
- [Terraform / OpenTofu](#terraform-opentofu)
- [GitHub](#github)
- [Azure DevOps](#azure-devops)
- [Policy / scanning tools](#policy-scanning-tools)
- [Developer experience](#developer-experience)
- [Documentation](#documentation)
- [Methodology / metrics](#methodology-metrics)


[← 14 Anti-patterns](14-anti-patterns.md) · [Index](../README.md)

A consolidated list of the external references cited across this guide.

## Microsoft — Cloud Adoption Framework

* CAF Landing Zones overview — <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/>
* CAF Landing Zone implementation options — <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/implementation-options>
* CAF Naming and tagging — <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/naming-and-tagging>
* CAF Resource abbreviations — <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations>
* CAF Environments — <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/considerations/environments>
* Subscription vending — <https://learn.microsoft.com/azure/architecture/landing-zones/subscription-vending>

## Microsoft — Bicep & Deployment Stacks

* Bicep documentation — <https://learn.microsoft.com/azure/azure-resource-manager/bicep/>
* Deployment stacks — <https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks>
* Private module registry — <https://learn.microsoft.com/azure/azure-resource-manager/bicep/private-module-registry>
* What-if — <https://learn.microsoft.com/azure/azure-resource-manager/templates/deploy-what-if>

## Microsoft — Identity & Security

* Workload identity federation — <https://learn.microsoft.com/entra/workload-id/workload-identity-federation>
* Federated identity credentials on managed identities — <https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/how-manage-federated-identity-credentials>
* Privileged Identity Management — <https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-configure>
* Defender for DevOps — <https://learn.microsoft.com/azure/defender-for-cloud/defender-for-devops-introduction>
* Storage security baseline — <https://learn.microsoft.com/security/benchmark/azure/baselines/storage-security-baseline>

## Microsoft — Governance & Policy

* Azure Policy as code — <https://learn.microsoft.com/azure/governance/policy/concepts/policy-as-code>
* Azure Resource Locks — <https://learn.microsoft.com/azure/azure-resource-manager/management/lock-resources>
* Resource naming rules — <https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules>

## Azure Verified Modules

* AVM home — <https://aka.ms/avm>
* AVM Bicep specs — <https://github.com/Azure/bicep-registry-modules>
* AVM Terraform template — <https://github.com/Azure/terraform-azurerm-avm-template>

## ALZ accelerators

* ALZ-Bicep (Classic — entering extended support) — <https://github.com/Azure/ALZ-Bicep>
* Terraform CAF/ESLZ module (Classic — entering extended support, archived Aug 2026) — <https://github.com/Azure/terraform-azurerm-caf-enterprise-scale>
* ALZ accelerator (AVM‑based, current) — <https://azure.github.io/Azure-Landing-Zones/accelerator/>
* ALZ Terraform migration guide — <https://aka.ms/alz/tf/migrate>
* ALZ PowerShell module — <https://github.com/Azure/ALZ-PowerShell-Module>
* ALZ Portal accelerator — <https://aka.ms/alz/portal>

## Terraform / OpenTofu

* AzureRM provider — <https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs>
* AzAPI provider — <https://registry.terraform.io/providers/Azure/azapi/latest/docs>
* Backend `azurerm` — <https://developer.hashicorp.com/terraform/language/settings/backends/azurerm>
* Recommended practices — <https://developer.hashicorp.com/terraform/cloud-docs/recommended-practices>
* `terraform test` — <https://developer.hashicorp.com/terraform/language/tests>
* `import` blocks — <https://developer.hashicorp.com/terraform/language/import>
* Terratest — <https://terratest.gruntwork.io/>
* OpenTofu — <https://opentofu.org/>

## GitHub

* Reusable workflows — <https://docs.github.com/actions/using-workflows/reusing-workflows>
* Required workflows — <https://docs.github.com/actions/using-workflows/required-workflows>
* Environments — <https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment>
* Configuring OIDC in Azure — <https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure>
* Security hardening for Actions — <https://docs.github.com/actions/security-guides/security-hardening-for-github-actions>
* Secret scanning — <https://docs.github.com/code-security/secret-scanning>
* Artifact attestations — <https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds>
* CODEOWNERS — <https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners>

## Azure DevOps

* Workload identity federation for service connections — <https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure>
* Branch policies — <https://learn.microsoft.com/azure/devops/repos/git/branch-policies>
* YAML templates — <https://learn.microsoft.com/azure/devops/pipelines/process/templates>

## Policy / scanning tools

* PSRule for Azure — <https://azure.github.io/PSRule.Rules.Azure/>
* Checkov — <https://www.checkov.io/>
* tfsec / Trivy — <https://aquasecurity.github.io/tfsec/>
* Conftest (OPA/Rego) — <https://www.conftest.dev/>
* OPA / Rego — <https://www.openpolicyagent.org/docs/latest/policy-language/>
* Sentinel — <https://developer.hashicorp.com/sentinel>

## Developer experience

* `pre-commit` — <https://pre-commit.com/>
* `pre-commit-terraform` — <https://github.com/antonbabenko/pre-commit-terraform>
* `terraform-docs` — <https://terraform-docs.io/>
* `tflint` — <https://github.com/terraform-linters/tflint>
* Devcontainers — <https://containers.dev/>
* `mise` — <https://mise.jdx.dev/>
* `release-please` — <https://github.com/googleapis/release-please>
* Conventional Commits — <https://www.conventionalcommits.org/>
* SemVer — <https://semver.org/>
* `actionlint` — <https://github.com/rhysd/actionlint>
* `zizmor` — <https://github.com/woodruffw/zizmor>
* `gitleaks` — <https://github.com/gitleaks/gitleaks>
* Sigstore `gitsign` — <https://github.com/sigstore/gitsign>
* Renovate — <https://docs.renovatebot.com/>

## Documentation

* Diátaxis — <https://diataxis.fr/>
* MADR — Markdown ADR template — <https://adr.github.io/madr/>
* `adr-tools` — <https://github.com/npryce/adr-tools>
* GitHub Mermaid — <https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/>
* D2 — <https://d2lang.com/>

## Methodology / metrics

* DORA metrics — <https://dora.dev/>
* SLSA — <https://slsa.dev/>
* Trunk-based development — <https://trunkbaseddevelopment.com/>

---

[← 14 Anti-patterns](14-anti-patterns.md) · [Index](../README.md)
