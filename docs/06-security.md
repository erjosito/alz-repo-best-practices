# 06 · Secrets & supply‑chain security

> **Decision:** how do you keep credentials out of code, prove the integrity
> of what's deployed, and stay ahead of supply‑chain attacks?

[← 05 Authentication](05-authentication.md) · [Index](../README.md) · [07 State management →](07-state-management.md)

---

## The threat model

For an IaC repo that controls an enterprise Azure estate, the realistic
attack vectors are:

1. **Leaked secrets** in Git history.
2. **Compromised contributor account** pushing a malicious change.
3. **Compromised CI runner** exfiltrating tokens or planting backdoors.
4. **Malicious / typo‑squatted module dependency** (Terraform Registry, npm,
   PyPI, GitHub Actions in `uses:`).
5. **State file leakage** exposing secrets baked into resources.
6. **Drift / out‑of‑band change** introducing an unreviewed configuration.

The mitigations below address each.

---

## Secrets in code — eliminate, don't manage

The best secret is the one you never store. Combine these:

* **OIDC for cloud auth** (see [05 authentication](05-authentication.md)).
* **Reference Key Vault for application secrets**, never inline them:
  ```bicep
  module app 'app.bicep' = {
    params: {
      sqlPassword: keyVault.getSecret('sql-admin-password')
    }
  }
  ```
* **Generate secrets in‑pipeline** (e.g. random storage SAS) and write them
  straight to Key Vault — they never appear in logs or state.
* **Mark all sensitive Terraform variables `sensitive = true`** so they don't
  print in plan output. (They will still appear in state — see below.)

### Pre‑commit secret scanning

Run on every developer machine **and** in CI. Two layers catch what one
misses.

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

In CI, run `gitleaks detect` on every PR with `--redact` and fail the build
on any finding. Maintain an **allowlist file** for false positives, reviewed
quarterly.

GitHub native:

* **Push protection** for secret scanning — blocks pushes that contain known
  secret patterns. Enable for every repo.
* **Secret scanning alerts** — also scans dependency files.

If a real secret is committed: **rotate the credential first**, then purge
history (`git filter-repo` / GitHub support). Order matters; the secret was
public the moment it was pushed.

---

## Branch protection that matters

| Setting | Recommended |
|---------|-------------|
| Require PR before merge | ✅ |
| Require review approvals | ≥ 1 (≥ 2 for foundation/policy) |
| Require review from CODEOWNERS | ✅ |
| Dismiss stale reviews on new commits | ✅ |
| Require signed commits | ✅ (Sigstore/gitsign or GPG) |
| Require linear history | ✅ |
| Require status checks | lint, plan, security‑scan, policy |
| Require conversation resolution | ✅ |
| Restrict who can push | only the deploy bot for `main` |
| Disallow force push / deletion | ✅ |

GitHub's **rulesets** let you apply these across all repos in an org —
prefer rulesets over per‑repo branch protection for consistency.

---

## Supply‑chain hygiene

### Pin everything by digest, not by tag

Tags are mutable. A malicious maintainer can re‑point `v1.0.0` to a
compromised commit. Pin GitHub Actions by SHA:

```yaml
# ❌ Bad — tag is mutable
- uses: hashicorp/setup-terraform@v3

# ✅ Good — pinned to a SHA
- uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd # v3.1.2
```

Use **Dependabot** with `dependency-type: version-update:semver-major`
disabled and `version-update:semver-patch` auto‑merged after CI passes — you
get security updates without unsupervised major bumps.

For Terraform modules, lock with `.terraform.lock.hcl` (committed) and run
`terraform init -upgrade` only via PRs.

### SBOM for IaC?

Less mature than for application code, but worth doing:

* For Terraform, generate a module dependency report
  (`terraform providers schema -json` + custom tooling).
* For Bicep, `bicep build --stdout` then parse `metadata` blocks plus
  `br:` module references.
* Store SBOMs as build artifacts; ingest into your SCA tool (GHAS,
  Snyk, etc.).

