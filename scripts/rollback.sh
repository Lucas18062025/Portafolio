#!/usr/bin/env bash
set -euo pipefail

# Usage: ./rollback.sh <VERSION_ID>
# This script redeploys a previous Worker version using the stored DEPLOY_LOG KV namespace.
# It expects the version ID to be a valid Cloudflare Worker version identifier.

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <VERSION_ID>"
  exit 1
fi
VERSION_ID="$1"

# Retrieve the commit SHA associated with the version (if stored)
COMMIT=$(wrangler kv:key get DEPLOY_LOG "$VERSION_ID" --binding DEPLOY_LOG || echo "unknown")

echo "Rolling back to version $VERSION_ID (commit $COMMIT)"

# Deploy the specific version using wrangler publish with the version flag
wrangler publish --revision "$VERSION_ID"

echo "Rollback completed."
