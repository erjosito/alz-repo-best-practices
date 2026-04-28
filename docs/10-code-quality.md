# 10 · Code quality, linting & developer experience

> **Decision:** what does it look like to clone the repo and submit a
> high‑quality PR on day one? DX is a force multiplier — invest in it.

[← 09 Testing & policy](09-testing-and-policy.md) · [Index](../README.md) · [11 Manageability →](11-manageability.md)

Good infrastructure code doesn't just work — it's readable, self-documenting, and easy to contribute to. The best IaC teams treat developer experience as a first-class engineering concern, not an afterthought bolted on when onboarding gets painful. This chapter covers the tools and conventions that collapse the time from `git clone` to productive contribution, and the automation that keeps quality high without relying on humans to remember.

---

## How we got here

The original "developer experience" of an IaC repo was a one‑line
README: *"install Terraform and run `terraform apply`."* Three months
later, half the team was on Terraform 0.11 and half on 0.12, and a fresh
clone took an afternoon to bootstrap. Tooling caught up in waves: `tflint`
(2018) added Azure‑aware lints, `terraform-docs` (2019) generated module
READMEs from the schema, **pre‑commit‑terraform** (2019) bundled it all
into a single `pre-commit install`. The biggest leap was the
**devcontainer** specification (Microsoft, open‑sourced 2022) and
**GitHub Codespaces** — for the first time you could pin every tool, every
extension, and every shell helper in one JSON file and have CI use the
*identical* image. Tools like **`mise`** and **`asdf`** brought the same
discipline to engineers who don't want a container around their editor.
A mature ALZ repo in 2026 should let a new joiner go from `git clone` to
a green `plan` in under five minutes — and that's not aspirational, it's
table stakes. The question is what it actually takes to get there.

> 📘 **Key terms**
>
> **Devcontainer** — a specification (`.devcontainer/devcontainer.json`) that defines a reproducible development environment inside a container, including all tools, extensions, and settings. GitHub Codespaces and VS Code use it natively.
>
> **`mise` / `asdf`** — version‑manager tools that pin CLI tool versions (Terraform, az, tflint) per project via a dotfile (`.mise.toml` / `.tool-versions`), ensuring every developer uses the same versions without containers.
>
> **Taskfile** — a modern alternative to `Makefile` (`Taskfile.yml`) for defining project‑level commands (e.g. `task plan`, `task lint`), with YAML syntax and dependency support.
>
> **Pre‑commit hooks** — Git hooks that run checks (formatting, linting, secret scanning) automatically before each `git commit`, catching issues at the earliest possible stage.
>
> **Conventional Commits** — a commit‑message convention (e.g. `feat:`, `fix:`, `chore:`) that enables automated changelog generation and semantic version bumping.
>
> **EditorConfig** — a simple dotfile (`.editorconfig`) that standardises indent style, charset, and line endings across editors and IDEs.
>
> **Codespaces** — GitHub's cloud‑hosted development environment that launches a devcontainer in the browser, eliminating local setup entirely.

## The "five‑minute onboarding" target

A new engineer should be able to:

```bash
gh repo clone contoso/alz-platform
cd alz-platform
make bootstrap     # installs everything
make plan ENV=nonprod WORKLOAD=connectivity
```

…and see a meaningful plan within **five minutes** of the first `git
clone`. Anything more is friction tax you pay forever.

> ⚖️ **The debate — is five minutes realistic?**
>
> Five minutes is aspirational and achievable for small‑to‑mid repos,
> but practitioners managing large estates (100+ modules, heavy provider
> sets) report that `terraform init` alone can take 2–3 minutes, and
> devcontainer image pulls add another 2–5 on first use. Hitting the
> five‑minute target at scale requires pre‑built devcontainer images
> (ongoing maintenance cost), local provider caching, and carefully
> curated module sets — effort that not every team can justify.
>
> A more realistic goal for large estates: **under fifteen minutes** to
> first meaningful plan. Still fast, less likely to set an expectation
> that fails on day one. The five‑minute target remains the *aspiration*;
> document what your actual number is and actively work to reduce it.