### Provenance / SLSA

Use [GitHub's artifact attestations](https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
to sign your deploy artifacts (compiled Bicep, planned Terraform). The
deploy job verifies the attestation before applying:

```yaml
- uses: actions/attest-build-provenance@v1
  with:
    subject-path: dist/main.json

# in the deploy job:
- run: gh attestation verify dist/main.json --owner ${{ github.repository_owner }}
```

This makes a "build a malicious artifact and apply it directly" attack
detectable.

---

## Signed commits

Require commits to be signed and verified. Two practical options:

* **Sigstore / `gitsign`** — keyless, OIDC‑backed signing. No GPG keys to
  manage; signatures verifiable on GitHub.
* **GPG / SSH signing** — traditional, requires key distribution.

In CI:

```yaml
- name: Verify signatures on commits in this PR
  run: |
    base=${{ github.event.pull_request.base.sha }}
    head=${{ github.event.pull_request.head.sha }}
    git log --pretty='%H %G?' "$base..$head" | awk '$2 != "G" { print "unsigned: "$1; exit 1 }'
```

---

## Securing CI runners

GitHub‑hosted runners are convenient but have caveats for sensitive estates:

| Concern | GitHub‑hosted | Self‑hosted on Azure |
|---------|---------------|----------------------|
| IP allowlist | Possible via larger runners with static IPs | Trivially yours |
| Network egress control | Limited | Full (NSG/Firewall) |
| Tooling control | Microsoft‑maintained images | You patch (more work, more control) |
| Compromise blast radius | High (shared infra) | Limited |

**Recommended:** GitHub‑hosted **larger runners with static IPs** for most
workflows; self‑hosted runners on a **dedicated subscription** for
foundation/prod deploys. Self‑hosted runners must be:

* Ephemeral (one job per VM, then destroyed). Use the
  [actions-runner-controller](https://github.com/actions/actions-runner-controller)
  on AKS or Azure VM Scale Sets with auto‑scale.
* In a network‑isolated subscription with egress only to required APIs
  (ARM, Microsoft Graph, GitHub).
* Authenticated via a Managed Identity (no PAT for runner registration —
  use the GitHub App‑based runner registration).

---

## Workflow hardening (GitHub Actions)

Top hits from `actionlint` + experience:

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

Run `actionlint` and `zizmor` (workflow security scanner) in CI.

---

## State file security (Terraform)

State files **contain secrets in cleartext** by default — DB passwords,
storage keys, certs. Treat the state backend as you would a Key Vault:

* Backend storage account: **firewall‑restricted**, **private endpoint**,
  **CMK encryption**, **soft‑delete + versioning enabled**, **diagnostic
  logging to LAW**.
* Access only via the deploy SPN; humans access via PIM with full audit.
* Use `azurerm` backend with `use_oidc = true` so the runner authenticates
  the same way it authenticates ARM.
* Never download state to a developer laptop.

Details in [07 state management](07-state-management.md).

---

## Policy / compliance gates

Treat policy as a **CI check**, not a deployment afterthought:

* Custom Azure Policy definitions live in version control alongside their
  assignments.
* On PR, run `Conftest` / `Checkov` / `tfsec` / **PSRule for Azure** against
  the planned changes — block the merge on critical findings.
* Detail in [09 testing & policy](09-testing-and-policy.md).

---

## Incident playbook (one paragraph)

When (not if) something happens — leaked credential, compromised PR — the
response order is:

1. **Revoke** the credential / app role / token.
2. **Rotate** anything touched by the compromised identity.
3. **Audit** Entra sign‑in logs and ARM activity logs for the blast window.
4. **Re‑deploy** affected resources from a known‑good Git SHA.
5. **Postmortem**, then update playbook and protections.

Document this in your repo (`docs/runbooks/credential-leak.md`). When you
need it, you won't have time to invent it.

---

## Anti‑patterns

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

---

[← 05 Authentication](05-authentication.md) · [Index](../README.md) · [07 State management →](07-state-management.md)
