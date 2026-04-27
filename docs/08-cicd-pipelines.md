# 08 · CI/CD pipeline patterns

> **Decision:** what does the workflow that turns a commit into a deployed
> Azure resource look like — and how do you keep it consistent across many
> repos?

[← 07 State management](07-state-management.md) · [Index](../README.md) · [09 Testing & policy →](09-testing-and-policy.md)

---

## How we got here

Early infrastructure pipelines were **Jenkins freestyle jobs** with the
Terraform commands pasted into a textbox; the pipeline definition lived
in the Jenkins UI, not in Git, so reviewing a deploy meant taking a
screenshot. The "pipeline‑as‑code" movement (Jenkinsfile in 2016, then
Travis/CircleCI YAML, then Azure Pipelines YAML in 2019, then GitHub
Actions in late 2019) finally put deploy logic into version control —
but every repo copy‑pasted the same workflow, and within a year the
copies had drifted. **Reusable workflows** (GitHub Actions, 2021) and
**YAML templates with `extends:`** (Azure DevOps) gave central platform
teams a way to own the pipeline once and have every consumer stay in
sync. Around the same time, the GitOps community pushed the idea of
**ephemeral, short‑lived runners** — and after a string of self‑hosted
runner compromises in 2022–2024, that became the security baseline. The
patterns in this chapter assume reusable workflows, ephemeral runners,
and OIDC auth — the consensus shape of an IaC pipeline in 2026.

## GitHub Actions vs Azure DevOps Pipelines

Both can do the job. Pick on these criteria:

| Factor | GitHub Actions | Azure DevOps Pipelines |
|--------|----------------|------------------------|
| Already there | Yes if code is on github.com | Yes if code is on dev.azure.com |
| OIDC to Azure | Mature, simple | Mature ("Workload identity federation") |
| Reusable workflow / template DX | `workflow_call`, composite actions | YAML templates, extends |
| Marketplace ecosystem | Larger (Actions Marketplace) | Smaller |
| Approval gates / environments | GitHub Environments | Environments + approvals |
| Cost | Generous free + per‑minute | Per‑user + per‑pipeline minute |
| Secret store integration | OIDC + Key Vault works well | Variable groups + Key Vault native |

**Recommendation:** wherever the *code* lives. Don't mix unless you have a
strong reason — the cognitive overhead of two pipeline syntaxes outweighs
any feature delta.

The patterns below are illustrated with **GitHub Actions**; the same shape
works in ADO.

---

## The standard two‑workflow shape

Every IaC repo should have exactly two workflows:

```
.github/workflows/
├── pr.yml      # on: pull_request — validate, plan, comment
└── deploy.yml  # on: push to main — apply, with environment gates
```

Plus shared **reusable workflows** in a central repo (e.g. `alz-pipeline-templates`).

### `pr.yml` (validation)

```yaml
name: PR validation

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  id-token: write
  pull-requests: write   # to post the plan as a PR comment

concurrency:
  group: pr-${{ github.event.number }}
  cancel-in-progress: true

jobs:
  detect:
    # Detect which envs/workloads changed → matrix output
    runs-on: ubuntu-latest
    outputs:
      changed: ${{ steps.detect.outputs.changed }}
    steps:
      - uses: actions/checkout@<sha>
        with: { fetch-depth: 0 }
      - id: detect
        run: ./scripts/detect-changed-envs.sh >> $GITHUB_OUTPUT

  validate:
    needs: detect
    if: needs.detect.outputs.changed != '[]'
    strategy:
      fail-fast: false
      matrix:
        target: ${{ fromJson(needs.detect.outputs.changed) }}
    uses: contoso/alz-pipeline-templates/.github/workflows/tf-validate.yml@v2
    with:
      working-directory: envs/${{ matrix.target }}
    secrets: inherit
```

### `deploy.yml` (apply)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false   # never cancel an in-flight apply

jobs:
  detect:
    runs-on: ubuntu-latest
    outputs:
      changed: ${{ steps.detect.outputs.changed }}
    steps:
      - uses: actions/checkout@<sha>
        with: { fetch-depth: 0 }
      - id: detect
        run: ./scripts/detect-changed-envs.sh >> $GITHUB_OUTPUT

  nonprod:
    needs: detect
    strategy:
      max-parallel: 4
      matrix:
        target: ${{ fromJson(needs.detect.outputs.changed) }}
    uses: contoso/alz-pipeline-templates/.github/workflows/tf-apply.yml@v2
    with:
      working-directory: envs/nonprod/${{ matrix.target }}
      environment: nonprod
    secrets: inherit

  prod:
    needs: nonprod
    strategy:
      max-parallel: 4
      matrix:
        target: ${{ fromJson(needs.detect.outputs.changed) }}
    uses: contoso/alz-pipeline-templates/.github/workflows/tf-apply.yml@v2
    with:
      working-directory: envs/prod/${{ matrix.target }}
      environment: prod    # ← reviewers configured here
    secrets: inherit
```

The **GitHub Environment `prod`** has:

* Required reviewers (e.g. 2 from the platform team).
* A **wait timer** (e.g. 10 minutes) so a "ship it" can be aborted.
* **Deployment branches** restricted to `main`.
* The **OIDC client‑id `vars`** for the prod SPN.

---

## Reusable workflow (the actual work)

Single source of truth — every repo calls these.

`alz-pipeline-templates/.github/workflows/tf-apply.yml`:

```yaml
on:
  workflow_call:
    inputs:
      working-directory: { required: true, type: string }
      environment:       { required: true, type: string }

