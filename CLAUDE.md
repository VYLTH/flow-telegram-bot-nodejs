# VYLTH Project

## Termux Mobile Workflow

**Branch:** `termux` — all mobile development happens here.

### Rules
- On Termux (phone): always work on `termux` branch, push when done
- On desktop: pull `termux` to continue, push back when done
- When `termux` is ahead of main/master: merge into main and deploy server-side

### Quick Commands
```bash
# Start working (Termux or desktop)
git checkout termux && git pull origin termux

# Save work
git add -A && git commit -m "description" && git push origin termux

# Merge to main when ready (termux ahead of main)
git checkout main && git pull origin main && git merge termux && git push origin main
```

### Sync Check
Before merging to main, verify termux is ahead:
```bash
git log main..termux --oneline
```
If empty, nothing to merge. If commits show, safe to merge.