The two ingredients: **devcontainers** and **a `Makefile` (or `Taskfile`)**.

---

## Devcontainer / mise / asdf

Pin tool versions in the repo. Three viable approaches:

### Devcontainer (recommended for VS Code / Codespaces shops)

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "alz-platform",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu-24.04",
  "features": {
    "ghcr.io/devcontainers/features/azure-cli:1": {},
    "ghcr.io/devcontainers/features/terraform:1": { "version": "1.9.5" },
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers/features/powershell:1": {}
  },
  "postCreateCommand": "make bootstrap",
  "customizations": {
    "vscode": {
      "extensions": [
        "hashicorp.terraform",
        "ms-azuretools.vscode-bicep",
        "github.vscode-github-actions",
        "redhat.vscode-yaml"
      ]
    }
  }
}
```

Same container runs locally in VS Code, in GitHub Codespaces, and (with
minor tweaks) in CI — no "works on my machine" left.

### `mise` / `asdf` (lighter)

```toml
# .mise.toml
[tools]
terraform = "1.9.5"
bicep     = "0.30.3"
azure-cli = "2.65.0"
node      = "20.18.0"
```

Engineers run `mise install` once and have the same versions as CI.

Pinning the tools solves the "which version?" problem. The next step is making those tools easy to invoke without memorising long incantations.

---

## `Makefile` as a UX layer

Hide the long incantations behind short, memorable commands.

```makefile
ENV ?= nonprod
WORKLOAD ?= connectivity
TF_DIR := envs/$(ENV)/$(WORKLOAD)

.PHONY: bootstrap fmt lint plan apply test clean

bootstrap:
	pre-commit install
	cd $(TF_DIR) && terraform init -input=false

fmt:
	terraform fmt -recursive
	bicep format

lint:
	pre-commit run --all-files
	tflint --recursive

plan:
	cd $(TF_DIR) && terraform plan -var-file=terraform.tfvars -out=tfplan

apply:
	@if [ "$(ENV)" = "prod" ]; then \
	  echo "Use the pipeline for prod. Refusing to apply locally."; exit 1; \
	fi
	cd $(TF_DIR) && terraform apply tfplan

test:
	cd modules && terraform test

clean:
	find . -type d -name '.terraform' -prune -exec rm -rf {} +
```

Note `make apply` refuses to run against `prod` — the only way to apply
prod is the pipeline.

---

## Pre‑commit hooks

`pre-commit` is the highest ROI single tool to add to an IaC repo.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-added-large-files

  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.92.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_tflint
      - id: terraform_docs
        args: [--args=--config=.terraform-docs.yml]

  - repo: https://github.com/bridgecrewio/checkov
    rev: 3.2.255
    hooks:
      - id: checkov
        args: [-d, ., --quiet, --soft-fail]   # informational locally; fatal in CI

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks

  - repo: https://github.com/rhysd/actionlint
    rev: v1.7.1
    hooks:
      - id: actionlint
```

Run the **same hooks in CI** — `pre-commit run --all-files` — so what's
caught locally and what's caught in CI is identical.

Hooks handle the checks. Documentation is a different discipline — and the kind that degrades fastest when it has to be maintained by hand.

---

## Auto‑generated module documentation

Every module's `README.md` is generated from its variables and outputs.
Engineers never write them by hand; CI verifies they're current.

`.terraform-docs.yml`:

```yaml
formatter: markdown table
output:
  file: README.md
  mode: inject
  template: |-
    <!-- BEGIN_TF_DOCS -->
    {{ .Content }}
    <!-- END_TF_DOCS -->
sort:
  enabled: true
  by: required
```

CI step:

```yaml
- run: terraform-docs --output-check markdown table modules/network/hub
```

