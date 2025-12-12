# Development Workflow

## Branch Strategy

This repository uses a **two-branch workflow** to work around Vercel Hobby plan limitations:

- **`dev`** - Development branch (where all code changes are pushed)
- **`main`** - Production branch (only merged by repository owner)

## Workflow Process

### For Contributors (henry-codex, etc.)

1. **Create a feature branch from `dev`:**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit:**
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

3. **Push to your feature branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request:**
   - Go to GitHub
   - Create PR from `feature/your-feature-name` → `dev`
   - Wait for review/merge

### For Repository Owner (lradigitalpte)

1. **Review Pull Requests to `dev`:**
   - Review code changes
   - Merge PRs into `dev` branch

2. **When ready to deploy to production:**
   ```bash
   git checkout main
   git pull origin main
   git merge dev
   git push origin main
   ```
   - This triggers Vercel deployment automatically

3. **Or create a PR on GitHub:**
   - Create PR from `dev` → `main`
   - Review and merge
   - Vercel will deploy automatically

## Important Notes

- **Never push directly to `main`** - Only merge via PR or locally as owner
- **All development happens on `dev`** - Contributors push to `dev` or feature branches
- **Vercel deploys from `main`** - Only the owner can trigger production deployments
- **Keep `dev` in sync with `main`** - Regularly merge `main` → `dev` to stay updated

## Quick Commands

### Switch to dev branch:
```bash
git checkout dev
git pull origin dev
```

### Create feature branch:
```bash
git checkout -b feature/your-feature-name
```

### Sync dev with main (as owner):
```bash
git checkout dev
git merge main
git push origin dev
```

### Deploy to production (as owner):
```bash
git checkout main
git merge dev
git push origin main
```

