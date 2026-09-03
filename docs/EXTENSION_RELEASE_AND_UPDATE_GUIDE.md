# AiMemorySync VS Code Extension — Release & Auto-Update Guide

> **Author & Lead Architect:** PSG Praveen ([@psgpraveen](https://github.com/psgpraveen))  
> **Package:** `aimemory-vscode` (`packages/vscode-extension`)  
> **Platforms Supported:** Antigravity IDE, VS Code, Cursor, Open VSX Registry  

---

## Overview

This guide provides the official operational procedures for developing, packaging, testing, releasing, and distributing the **AiMemorySync VS Code Extension** (`aimemory-vscode`).

AiMemorySync adheres strictly to native marketplace update mechanisms (Open VSX / VS Code Marketplace). In accordance with VS Code extension architecture standards:
1. **No custom self-updaters:** The extension never attempts to download and overwrite executable files at runtime.
2. **Native Update Mechanism:** Updates are delivered either via Open VSX/marketplace registry feeds or via user-initiated VSIX installations.
3. **Reproducible Packaging:** Release artifacts are cryptographically hashed and built through automated pre-flight quality gates.
4. **Secret-Free Artifacts:** Zero tokens, API keys, or development scripts are ever packed into release bundles.

---

## Table of Contents

1. [Local VSIX Development Workflow](#1-local-vsix-development-workflow)
2. [Semantic Versioning Strategy](#2-semantic-versioning-strategy)
3. [Release Checklist](#3-release-checklist)
4. [Antigravity IDE & VS Code Installation](#4-antigravity-ide--vs-code-installation)
5. [Open VSX Publishing Preparation](#5-open-vsx-publishing-preparation)
6. [How Native Auto-Update Works](#6-how-native-auto-update-works)
7. [VSIX Manual Installation vs. Marketplace Distribution](#7-vsix-manual-installation-vs-marketplace-distribution)
8. [Security Considerations](#8-security-considerations)

---

## 1. Local VSIX Development Workflow

During active development, you want rapid iteration without running full release validation on every packaging run:

### Build Bundle
```bash
# Build the single-file CJS bundle
npm run build:extension
# or from packages/vscode-extension
npm run build
```

### Fast Local Package (Skips Full Test Suite)
```bash
# Packages directly into packages/vscode-extension/releases/
cd packages/vscode-extension
npm run package
```
*The `npm run package` command bypasses the full integration test suite and forces local artifact generation for fast testing in Antigravity IDE.*

### Watch Mode for Live Debugging
```bash
npm run watch:extension
```

---

## 2. Semantic Versioning Strategy

The canonical source of truth for the extension's version is `packages/vscode-extension/package.json`.

AiMemorySync follows **Semantic Versioning (SemVer 2.0.0)** (`MAJOR.MINOR.PATCH`):

| Type | When to Use | Command (from repo root) | Command (from extension dir) |
|---|---|---|---|
| **PATCH** (`0.1.0` &rarr; `0.1.1`) | Bug fixes, UI improvements, icon adjustments, documentation | `npm run version:extension:patch` | `npm run version:patch` |
| **MINOR** (`0.1.0` &rarr; `0.2.0`) | New commands, new tree views, new status bar features, non-breaking protocol changes | `npm run version:extension:minor` | `npm run version:minor` |
| **MAJOR** (`0.1.0` &rarr; `1.0.0`) | Breaking changes to API protocol, schema restructuring, major IDE engine requirement bumps | `npm run version:extension:major` | `npm run version:major` |

> **Note:** The `version:*` scripts utilize `--no-git-tag-version` to modify only `package.json`, allowing you to inspect changes and commit when ready.

---

## 3. Release Checklist

Follow this strict checklist before deploying a public release:

- [ ] **1. Clean Workspace:** Ensure `git status` has no unintended changes.
- [ ] **2. Increment Version:** Run `npm run version:extension:patch` (or `minor`/`major`).
- [ ] **3. Quality Gates & Package:** Run the automated release packager:
  ```bash
  npm run package:extension
  ```
  The script automatically executes:
  - **Clean:** Wipes old `dist/` and unversioned root `.vsix` files.
  - **Audit:** Validates `name`, `publisher`, `version`, `icon`, `repository`, and `author`.
  - **Typecheck:** Validates TypeScript across all extension sources (`tsc --noEmit`).
  - **Lint:** Audits code quality and rule conformance (`eslint src`).
  - **Test Suite:** Runs all 14 unit tests and all 12 backend integration tests.
  - **Bundle:** Compiles `dist/extension.js` via `tsup`.
  - **VSIX Creation:** Generates `packages/vscode-extension/releases/aimemory-vscode-<version>.vsix`.
  - **Integrity Verification:** Prints bundle size and SHA-256 hash.
- [ ] **4. Overwrite Protection Check:** If the version was not bumped, the script intentionally aborts to protect against accidental overwrites.
- [ ] **5. Test Installation Locally:** Install the generated VSIX in Antigravity IDE and test connection.
- [ ] **6. Git Commit & Tag:**
  ```bash
  git add packages/vscode-extension/package.json packages/vscode-extension/releases/
  git commit -m "release(extension): v<version>"
  git tag v<version>
  git push origin main --tags
  ```

---

## 4. Antigravity IDE & VS Code Installation

### Via GUI (Antigravity IDE / VS Code)
1. Open **Antigravity IDE**.
2. Open the **Extensions View** (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Click the **`...` (Views and More Actions)** button at the top of the Extensions sidebar.
4. Select **Install from VSIX...**.
5. Browse and select the file:
   ```text
   packages/vscode-extension/releases/aimemory-vscode-<version>.vsix
   ```
6. Reload the window if prompted.

### Via Command Line
```bash
# In Antigravity or VS Code terminal:
code --install-extension packages/vscode-extension/releases/aimemory-vscode-0.1.1.vsix
```

---

## 5. Open VSX Publishing Preparation

Open VSX ([open-vsx.org](https://open-vsx.org)) is the open-source extension registry utilized by Antigravity IDE, VSCodium, Gitpod, Eclipse Theia, and Cursor.

### Requirements Before First Publish:
1. **Register Publisher Account:**
   - Create an account on [https://open-vsx.org](https://open-vsx.org).
   - Create the namespace matching `package.json`'s publisher: `aimemory`.
2. **Generate Personal Access Token (PAT):**
   - In Open VSX User Settings &rarr; Access Tokens &rarr; Generate Token.
3. **Configure CI/CD Secret:**
   - Add the token to GitHub repository secrets as: `OVX_PAT`.
4. **Publish Manually via CLI (Optional):**
   ```bash
   npx ovsx publish packages/vscode-extension/releases/aimemory-vscode-<version>.vsix -p <YOUR_OVX_PAT>
   ```

---

## 6. How Native Auto-Update Works

When distributed through **Open VSX Registry**:

```text
┌─────────────────────────────────────────────────────────────┐
│                      Open VSX Registry                      │
│                (aimemory.aimemory-vscode)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Periodic Registry Poll (Native IDE Core)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Antigravity IDE                        │
│                                                             │
│  1. Compares installed v0.1.0 with registry v0.1.1          │
│  2. Prompts user or automatically installs in background   │
│  3. Replaces extension package on next IDE reload           │
└─────────────────────────────────────────────────────────────┘
```

1. **Native Background Polling:** The IDE engine checks the extension gallery for version updates periodically.
2. **Atomic Extension Replacement:** When a new version is detected, the IDE downloads the package to a staging directory and updates the extension upon reload.
3. **Settings & State Preservation:** Configuration (`aimemory.contextBudget`, `aimemory.autoResolve`) and credentials saved in `SecretStorage` are preserved across version updates.

---

## 7. VSIX Manual Installation vs. Marketplace Distribution

| Feature | Manual VSIX Installation | Open VSX Marketplace |
|---|---|---|
| **Distribution Channel** | Direct `.vsix` file transfer | Single-click install from Extensions View |
| **Auto-Updates** | **No** (user must install new `.vsix`) | **Yes** (native IDE background auto-update) |
| **Air-Gapped / Offline** | Supported | Requires Internet access to registry |
| **Signing / Verification** | Local verification | Registry namespace verification |
| **Target Audience** | Core developers & internal testers | End-users, Antigravity IDE community |

---

## 8. Security Considerations

1. **Zero Runtime Self-Downloading:**
   The extension contains no dynamic code evaluators (`eval`), arbitrary code execution, or background binary downloaders. All updates use the IDE's verified extension manager.
2. **Credential Storage:**
   All API Bearer tokens are stored exclusively in VS Code's native `SecretStorage` (which uses OS-level credential managers like Windows Credential Locker or macOS Keychain).
3. **Sanitized Bundling (`.vscodeignore`):**
   Source files, local scripts (`scripts/`), tests (`test/`), internal release archives (`releases/`), and markdown task notes are strictly omitted from the packaged VSIX.
4. **Reproducible Checksums:**
   Every packaging run computes and logs a SHA-256 checksum so developers can verify package integrity before installation.
