# 06 · Secrets & supply‑chain security

**In this chapter:**

- [How we got here](#how-we-got-here)
- [Decision framework](#decision-framework)
- [The threat model](#the-threat-model)
- [Secrets in code — eliminate, don't manage](#secrets-in-code-eliminate-dont-manage)
- [Branch protection that matters](#branch-protection-that-matters)
- [Supply‑chain hygiene](#supplychain-hygiene)
- [Signed commits](#signed-commits)
- [Securing CI runners](#securing-ci-runners)
- [Workflow hardening (GitHub Actions)](#workflow-hardening-github-actions)
- [State file security (Terraform)](#state-file-security-terraform)
- [Policy / compliance gates](#policy-compliance-gates)
- [Incident playbook (one paragraph)](#incident-playbook-one-paragraph)
- [Sovereign Landing Zone (SLZ) — when compliance demands more](#sovereign-landing-zone-slz-when-compliance-demands-more)
- [Protecting vended resources — defence in depth](#protecting-vended-resources-defence-in-depth)
- [Anti‑patterns](#antipatterns)
- [References](#references)



> **Decision:** how do you keep credentials out of code, prove the integrity
> of what's deployed, and stay ahead of supply‑chain attacks?

[← 05 Authentication](05-authentication.md) · [Index](../README.md) · [07 State management →](07-state-management.md)

Secure an Azure Landing Zone (ALZ) Infrastructure as Code (IaC) repo by eliminating long‑lived secrets first, then layering branch protection, signed provenance, pinned dependencies, isolated runners, hardened workflows, protected state, and policy gates. The central tradeoff is that every extra control adds friction, but every missing control leaves a path from a pull request, dependency, or runner into your tenant. Treat every pipeline dependency and Continuous Integration (CI) runner as a potential compromise path: use OpenID Connect (OIDC) plus Azure Key Vault instead of stored credentials, require CODEOWNERS and status checks before merge, pin every Action, module, and tool by immutable digest, and map regulated or sovereign controls directly to repo and pipeline enforcement. That defence‑in‑depth stance is easier to apply once you see how the threat shifted from accidentally committed passwords to compromised build systems, which is where the chapter starts.

---

## How we got here

For a long time, "secrets management" in IaC meant *"don't commit them"*
— enforced by code review, vibes, and luck. Luck ran out repeatedly:
Uber's AWS keys in a public Git repo (2016), countless `.tfvars` leaks,
shared access signature (SAS) tokens in `terraform.tfstate` files uploaded to misconfigured
backends. Push‑side defences emerged around 2018: `truffleHog`,
`gitleaks`, eventually GitHub's **native secret scanning** and **push
protection**. Then the threat shifted *upstream*: the SolarWinds attack
(2020) and the Codecov bash‑uploader compromise (2021) showed that a
trusted dependency could be the attack vector. The IaC world felt this
directly with the **`tj-actions/changed-files`** Action compromise of
March 2025, which exfiltrated secrets from thousands of pipelines that
had pinned by *tag* rather than by *commit SHA*. The response is the
defence‑in‑depth model this chapter describes: keep secrets out of code,
sign what you ship (Sigstore, Supply‑chain Levels for Software Artifacts (SLSA) attestations), pin every dependency
by digest, and assume your CI runner will eventually be compromised.

Those four imperatives become the decision framework below: decide which controls are mandatory, where they run, and who owns exceptions.

---

## Decision framework

Pick the security controls by answering these questions in order. The hard rules are non‑negotiable; the rest decide how much additional isolation, evidence, and compliance mapping your ALZ repo needs.

1. **Have you eliminated long‑lived secrets from the repo and pipelines?**
   * Hard rule: yes. Use OIDC for Azure authentication and Key Vault for application secrets; anything else should be treated as a temporary exception with an owner and expiry. See [05 authentication](05-authentication.md).

2. **Which branch protection rules are mandatory?**
   * Require CODEOWNERS review, at least one approval (two for foundation and policy), required status checks, stale‑review dismissal, conversation resolution, no force‑push or deletion, and re‑approval after changes from forks.

3. **How will you secure the supply chain?**
   * Pin GitHub Actions, modules, providers, and tools by immutable SHA or digest; enable dependency scanning and controlled update automation; publish SBOMs and signed release artefacts where your deployment process consumes build outputs.

4. **Which runners execute sensitive plans and applies?**
   * Use GitHub‑hosted larger runners with static IPs for ordinary workflows; use ephemeral, isolated self‑hosted runners only when production or regulated deployments need network controls that hosted runners cannot provide.

5. **Are commits, tags, and artefacts signed?**
   * Prefer Sigstore / `gitsign` for organisation‑wide keyless commit signing and artifact attestations; allow GPG or SSH signing where individuals need traditional key ownership.

6. **If you are regulated or sovereign, which controls map to repo and pipeline enforcement?**
   * Map SLZ, audit, residency, encryption, and separation‑of‑duties requirements to branch rules, policy gates, runner isolation, protected environments, and evidence artefacts before implementation starts.

The full analysis below explains the threat paths behind those choices and the concrete controls that close them.

---

## The threat model

The decision framework only becomes useful when you map each control to a concrete attack path, because attackers will target Git history, contributor accounts, runners, dependencies, state, and drift rather than the tidy categories in your governance model. For an IaC repo that controls an enterprise Azure estate, the realistic attack vectors are:

1. **Leaked secrets** in Git history.
2. **Compromised contributor account** pushing a malicious change.
3. **Compromised CI runner** exfiltrating tokens or planting backdoors.
4. **Malicious / typo‑squatted module dependency** (Terraform Registry, npm,
   PyPI, GitHub Actions in `uses:`).
5. **State file leakage** exposing secrets baked into resources.
6. **Drift / out‑of‑band change** introducing an unreviewed configuration.

Because each path uses a different part of the delivery system, the controls below deliberately overlap instead of pretending that one gate can carry the whole security model. The first and most common path is still credential leakage, so the practical work starts with removing secrets rather than merely hiding them better.

---

## Secrets in code — eliminate, don't manage

The only durable pattern for the credential path is to eliminate long‑lived secrets from repos and pipelines, using OIDC for Azure authentication and Azure Key Vault for application secrets. These controls reinforce each other rather than substituting for each other:

* **OIDC for cloud auth** (see [05 authentication](05-authentication.md)).
* **Reference Key Vault for application secrets**, never inline them:
  ```bicep
  module app 'app.bicep' = {
    params: {
      sqlPassword: keyVault.getSecret('sql-admin-password')
    }
  }
  ```
* **Generate secrets in‑pipeline** (e.g. random storage shared access signatures (SAS)) and write them
  straight to Key Vault — they never appear in logs or state.
* **Mark all sensitive Terraform variables `sensitive = true`** so they don't
  print in plan output. (They will still appear in state — see below.)

### Pre‑commit secret scanning

Secret scanning needs to run on every developer machine **and** in CI, because local hooks catch mistakes before they enter history while the pipeline catches missing or bypassed hooks. Configure both layers with the same allowlist discipline:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
```

In CI, run `gitleaks detect` on every pull request (PR) with `--redact` and fail the build
on any finding. Maintain an **allowlist file** for false positives, reviewed
quarterly.

GitHub's native controls add the server‑side layer that developer hooks cannot provide:

* **Push protection** for secret scanning — blocks pushes that contain known
  secret patterns. Enable for every repo.
* **Secret scanning alerts** — also scans dependency files.

If a real secret is committed, **rotate the credential first**, then purge
history (`git filter-repo` / GitHub support), because the secret was public the moment it was pushed. Eliminating and scanning for secrets closes the credential path, but it still leaves the path where a bad change is reviewed too casually; that is where branch protection takes over.

---

## Branch protection that matters

After secrets are removed from the normal delivery path, branch protection has to prevent a compromised contributor account from turning a malicious change into approved code. Require CODEOWNERS review, status checks, signed commits, stale‑review dismissal, linear history, and no force‑push or deletion on every protected branch.

| Setting | Recommended |
|---------|-------------|
| Require PR before merge | ✅ |
| Require review approvals | ≥ 1 (≥ 2 for foundation/policy) |
| Require review from CODEOWNERS | ✅ |
| Dismiss stale reviews on new commits | ✅ |
| Require re‑approval after fork updates | ✅ |
| Require signed commits | ✅ (Sigstore/gitsign or GPG) |
| Require linear history | ✅ |
| Require status checks | lint, plan, security‑scan, policy |
| Require conversation resolution | ✅ |
| Restrict who can push | only the deploy bot for `main` |
| Disallow force push / deletion | ✅ |

GitHub's **rulesets** let you apply these controls across all repos in an organisation, so prefer rulesets over per‑repo branch protection when you need consistent enforcement. Once your own contributors are constrained, the remaining attack surface is the code you *don't* own: the Actions, modules, and tools your pipeline fetches from the internet.

---

## Supply‑chain hygiene

The supply‑chain side of the same argument is that every external dependency should be pinned by immutable digest or SHA, updated through controlled automation, and accompanied by evidence of what the pipeline consumed.

### Pin everything by digest, not by tag

Tags are mutable because a malicious maintainer can re‑point `v1.0.0` to a
compromised commit, so pin GitHub Actions by SHA:

```yaml
# ❌ Bad — tag is mutable
- uses: hashicorp/setup-terraform@v3

# ✅ Good — pinned to a SHA
- uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd # v3.1.2
```

Use **Dependabot** with `dependency-type: version-update:semver-major`
disabled and `version-update:semver-patch` auto‑merged after CI passes, so you
get security updates without unsupervised major bumps. For Terraform modules,
lock with `.terraform.lock.hcl` (committed) and run `terraform init -upgrade`
only via PRs.

### SBOM for IaC?

For IaC, Software Bill of Materials (SBOM) generation is less mature than it is for application code, but it is still worth doing because it gives your security tools something concrete to inspect:

* For Terraform, generate a module dependency report
  (`terraform providers schema -json` + custom tooling).
* For Bicep, `bicep build --stdout` then parse `metadata` blocks plus
  `br:` module references.
* Store SBOMs as build artifacts; ingest into your Software Composition Analysis (SCA) tool (GitHub Advanced Security (GHAS),
  Snyk, etc.).

> 📘 **Key terms**
>
> **SBOM (Software Bill of Materials)** — a machine‑readable inventory of every component (modules, providers, Actions) your pipeline depends on, used to track known vulnerabilities.
>
> **SCA (Software Composition Analysis)** — tooling that scans your dependency tree for known CVEs and licence risks.
>
> **GHAS (GitHub Advanced Security)** — GitHub's security suite including code scanning (CodeQL), secret scanning, Dependabot, and dependency review.
>
> **SLSA (Supply‑chain Levels for Software Artifacts)** — a framework (pronounced "salsa") that defines increasingly strict levels of build integrity, from source to artefact.
>
> **Sigstore** — an open‑source project providing keyless code‑signing and verification, removing the burden of managing GPG/PGP keys.
>
> **GPG (GNU Privacy Guard)** — a traditional public‑key cryptography tool used to sign Git commits and verify author identity.
>
> **CMK (Customer‑Managed Key)** — an encryption key you own and manage in Azure Key Vault, used instead of Microsoft‑managed keys for data‑at‑rest encryption.
>
> **`pull_request_target`** — a GitHub Actions trigger that runs with the *base* branch's secrets and permissions even when a fork opens a PR. If the workflow checks out and executes fork code, it creates a privilege escalation path.

### Provenance / SLSA

After you know what the pipeline consumed, provenance proves that the artifact being deployed is the artifact the trusted workflow produced. Use [GitHub's artifact attestations](https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
to sign your deploy artifacts (compiled Bicep, planned Terraform), and have the deploy job verify the attestation before applying:

```yaml
- uses: actions/attest-build-provenance@v1
  with:
    subject-path: dist/main.json

# in the deploy job:
- run: gh attestation verify dist/main.json --owner ${{ github.repository_owner }}
```

This makes a "build a malicious artifact and apply it directly" attack
detectable, and the same provenance story should extend backward from artifacts to the commits and tags that produced them.

---

## Signed commits

Because artifact attestations only prove the integrity of build outputs, you should also require commits and release tags to be signed and verified before they become trusted inputs. Sigstore / `gitsign` is the default for organisation‑wide enforcement, although there are two practical options:

* **Sigstore / `gitsign`** — keyless, OIDC‑backed signing. No GPG keys to
  manage; signatures verifiable on GitHub.
* **GPG / SSH signing** — traditional, requires key distribution.

In CI, verify the signatures on the commits included in each pull request:

```yaml
- name: Verify signatures on commits in this PR
  run: |
    base=${{ github.event.pull_request.base.sha }}
    head=${{ github.event.pull_request.head.sha }}
    git log --pretty='%H %G?' "$base..$head" | awk '$2 != "G" { print "unsigned: "$1; exit 1 }'
```

Signatures make unauthorized source changes visible; runner isolation limits what a compromised job can do after signed code starts executing.

---

## Securing CI runners

Once source and artifacts are verifiable, the next question is where that trusted code executes. Use GitHub‑hosted larger runners with static IPs for most jobs, and reserve ephemeral isolated self‑hosted runners for production or regulated deployments, because GitHub‑hosted runners are convenient but have caveats for sensitive estates:

| Concern | GitHub‑hosted | Self‑hosted on Azure |
|---------|---------------|----------------------|
| IP allowlist | Possible via larger runners with static IPs | Trivially yours |
| Network egress control | Limited | Full (NSG/Firewall) |
| Tooling control | Microsoft‑maintained images | You patch (more work, more control) |
| Compromise blast radius | High (shared infra) | Limited |

For most workflows, GitHub‑hosted **larger runners with static IPs** give you the best balance of operational simplicity and access control; for foundation and production deployments, use self‑hosted runners on a **dedicated subscription** where the network boundary is part of the control. Self‑hosted runners must be:

* Ephemeral (one job per VM, then destroyed). Use the
  [actions-runner-controller](https://github.com/actions/actions-runner-controller)
  on AKS or Azure VM Scale Sets with auto‑scale.
* In a network‑isolated subscription with egress only to required APIs
  (Azure Resource Manager (ARM), Microsoft Graph, GitHub).
* Authenticated via a Managed Identity (no personal access token (PAT) for runner registration —
  use the GitHub App‑based runner registration).

Runner isolation narrows blast radius; workflow hardening reduces the chance that a job becomes malicious in the first place.

---

## Workflow hardening (GitHub Actions)

Runner isolation reduces blast radius, but the workflow YAML itself is still production security code and should start with least privilege, bounded execution, environment gates, and no checkout credentials left behind. In practice, a handful of settings make an outsized difference:

```yaml
permissions:                # ← always start with least privilege
  contents: read

concurrency:                # ← prevent duplicate parallel applies
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    environment: prod       # ← gates with reviewers
    timeout-minutes: 60     # ← bound runaway jobs

    steps:
      - uses: actions/checkout@<sha>
        with:
          persist-credentials: false   # ← no GITHUB_TOKEN left on disk
      - uses: actions/setup-node@<sha>
      # ...
```

Run `actionlint` and `zizmor` (workflow security scanner) in CI so the workflow definition is checked with the same seriousness as the IaC it runs. Even a hardened, well‑scoped workflow produces an artefact that deserves its own security treatment: the Terraform state file.

---

## State file security (Terraform)

The first downstream artifact to secure is Terraform state, because state files **contain secrets in cleartext** by default and should be protected like Azure Key Vault. State can include database passwords, storage keys, and certificates, so treat the backend as a privileged system rather than a convenient blob container:

* Backend storage account: **firewall‑restricted**, **private endpoint**,
  **CMK encryption**, **soft‑delete + versioning enabled**, **diagnostic
  logging to Log Analytics Workspace (LAW)**.
* Access only via the deploy service principal (SPN); humans access via Privileged Identity Management (PIM) with full audit.
* Use `azurerm` backend with `use_oidc = true` so the runner authenticates
  the same way it authenticates ARM.
* Never download state to a developer laptop.

The backend design details are covered in [07 state management](07-state-management.md), but the security point here is simpler: locking down the artefacts your pipeline produces addresses only one dimension of compliance. The other is preventing those artefacts from representing non‑compliant configurations in the first place.

---

## Policy / compliance gates

Once state is protected, policy gates make sure the secured pipeline is not faithfully deploying something non‑compliant. Treat policy as a **merge‑blocking CI check**, not a deployment afterthought:

* Custom Azure Policy definitions live in version control alongside their
  assignments.
* On PR, run `Conftest` / `Checkov` / `tfsec` / **PSRule for Azure** against
  the planned changes — block the merge on critical findings.
* Detail in [09 testing & policy](09-testing-and-policy.md).

These checks reduce the likelihood of a bad change reaching production, but they do not remove the need for a rehearsed response when a credential leak or compromised pull request gets through anyway.

---

## Incident playbook (one paragraph)

Even with policy gates in place, you should assume that a credential leak or compromised pull request will happen and document the response order before the incident. When something happens — leaked credential, compromised PR — the response order is:

1. **Revoke** the credential / app role / token.
2. **Rotate** anything touched by the compromised identity.
3. **Audit** Entra sign‑in logs and ARM activity logs for the blast window.
4. **Re‑deploy** affected resources from a known‑good Git SHA.
5. **Postmortem**, then update playbook and protections.

Document this in your repo (`docs/runbooks/credential-leak.md`), because when you need it, you won't have time to invent it. For regulated or sovereign estates, the same evidence discipline has to be designed into the landing zone itself rather than added after the first audit request.

---

## Sovereign Landing Zone (SLZ) — when compliance demands more

Where compliance demands sovereignty, treat the Sovereign Landing Zone (SLZ) as a composable overlay on ALZ and map each sovereignty requirement to policy, evidence, and pipeline controls. SLZ is not a separate product; it is a **variant layer** that sits on top of the standard ALZ and adds sovereignty controls
at three levels:
| Level | Controls |
|-------|----------|
| **L1 — Baseline** | Data residency policies, encryption requirements, audit logging to sovereign region. |
| **L2 — Enhanced** | Confidential computing management groups, restricted service endpoints, HSM‑backed key management. |
| **L3 — Full sovereign** | Customer‑managed keys everywhere, no data leaving the sovereign region, confidential VMs for management workloads. |

Because SLZ uses the same ALZ library and modules, the difference is in the
**archetype overrides** and additional policy assignments. If you later
need to add sovereign controls to a standard ALZ, you can layer SLZ
archetypes onto your existing configuration without re‑deploying from
scratch.

> 🎥 **From the ALZ Weekly Questions** — [When to use SLZ over ALZ?](https://www.youtube.com/watch?v=r8h7F6IJIqw)
> Think of SLZ as a composable overlay: ALZ base + SLZ layer + your local customisations. The `alzlibtool` handles the composition.

Those overlay controls govern what can be deployed; the next concern is protecting the baseline resources after subscription vending creates them.

---

## Protecting vended resources — defence in depth

Whether you deploy standard ALZ or SLZ overlays, platform‑vended resources need overlapping controls because no single guardrail is enough. When subscription vending creates baseline resources such as resource groups, networking, and diagnostic settings, the platform team needs to prevent workload teams from accidentally modifying or deleting them through deny assignments, scoped Role-Based Access Control (RBAC), and deny policies:

1. **Deny assignments via Deployment Stacks** — when the platform team's
   Deployment Stack owns baseline resources with `denyWriteAndDelete`,
   workload teams physically cannot modify those resources even with
   Contributor role on the subscription.

2. **RBAC at resource group scope, not subscription scope** — instead of
   granting `Contributor` on the entire subscription, grant it only on the
   resource groups the app team owns. The platform‑managed resource groups
   (e.g. `rg-networking`, `rg-diagnostics`) have separate, restrictive
   RBAC.

3. **Deny‑action policies with tag‑based exclusions** — a custom deny
   policy prevents deletion of resources tagged `managed-by: platform`.
   App teams can manage resources without that tag freely.

These mechanisms layer on top of each other, so if any one fails, the others
still protect the baseline.

> 🎥 **From the ALZ Weekly Questions** — [Subscription Vending: Repo Structure, Security & Multi-Tenant](https://www.youtube.com/watch?v=11PmT0t6TUI)
> The combination of deny assignments + scoped RBAC + tag‑based deny policies gives you defence in depth without blocking legitimate workload operations.

The anti‑patterns below are what happens when teams knowingly remove one of those overlapping controls for speed and then forget that the exception exists.

---

## Anti‑patterns

These shortcuts are red flags because they trade short‑term delivery speed for persistent compromise paths.

* ❌ **Adding `--allow-secret` patterns to bypass scanning.** That's how
  real secrets slip through.
* ❌ **`pull_request_target` with checkout of PR code.** Classic privilege
  escalation vector — a PR from a fork can read your secrets. Use
  `pull_request` for untrusted PRs.
* ❌ **Self‑hosted runners on a long‑lived VM with cached credentials.** A
  single compromised job persists into the next.
* ❌ **GitHub Personal Access Tokens for cross‑repo automation.** Use a
  GitHub App with fine‑grained, time‑limited installation tokens.
* ❌ **Disabling `terraform plan` policy checks "just for this PR".** It
  becomes permanent.

Security is not a single gate but a set of overlapping controls, each assuming the others will occasionally fail. The practices in this chapter — eliminating secrets at source, hardening runners and workflows, signing artefacts, and enforcing policy checks before merge — are most valuable precisely because no single one of them is foolproof. Chapter 07 shifts focus from the pipeline itself to what the pipeline produces: the state files and deployment stacks that record the current shape of your Azure estate, and which carry their own considerable operational risk if you get the topology wrong.

---

## References

* GitHub, *Security hardening for GitHub Actions*:
  <https://docs.github.com/actions/security-guides/security-hardening-for-github-actions>
* GitHub, *Secret scanning*:
  <https://docs.github.com/code-security/secret-scanning>
* OpenSSF, *SLSA*: <https://slsa.dev/>
* Sigstore, *gitsign*: <https://github.com/sigstore/gitsign>
* Microsoft, *PSRule for Azure*:
  <https://azure.github.io/PSRule.Rules.Azure/>
* Bridgecrew, *Checkov*: <https://www.checkov.io/>
* Aqua, *tfsec*: <https://aquasecurity.github.io/tfsec/>
* `gitleaks`: <https://github.com/gitleaks/gitleaks>
* `actionlint`: <https://github.com/rhysd/actionlint>
* `zizmor` (Actions audit): <https://github.com/woodruffw/zizmor>
* 🎥 ALZ Weekly — *When to use SLZ over ALZ?*:
  <https://www.youtube.com/watch?v=r8h7F6IJIqw>
* 🎥 ALZ Weekly — *Subscription Vending: Repo Structure, Security & Multi-Tenant*:
  <https://www.youtube.com/watch?v=11PmT0t6TUI>

---

[← 05 Authentication](05-authentication.md) · [Index](../README.md) · [07 State management →](07-state-management.md)
