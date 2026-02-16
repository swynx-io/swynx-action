# Swynx — Dead Code Detection for Pull Requests

> Catch dead code before it ships. Scans **35 languages**, posts actionable PR comments, and blocks merge on new dead code.

[![GitHub Marketplace](https://img.shields.io/badge/GitHub-Marketplace-blue?logo=github)](https://github.com/marketplace/swynx)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

```yaml
- uses: swynx-io/swynx-action@v1
```

---

## What it does

On every pull request, Swynx:

1. **Scans** your entire codebase for dead files — files unreachable from any entry point
2. **Diffs** against the base branch to classify dead files as **new in this PR** vs pre-existing
3. **Posts** a clear summary comment on the PR with metrics and file tables
4. **Blocks merge** if the PR introduces new dead code (configurable)
5. **Scans dead code for security vulnerabilities** — CWE patterns like injection, XSS, and file upload in unreachable files

### Example PR comment

<img width="600" alt="Swynx PR comment showing dead code report with metrics table and new dead files" src="https://swynx.io/assets/github-action-comment.png">

```
## ✅ Swynx Dead Code Report

| Metric           | Value     |
|------------------|-----------|
| Files scanned    | **1,247** |
| Entry points     | **48**    |
| Dead files       | **12**    |
| Dead code rate   | **0.96%** |

🚨 2 new dead files in this PR

| File                         | Language   | Lines |
|------------------------------|------------|-------|
| src/utils/old-helper.ts      | TypeScript | 58    |
| src/lib/unused-factory.js    | JavaScript | 32    |
```

---

## Quick start

Create `.github/workflows/dead-code.yml`:

```yaml
name: Dead Code Check
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  swynx:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for git diff

      - uses: swynx-io/swynx-action@v1
        with:
          fail-on-new-dead-code: true
```

That's it. No config files, no API keys, no setup. Entry points are auto-detected from `package.json`, build configs, HTML files, and framework conventions.

> **Important:** `fetch-depth: 0` is required so the action can compare your PR against the base branch.

> **Important:** The `pull-requests: write` permission is required for the action to post comments on the PR.

---

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `path` | `.` | Path to scan (relative to repo root) |
| `threshold` | `0` | Max allowed dead code rate (%). Fails if exceeded. `0` = disabled |
| `fail-on-new-dead-code` | `true` | Fail the check if the PR introduces new dead files |
| `post-comment` | `true` | Post a summary comment on the PR |
| `inline-comments` | `false` | Leave inline review comments on dead files (Team) |
| `security` | `true` | Enable security scanning of dead code |
| `sarif` | `false` | Generate SARIF output for Code Scanning tab (Team) |
| `sarif-file` | `swynx-results.sarif` | SARIF output file path |
| `token` | `${{ github.token }}` | GitHub token for PR comments |
| `license-key` | `''` | Swynx license key (unlocks paid features) |

## Outputs

| Output | Description |
|--------|-------------|
| `dead-files` | Total number of dead files found |
| `dead-rate` | Dead code percentage (e.g. `3.93`) |
| `new-dead-files` | Dead files introduced by this PR |
| `security-findings` | Security findings in dead code |

---

## Examples

### Block PRs that add dead code

```yaml
- uses: swynx-io/swynx-action@v1
  with:
    fail-on-new-dead-code: true
```

### Set a dead code budget

Allow some dead code, but fail if the overall rate exceeds a threshold:

```yaml
- uses: swynx-io/swynx-action@v1
  with:
    threshold: 5                   # Fail if dead code > 5%
    fail-on-new-dead-code: false   # Allow new dead code if under budget
```

### Scan a subdirectory

```yaml
- uses: swynx-io/swynx-action@v1
  with:
    path: './src'
```

### SARIF output for GitHub Code Scanning

Upload results to the Security tab alongside CodeQL findings:

```yaml
- uses: swynx-io/swynx-action@v1
  with:
    sarif: true
    license-key: ${{ secrets.SWYNX_LICENSE }}

- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: swynx-results.sarif
```

### Use outputs in later steps

```yaml
- uses: swynx-io/swynx-action@v1
  id: swynx

- run: echo "Dead code rate is ${{ steps.swynx.outputs.dead-rate }}%"

- name: Notify on new dead code
  if: steps.swynx.outputs.new-dead-files > 0
  run: |
    echo "⚠️ ${{ steps.swynx.outputs.new-dead-files }} new dead files detected"
```

### Full configuration

```yaml
- uses: swynx-io/swynx-action@v1
  with:
    path: '.'
    threshold: 5
    fail-on-new-dead-code: true
    post-comment: true
    inline-comments: true
    security: true
    sarif: true
    sarif-file: swynx-results.sarif
    license-key: ${{ secrets.SWYNX_LICENSE }}
```

---

## Supported languages

**35 languages** with full import resolution:

| Tier | Languages |
|------|-----------|
| **Tier 1** (AST parsing) | JavaScript, TypeScript, Vue, Python, Go, Java, Kotlin, PHP, Ruby, Rust |
| **Tier 2** (Regex parsing) | C#, Dart, Swift, Scala, Elixir, Haskell, Lua, C/C++, Perl, R, Clojure, F#, OCaml, Julia, Zig, Nim, Erlang, Groovy, Crystal, V, Objective-C, Shell/Bash, PowerShell, COBOL, Fortran |

Tested across **3,000,000+ files** in open source projects with **99.99% accuracy**.

---

## How it works

1. **Discovery** — Walks every source file in the repo, respecting `.swynxignore` and `.swynx-lite.json`
2. **Entry point detection** — Auto-detects from `package.json` (main/module/exports/bin), build configs (vite, webpack, tsconfig), HTML files, and 50+ framework conventions (Next.js pages, Django views, Rails controllers, NestJS modules, etc.)
3. **Import graph** — Builds a complete dependency graph from imports, requires, and dynamic imports
4. **BFS reachability** — Traverses from every entry point. Files not reached = dead
5. **PR diff classification** — Compares against `git diff` to distinguish new dead code from pre-existing
6. **Security scanning** — Checks dead files for CWE vulnerability patterns (injection, XSS, file upload, etc.)

**No configuration required.** The scanner auto-detects entry points, resolves path aliases, handles monorepo workspaces, and understands framework conventions out of the box.

---

## Configuration files

### `.swynx-lite.json`

```json
{
  "ignore": [
    "**/__tests__/**",
    "**/*.test.*",
    "**/*.spec.*",
    "scripts/**",
    "docs/**"
  ]
}
```

### `.swynxignore`

Gitignore-style patterns:

```
__tests__/
*.test.*
*.spec.*
scripts/
docs/
dist/
coverage/
```

---

## Security scanning

Dead code with security vulnerabilities is a hidden attack surface. Swynx detects CWE patterns including:

- **CWE-78** — OS command injection
- **CWE-79** — Cross-site scripting (XSS)
- **CWE-89** — SQL injection
- **CWE-94** — Code injection
- **CWE-434** — Arbitrary file upload
- **CWE-502** — Unsafe deserialisation

Security findings are included in the PR comment (collapsed by default) and in SARIF output for Code Scanning integration.

**Free tier:** Security summary (severity + CWE + file).
**Team tier:** Full details including risk context and remediation guidance.

---

## Pricing

| | Free | Team (£9/mo) |
|---|:---:|:---:|
| Public repos | Unlimited | Unlimited |
| Private repos | 3 | Unlimited |
| PR summary comment | ✅ | ✅ |
| Security scanning | Summary | Full details |
| Inline review comments | — | ✅ |
| SARIF / Code Scanning | — | ✅ |
| Run history & trends | — | ✅ |

**Free forever for open source.** No licence key needed for public repos.

[Get a licence key](https://swynx.io/github-action) for unlimited private repos and advanced features.

---

## Monorepo support

Works with:

- npm/pnpm/Yarn workspaces
- Turborepo
- Nx
- Lerna
- Cargo workspaces (Rust)
- Go workspaces

Use the `path` input to scope scans to specific packages:

```yaml
- uses: swynx-io/swynx-action@v1
  with:
    path: './packages/core'
```

---

## Performance

| Codebase size | Typical scan time |
|---------------|-------------------|
| < 5,000 files | 15–30 seconds |
| 5,000–20,000 files | 30–90 seconds |
| 20,000–50,000 files | 2–3 minutes |

Scans run entirely on the GitHub runner. Your code never leaves your infrastructure.

---

## Related

- **[Swynx Lite](https://github.com/swynx-io/swynx-lite)** — Free CLI tool for local scanning
- **[Swynx](https://swynx.io)** — Full platform with dashboard, decay tracking, security scanning, ESG reporting, and enterprise features
- **[Documentation](https://swynx.io/docs)** — Full docs including API reference
- **[Website](https://swynx.io/github-action)** — Product page with interactive demo

---

## FAQ

**Does my code leave GitHub?**
No. The action runs entirely on GitHub's runners. No external API calls are made for scanning.

**Do I need a licence key?**
Not for the free tier. Add a key to unlock inline reviews, merge blocking, and SARIF output.

**How accurate is it?**
99.99% across 3,000,000+ files in open source projects.

**Does it work with monorepos?**
Yes. Auto-detects workspace configurations for npm, pnpm, Yarn, Turborepo, Nx, Lerna, Cargo, and Go workspaces.

**What's the difference between this and the CLI?**
Same detection engine, different delivery. The CLI is for local use, the Action runs automatically on PRs.

---

## Licence

MIT
