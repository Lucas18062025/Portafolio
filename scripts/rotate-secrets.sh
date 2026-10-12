#!/usr/bin/env bash
set -euo pipefail

# This script rotates Cloudflare secrets stored as GitHub Secrets.
# It fetches the current secret values, generates new random values,
# updates the GitHub repository secrets via the GitHub CLI, and triggers a redeploy.

# Required environment variables:
#   GITHUB_TOKEN – token with repo scope to manage secrets
#   CF_ACCOUNT_ID – Cloudflare account ID
#   CF_API_TOKEN – Cloudflare API token with Workers edit permission

if [ -z "${GITHUB_TOKEN:-}" ] || [ -z "${CF_ACCOUNT_ID:-}" ] || [ -z "${CF_API_TOKEN:-}" ]; then
  echo "Error: GITHUB_TOKEN, CF_ACCOUNT_ID y CF_API_TOKEN deben estar definidos en el entorno."
  exit 1
fi

# Rotate example secret: CF_API_TOKEN (replace with real secret names as needed)
NEW_CF_TOKEN=$(openssl rand -hex 32)

echo "Updating GitHub secret CF_API_TOKEN…"

gh secret set CF_API_TOKEN -b "$NEW_CF_TOKEN" -R "$GITHUB_REPOSITORY"

echo "Secret updated. Triggering redeploy…"

# Optional: invoke deploy script
./deploy.ps1 -Message "chore: rotate Cloudflare API token"

echo "Rotación completada."
