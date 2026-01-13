# Snyk Setup Quickstart

## 🚀 3-Minute Setup

### 1️⃣ Get Your Token (30 seconds)

Visit: **https://app.snyk.io/account**

Click: **"click to show"** under API Token

Copy the token (starts with `snyk-`)

### 2️⃣ Add to GitHub (1 minute)

**Option A - Using GitHub CLI (fastest):**
```bash
gh secret set SNYK_TOKEN --repo konveyor/release-tools
# Paste your token when prompted
```

**Option B - Using Web UI:**
1. Go to: https://github.com/konveyor/release-tools/settings/secrets/actions
2. Click: **New repository secret**
3. Name: `SNYK_TOKEN`
4. Value: Paste your token
5. Click: **Add secret**

### 3️⃣ Verify (30 seconds)

```bash
gh secret list --repo konveyor/release-tools | grep SNYK_TOKEN
```

Should show:
```
SNYK_TOKEN  Updated 2026-01-13
```

### 4️⃣ Test (1 minute)

**Option A - Using helper script:**
```bash
./test-snyk-workflow.sh
```

**Option B - Using GitHub CLI:**
```bash
gh workflow run scan-snyk-vulnerabilities.yml --repo konveyor/release-tools
```

**Option C - Using Web UI:**
1. Go to: https://github.com/konveyor/release-tools/actions
2. Click: **Scan Snyk Vulnerabilities**
3. Click: **Run workflow** → **Run workflow**

### 5️⃣ Monitor Progress

View the workflow run:
```bash
gh run list --workflow=scan-snyk-vulnerabilities.yml --repo konveyor/release-tools --limit 1
```

Or in browser:
https://github.com/konveyor/release-tools/actions/workflows/scan-snyk-vulnerabilities.yml

### 6️⃣ Check Results (after ~5 minutes)

```bash
# After workflow completes, pull the changes
git pull

# View the scan results
cat community-health-dashboard/data/snyk/latest.json | jq
```

## ✅ That's It!

The workflow now runs daily at 2:00 AM UTC automatically.

---

## 📚 Additional Resources

- **Full Documentation:** [SNYK-CLI-INTEGRATION.md](SNYK-CLI-INTEGRATION.md)
- **Dashboard Docs:** [community-health-dashboard/README.md](community-health-dashboard/README.md)
- **Troubleshooting:** See "Troubleshooting" section in SNYK-CLI-INTEGRATION.md

## 🆘 Quick Troubleshooting

**Secret not working?**
```bash
# Remove and re-add the secret
gh secret remove SNYK_TOKEN --repo konveyor/release-tools
gh secret set SNYK_TOKEN --repo konveyor/release-tools
```

**Workflow fails?**
1. Check workflow permissions: Settings → Actions → General → "Read and write permissions"
2. Check workflow logs: Actions → Recent workflow runs → Click on failed run
3. Verify token is valid: https://app.snyk.io/account

**No results file?**
1. Wait for workflow to complete (~5 minutes)
2. Check workflow logs for errors
3. Verify repositories in config.js are public
