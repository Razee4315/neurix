"""Config regression guard for the security/hardening-audit review.

Usage: python config_guard.py <git-ref>

Reads the Tauri capability and config files AT THE GIVEN REF (via git show,
so no checkout is needed) and exits non-zero if any of the hardening that
N-01, N-02, N-03, N-07 and N-09 claim is missing. The review workflow runs
it against main (must FAIL) and against the audited branch (must PASS).
"""

import json
import subprocess
import sys


def show(ref, path):
    out = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return out.stdout if out.returncode == 0 else None


def ls(ref, prefix):
    out = subprocess.run(["git", "ls-tree", "-r", "--name-only", ref, prefix],
                         capture_output=True, text=True, check=True)
    return [p for p in out.stdout.splitlines() if p]


def main(ref):
    problems = []

    # N-01 / N-09: every capability file, not just main.json.
    cap_files = [p for p in ls(ref, "src-tauri/capabilities/") if p.endswith((".json", ".toml"))]
    if not cap_files:
        problems.append("no capability files found")
    for path in cap_files:
        if not path.endswith(".json"):
            problems.append(f"{path}: non-JSON capability file, inspect by hand")
            continue
        cap = json.loads(show(ref, path))
        for perm in cap.get("permissions", []):
            ident = perm if isinstance(perm, str) else perm.get("identifier", "")
            if ident.startswith(("fs:", "dialog:")):
                problems.append(f"{path}: webview granted {ident}")
            if ident == "opener:default":
                problems.append(f"{path}: opener:default bundles an unscoped open-url")
            if ident == "opener:allow-open-url":
                allow = [] if isinstance(perm, str) else perm.get("allow", [])
                urls = [a.get("url", "") for a in allow]
                if not urls or any(not u.startswith("https://") for u in urls):
                    problems.append(f"{path}: opener:allow-open-url not scoped to https ({urls or 'unscoped'})")
        if cap.get("remote"):
            problems.append(f"{path}: capability exposed to remote URLs")

    # N-02 / N-03: base config and every platform override that Tauri merges.
    for path in ["src-tauri/tauri.conf.json", "src-tauri/tauri.android.conf.json",
                 "src-tauri/tauri.ios.conf.json", "src-tauri/tauri.windows.conf.json",
                 "src-tauri/tauri.linux.conf.json", "src-tauri/tauri.macos.conf.json"]:
        text = show(ref, path)
        if text is None:
            continue
        conf = json.loads(text)
        app = conf.get("app", {})
        if app.get("withGlobalTauri") is True:
            problems.append(f"{path}: withGlobalTauri is true")
        sec = app.get("security", {})
        csp = sec.get("csp")
        if isinstance(csp, dict):
            csp = "; ".join(f"{k} {v if isinstance(v, str) else ' '.join(v)}" for k, v in csp.items())
        if path == "src-tauri/tauri.conf.json" and not csp:
            problems.append(f"{path}: no CSP set")
        if csp:
            for directive in csp.split(";"):
                parts = directive.split()
                if parts and parts[0] in ("script-src", "default-src"):
                    for bad in ("'unsafe-inline'", "'unsafe-eval'"):
                        if bad in parts:
                            problems.append(f"{path}: {parts[0]} allows {bad}")
        if sec.get("dangerousDisableAssetCspModification"):
            problems.append(f"{path}: dangerousDisableAssetCspModification set")

    # N-07: ci.yml must declare least-privilege token permissions.
    ci = show(ref, ".github/workflows/ci.yml") or ""
    if "\npermissions:" not in ci:
        problems.append(".github/workflows/ci.yml: no top-level permissions key")

    for p in problems:
        print(f"FAIL  {p}")
    print(f"{ref}: {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