For Bicep, use [`PSDocs.Azure`](https://github.com/Azure/PSDocs.Azure) or
parse the `metadata` blocks with a custom script.

---

## Conventional commits + automated releases

Force commit messages into a parseable shape:

```
feat(network/hub): add Azure Firewall premium SKU support
fix(identity): correct role assignment scope for spoke VNets
chore(ci): bump terraform to 1.9.5

BREAKING CHANGE: hub module renamed param `firewall_sku_name` → `firewall_sku`
```

Tools:

* `commitlint` + Husky to validate locally.
* `release-please` (recommended) or `semantic-release` to automate:
  * Tag + GitHub Release.
  * `CHANGELOG.md` update.
  * Migration notes in release body.

The benefit compounds: every consumer's Renovate bot can post a
"v1.5.0 → v1.6.0" PR with the changelog inline.

Structured commits make the changelog practically free. The remaining pieces of the DX puzzle are smaller but worth locking down: editor settings that prevent trivial formatting noise, and templates that shape what contributions look like before they hit the pipeline.

---

## Editor configuration

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{tf,tfvars}]
indent_size = 2

[*.bicep]
indent_size = 2

[*.md]
trim_trailing_whitespace = false  # MD line breaks
```

Combine with Prettier for YAML/MD/JSON; Bicep and Terraform have their
own formatters.

---

## Repository templates

For organisations spinning up many landing‑zone repos, a **GitHub
template repository** + `gh repo create --template` gives every new repo:

* The standard `Makefile`, `.pre-commit-config.yaml`, devcontainer.
* A starter `envs/` skeleton.
* Standard `.github/workflows/*.yml` calling reusable workflows.
* A pre‑filled `CODEOWNERS` you customise.

For more sophisticated scaffolding (with prompts), use **Backstage
templates** or [`copier`](https://copier.readthedocs.io/).

Templates provision the repo. The next layer shapes how contributions land in it.

---

## Issue & PR templates

Make the right thing the easy thing.

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What

## Why

## How (high-level)

## Affected environments
- [ ] nonprod
- [ ] prod

## Checklist
- [ ] `terraform plan` reviewed in CI
- [ ] PSRule findings reviewed
- [ ] Module bumps (if any) include CHANGELOG link
- [ ] If breaking change, ADR added under `docs/adr/`
```

`.github/ISSUE_TEMPLATE/`:

* `bug.yml` (structured form: env, repro, expected vs actual)
* `feature.yml`
* `change-request.yml` (for production changes that need a paper trail)

---

## Local development against Azure

Engineers should be able to safely experiment:

* Each engineer has a personal **sandbox subscription** (or RG) with their
  name as the owner.
* `make plan ENV=sandbox WORKLOAD=hub` runs against their own sub via
  `az login`.
* **Aggressive lifecycle:** all sandbox resource groups have a `DeleteAt`
  tag and a scheduled function/runbook tears down anything past expiry.
* No shared "team‑dev" subscription — they always become the prod everyone
  forgot was prod.

---

## Anti‑patterns

* ❌ **README that says "install Terraform 1.x"** without pinning a
  version. Tomorrow's release breaks today's repo.
* ❌ **Linters that produce warnings nobody reads.** Either fail the build
  or remove the linter.
* ❌ **Module READMEs written by hand.** They drift from the variables in
  one PR.
* ❌ **`make apply` that works against prod.** Pipeline‑only or you lose
  audit trail.
* ❌ **Devcontainer that nobody uses.** Make it the *only* supported path
  — including for CI — and it stays maintained.

Developer experience is the invisible multiplier: when a team can move fast and confidently, the quality of every other practice in this book improves. The Makefile runs the tests, the hooks run the linters, the devcontainer keeps the tools consistent, and the PR template makes the right information the default — all of it compounding quietly. The next chapter turns from how you build and ship the platform to how you keep it observable and manageable once it is running in production.

---

## References

* `pre-commit`: <https://pre-commit.com/>
* `pre-commit-terraform`: <https://github.com/antonbabenko/pre-commit-terraform>
* `terraform-docs`: <https://terraform-docs.io/>
* Devcontainers: <https://containers.dev/>
* `mise`: <https://mise.jdx.dev/>
* `release-please`: <https://github.com/googleapis/release-please>
* `commitlint`: <https://commitlint.js.org/>
* Backstage software templates: <https://backstage.io/docs/features/software-templates/>

---

[← 09 Testing & policy](09-testing-and-policy.md) · [Index](../README.md) · [11 Manageability →](11-manageability.md)