jobs:
  apply:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    defaults: { run: { working-directory: ${{ inputs.working-directory }} } }
    steps:
      - uses: actions/checkout@<sha>
        with: { persist-credentials: false }

      - uses: hashicorp/setup-terraform@<sha>
        with: { terraform_version: 1.9.5 }

      - uses: azure/login@<sha>
        with:
          client-id:       ${{ vars.AZURE_CLIENT_ID }}
          tenant-id:       ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - run: terraform init -input=false
      - run: terraform plan -input=false -out=tfplan -var-file=terraform.tfvars
      - run: terraform apply -input=false -auto-approve tfplan
      - if: failure()
        run: |
          gh issue create --title "Apply failed: ${{ inputs.working-directory }}" \
                          --body "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

A matching `tf-validate.yml` does `init`, `validate`, `plan`, `tflint`,
`tfsec`/`checkov`, and posts the plan to the PR.

---

## PR comments that are actually useful

Plan output dumped raw into a comment is unreadable. Format it:

* **Collapsed `<details>` block** with the full plan inside.
* A **summary table** at the top: `+ N to add · ~ M to change · - K to
  destroy`.
* **Highlight destructive changes** in bold.
* For Bicep, post the `what-if` output similarly — use `--result-format` to
  get JSON, then render to markdown.

Use the `hashicorp/setup-terraform` Action's built-in PR comment mechanism,
or roll your own with `actions/github-script`.

---

## Detecting changed environments

The detect script is the bit that makes a layered repo scale:

```bash
#!/usr/bin/env bash
# scripts/detect-changed-envs.sh
set -euo pipefail
base="${GITHUB_BASE_REF:-main}"
git fetch origin "$base" --depth=1
changed_dirs=$(git diff --name-only "origin/$base"...HEAD \
  | grep '^envs/' \
  | awk -F/ '{print $2"/"$3}' \
  | sort -u)
json=$(printf '%s\n' "$changed_dirs" | jq -R . | jq -s -c .)
echo "changed=${json:-[]}"
```

This produces `["nonprod/connectivity","prod/identity"]` and the matrix
explodes it into parallel jobs. Touched modules trigger plan runs in
**every** consumer environment of that module — implement that with a
module‑to‑consumer map maintained in the repo.

---

## Pipeline‑as‑code, but DRY

Patterns to keep many repos consistent:

* **Reusable workflows** (`workflow_call`) — call the same job from many
  repos, versioned by tag (`@v2`).
* **Composite actions** for short, repo‑agnostic snippets (e.g. "post plan
  to PR").
* **Org‑wide required workflows** — GitHub lets you enforce that a workflow
  *must* run on every PR in selected repos. Use this for policy/security
  checks you can't allow to be removed.
* **Renovate** / Dependabot to bump the pinned `@vX.Y.Z` references in
  every consumer when you ship a new template version.

---

## Long‑running operations & retry

Some Azure operations are flaky (Key Vault soft‑delete naming, AAD
propagation, role assignment lag). Don't paper over with `sleep 30`:

* In Terraform, use `time_sleep` only as a last resort; prefer
  `null_resource` with `local-exec` that polls the desired state.
* Implement **idempotent retry** at the pipeline step level —
  `nick-fields/retry` action with `max_attempts: 3` for known‑flaky steps.
* Bake bug‑specific waits into modules (with comments linking to the
  upstream issue) rather than at the pipeline level — the module is where
  the knowledge belongs.

---

## Manual operations & the "break glass" pipeline

You will need it. Build one consciously:

* `workflow_dispatch` workflow with **inputs**: target environment, target
  workload, action (`plan` / `apply` / `import` / `destroy`).
* Restricted to a small group via the `environment: break-glass` (with two
  reviewers).
* Logs everything; posts a notification to a security channel automatically.

This is far better than engineers running Terraform locally against
production state.

---

## Caching and runtime

A few cheap wins:

* Cache `~/.terraform.d/plugin-cache` and the `.terraform` provider
  directory across runs.
* Use `setup-terraform` with `terraform_wrapper: false` if you parse the
  plan output yourself — the wrapper truncates large outputs.
* For Bicep, cache the compiled JSON between `pr` and `deploy` workflows
  via `actions/cache` keyed on the file SHA.
* Larger runners pay for themselves on `init` heavy plans (more network
  bandwidth, more CPU for `plan`).

---

## Anti‑patterns

* ❌ **Per‑repo, hand‑rolled workflows.** They diverge within a quarter.
  Use reusable workflows.
* ❌ **`apply` without an explicit `plan` artifact** — what got applied is
  not necessarily what was reviewed.
* ❌ **`continue-on-error: true`** to "make the build green" while
  investigating. Fix or skip; never silently swallow.
* ❌ **Pipelines that need a human to copy a value between steps.** That's
  not automation, that's a Slack thread.
* ❌ **Using `cancel-in-progress: true` on the deploy concurrency group.**
  An in‑flight `apply` should always finish; cancellation can corrupt state.
* ❌ **One pipeline that deploys all environments serially in one run.**
  Use environment gates between non‑prod and prod, not a long script.

---

## References

* GitHub, *Reusable workflows*:
  <https://docs.github.com/actions/using-workflows/reusing-workflows>
* GitHub, *Required workflows*:
  <https://docs.github.com/actions/using-workflows/required-workflows>
* GitHub, *Environments*:
  <https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment>
* Azure DevOps, *YAML templates*:
  <https://learn.microsoft.com/azure/devops/pipelines/process/templates>
* Hashicorp, *Run Terraform in CI*:
  <https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform>

---

[← 07 State management](07-state-management.md) · [Index](../README.md) · [09 Testing & policy →](09-testing-and-policy.md)
