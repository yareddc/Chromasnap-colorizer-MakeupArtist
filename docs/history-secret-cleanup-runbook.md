# Git History Secret Cleanup Runbook

Use this runbook to purge previously committed secret files from git history and keep a rollback path.

## Scope

This cleanup targets:

- `server/.env`
- `server/config/chrommasnap-vertex-ai-use-b587bb3ad2be.json`

## Preconditions

1. Credentials are already revoked/rotated in providers.
2. Team is notified that history will be rewritten.
3. No one pushes to `main` during the cleanup window.

## 1) Create a rollback bundle (safety backup)

PowerShell:

```bash
git bundle create pre-secret-cleanup.bundle --all
```

Verify bundle:

```bash
git bundle verify pre-secret-cleanup.bundle
```

## 2) Install git-filter-repo (if missing)

PowerShell (Windows):

```bash
pip install git-filter-repo
```

## 3) Rewrite local history

From repository root:

```bash
git filter-repo --path server/.env --path server/config/chrommasnap-vertex-ai-use-b587bb3ad2be.json --invert-paths --force
```

## 4) Re-add remote (filter-repo may remove it)

```bash
git remote add origin https://github.com/<ORG_OR_USER>/<REPO>.git
```

If `origin` already exists, skip this step.

## 5) Force push cleaned history

```bash
git push origin --force --all
git push origin --force --tags
```

## 6) Invalidate stale clones

All collaborators should re-clone. Existing clones may still contain the purged secrets.

## 7) Verify cleanup

Run scan against history:

```bash
npm run secrets:scan
```

Run strict workspace scan:

```bash
npm run secrets:scan:all-files
```

## Rollback plan

If rewrite causes issues, restore from bundle into a fresh directory:

```bash
git clone pre-secret-cleanup.bundle rollback-repo
cd rollback-repo
git remote add origin https://github.com/<ORG_OR_USER>/<REPO>.git
```

Then force push rollback state if required:

```bash
git push origin --force --all
git push origin --force --tags
```

## Notes

- Keep `.env` and key JSON files untracked in git.
- Keep CI + pre-commit secret scans enabled.
- Prefer Secret Manager + runtime identity over static key files.
