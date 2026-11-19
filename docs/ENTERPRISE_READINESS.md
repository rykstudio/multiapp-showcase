# MultiApp Showcase: Production and Enterprise Readiness

**Status:** New independent application identity, engineering foundation in progress. **Not certified, signed, audited or approved for enterprise production.**

This document separates safeguards implemented in the hardening branch from deployment controls requiring an organization, signing identity, identity provider or hands-on device testing.

## 1. Trust boundaries and threat model

- **Remote websites** are untrusted, even if added to the configuration. They must not receive privileged IPC, Node.js access, filesystem access, another app's storage or arbitrary OS permissions.
- **The desktop shell** alone can manage configuration, read demo-login metadata and copy stored credentials.
- **Chromium sessions** are isolated by stable application ID and persist between restarts. Site owners control authentication and may forbid embedded browser OAuth flows.
- **Local workstation users and malware** with file access remain threats. OS keyring protection is not equivalent to full disk encryption or device management.
- **Package publishers and CI** are privileged. Build outputs must have an immutable version, verified provenance and signing before enterprise distribution.

## 2. Implemented in the hardening branch

| Area | Engineering change | Limit |
| --- | --- | --- |
| Database integrity | SQLite quick check before writes, WAL journal and rolling three-snapshot VACUUM INTO backups | Backups are local, not remotely replicated or encrypted independently |
| Passwords | New passwords require an OS-protected credential backend in packaged builds. Existing legacy plaintext passwords can be upgraded during a subsequent save if secure storage is available | Existing plaintext/older backup files may still contain secrets until remediated |
| Privileged IPC | Central verification of sending webContents and main frame for all renderer IPC handlers | Requires penetration testing, particularly around embedded popup origins |
| Remote content | Embedded website sandbox, context isolation, Node disabled, permission checks denied, embedded webview creation blocked | Trusted-site allowlists and enterprise policy enforcement are pending |
| Performance | Tab websites load on first activation rather than loading all 20–40 simultaneously | Not full tab process suspension or automatic memory-budget enforcement |
| Reliability | App-level renderer crash, navigation failure and unresponsive status exposed in toolbar with Reload | Crash restoration and long-running stress tests are not completed |
| Unsaved settings | Warn on Settings discard and native window close when edited | Verify all shutdown paths on physical desktop operating systems |
| Diagnostics | Bounded, local JSON-lines log containing only event, validated app ID, allowlisted status code and timestamp | No support bundle UI, external telemetry or central SIEM integration |
| Software supply chain | npm lockfile, reproducible npm ci install, Windows/macOS/Linux pull request tests, Dependabot updates | Code signing, SBOMs, audited dependencies and attestations are pending |
| Releases | Pull requests build packages; publishing a release requires explicit manual action from main, and an existing tag cannot be overwritten | Configure GitHub production environment approvals and protected tags separately |

## 3. Gates for a production release

1. **Security:** independent Electron/Chromium security review, IPC fuzzing, dependency vulnerability triage, remote-content policy, clipboard policy, secrets handling and OAuth identity-provider validation.
2. **Workstation management:** Windows and macOS signing credentials, macOS notarization, supported OS policy, MDM deployment/removal instructions and device disk encryption.
3. **Identity and policy:** company SSO/role-based administration, centrally managed allowed domains, restrictions on insecure HTTP and export permissions, fleet-wide policy updates.
4. **Reliability:** functional Electron GUI tests (not only source assertions), 20–40 tab soak/load test, renderer termination/restart, network loss recovery, backup restore rehearsal, memory/CPU budgets and user acceptance tests on each OS.
5. **Supply chain:** nonmutable version tags, branch protection, required review, production environment reviewers, GitHub Actions SHA pinning, license/SBOM reports, artifact provenance and signed installers.
6. **Operations:** documented support ownership and SLA, incident response/runbooks, controlled staged rollout, rollback strategy and privacy retention policy.

No ISO 27001, SOC 2, GDPR or other certification is implied by implementing application controls.

## 4. Recommended next implementation phases

| Phase | Deliverables | Exit criterion |
| --- | --- | --- |
| Foundation (this branch) | Credential policy, backup, IPC validation, lazy navigation, diagnostics, regression CI, controlled release workflow | Three-platform validation succeeds and PR is reviewed |
| Runtime resilience | Session reset, tab suspension and memory budgets, recovery UI, robust multi-popup management, OS lifecycle tests | Soak tests pass at 40 configured apps |
| Enterprise policy | Signed policy documents, approved origins, managed configuration, enterprise browser login requirements, administrator audit trail | Policy bypass and privilege tests pass |
| Distribution | Signed Windows installers, notarized macOS, verified checksums and attestations, package update/rollback | Verified clean install/update on all supported OS versions |
| Operations and compliance | Monitoring, consent/privacy review, incident response, SIEM options, controlled pilots and rollout | Written production go/no-go approval |

## 5. Backups and incident recovery

Application state is in Electron's **userData** directory, including `multiapp-settings.sqlite` and persistent Chromium session partitions. Before each subsequent successful Settings write, the previous database state is snapshotted to `multiapp-settings.backup-1.sqlite`, rotating through `backup-3.sqlite`. The snapshots contain demo credential storage as it existed then, including legacy plaintext if present. Treat every snapshot as sensitive.

For manual recovery: quit the application completely, back up the current database and any WAL/SHM files before changing them, verify the chosen snapshot using SQLite `PRAGMA quick_check`, then restore it as a new `multiapp-settings.sqlite` while the application remains closed. Test recovery on a nonproduction workstation first. These snapshots do **not** back up Chromium cookies, local storage or user authentication sessions. Enterprise deployments need their own encrypted backup and retention plan.

Diagnostics are written to `diagnostics.jsonl` and rotated to `diagnostics.previous.jsonl` at approximately 1 MiB. Raw URLs, account usernames, passwords and exception strings are not intentionally recorded.

## 6. Repository and release identity

MultiApp Showcase is a separately named application with package name `multiapp-showcase` and app ID `com.rykstudio.multiappshowcase`. It is prepared in a branch of the previous source repository for transfer to the new `rykstudio/multiapp-showcase` repository.

No historical v1.0.0/v1.1.0 deletion or tag-moving workflow is carried into the new project. New Showcase releases should use unique immutable semantic versions, checksums, code signing and controlled approvals. The first Showcase version starts at 1.0.0.

For local packaging, run the Node regression suite and `npm run build:win`, `build:mac` or `build:linux` on supported operating systems. Follow the README instructions to initialize the new repository without moving tags from the original project.

## 7. Release decision today

**NO-GO for an enterprise-wide rollout.** The code changes provide a safer base, but unsigned binaries, unreviewed identity flows, no enterprise policy service, and the absence of full GUI/security tests remain material blockers.

A small controlled pilot using nonproduction/demo accounts can be considered only after the hardening PR is reviewed, the new installers are verified, and the organization accepts the pilot risks explicitly.
