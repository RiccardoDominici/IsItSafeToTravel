#!/usr/bin/env bash
#
# scripts/indexnow/submit-changed.sh — "streaming" IndexNow submission.
#
# WHY this is a standalone script and not inline workflow YAML:
# it used to live entirely inside .github/workflows/seo-indexnow.yml, fired
# by a `workflow_run` reaction to "Deploy to Cloudflare Pages". That silently
# stopped working on 2026-08-25: every daily deploy since then is dispatched
# by data-pipeline.yml via `gh workflow run deploy.yml`, authenticated with
# the default GITHUB_TOKEN. Per GitHub's own docs
# (https://docs.github.com/en/actions/concepts/security/github_token):
# "events triggered by the GITHUB_TOKEN will not create a new workflow run,
# with the following exceptions: workflow_dispatch and repository_dispatch
# events always create workflow runs." `workflow_run` is NOT in that
# exception list — so `deploy.yml` itself still runs (workflow_dispatch is
# exempt), but its completion never fires the `workflow_run` event that
# seo-indexnow.yml was listening for. 34/34 bot-triggered deploys between
# 2026-08-25 and 2026-09-25 produced 0 IndexNow runs, while every deploy
# triggered by a direct human `push` did — 100% correlation, confirmed in
# the 2026-09-25 SEO audit (findings/technical.md T1, findings/sitemap.md
# SM1). Moving the logic here lets deploy.yml call it as a same-job step
# right after the Cloudflare deploy — no second workflow, no event cascade
# to depend on. seo-indexnow.yml keeps only a manual workflow_dispatch entry
# point (e.g. to force a full resubmission) that calls this same script.
#
# What it does: hash every prerendered HTML page reachable from the sitemap,
# diff against the manifest saved from the previous run, and submit ONLY the
# URLs whose content changed (plus URLs that disappeared, so engines recrawl
# and drop them) — in chunks of <= CHUNK_SIZE with a pause between POSTs.
# This is what stopped Bing Webmaster Tools flagging the site as "IndexNow
# is in batch mode" back when every deploy resubmitted the full ~1900 URLs.
#
# Usage:
#   scripts/indexnow/submit-changed.sh <dist-dir>
#   SUBMIT_ALL=true scripts/indexnow/submit-changed.sh dist/client
#   DRY_RUN=1 scripts/indexnow/submit-changed.sh dist/client
#
# Env vars (all optional; defaults match the values seo-indexnow.yml used):
#   SITE_HOST              default isitsafetotravel.org
#   INDEXNOW_KEY            default b4f7e2a1d9c8365f
#   INDEXNOW_KEY_LOCATION   default https://isitsafetotravel.org/b4f7e2a1d9c8365f.txt
#   CHUNK_SIZE              default 500
#   SLEEP_SECONDS           default 5 (pause between chunk POSTs)
#   MANIFEST_PATH           default .indexnow/manifest.tsv (persisted by the
#                           caller, e.g. via actions/cache, across runs)
#   SUBMIT_ALL              true|false — ignore the diff, submit every URL
#   DRY_RUN                 1 — compute + print the submit list, never POST
#
# Exit code: non-zero if any chunk failed to submit (or setup failed). The
# manifest is still rewritten on disk either way — callers MUST only persist
# it (e.g. actions/cache/save) when this script exits 0, so a failed chunk's
# URLs are retried on the next run instead of being silently forgotten.

set -euo pipefail

DIST_DIR="${1:?Usage: submit-changed.sh <dist-dir>}"
SITE_HOST="${SITE_HOST:-isitsafetotravel.org}"
INDEXNOW_KEY="${INDEXNOW_KEY:-b4f7e2a1d9c8365f}"
INDEXNOW_KEY_LOCATION="${INDEXNOW_KEY_LOCATION:-https://isitsafetotravel.org/b4f7e2a1d9c8365f.txt}"
CHUNK_SIZE="${CHUNK_SIZE:-500}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"
MANIFEST_PATH="${MANIFEST_PATH:-.indexnow/manifest.tsv}"
SUBMIT_ALL="${SUBMIT_ALL:-false}"
DRY_RUN="${DRY_RUN:-0}"

SITEMAP_INDEX="$DIST_DIR/sitemap-index.xml"

# macOS has no sha256sum by default (only `shasum -a 256`); Linux runners
# (GitHub Actions) have sha256sum via coreutils. Support both so the script
# runs identically in CI and in a contributor's local `astro build` check.
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# --- 1. Canonical URL list, from every language sitemap referenced by the index ---
build_canonical_urls() {
  local urls_file
  urls_file=$(mktemp)

  local sitemap_files
  sitemap_files=$(grep -o '<loc>[^<]*' "$SITEMAP_INDEX" | sed -e 's|^<loc>||' -e "s|https://$SITE_HOST/|$DIST_DIR/|")
  if [ -z "$sitemap_files" ]; then
    echo "::error::No sitemaps found in $SITEMAP_INDEX" >&2
    exit 1
  fi

  while IFS= read -r sitemap_file; do
    [ -z "$sitemap_file" ] && continue
    if [ ! -f "$sitemap_file" ]; then
      echo "::warning::Sitemap referenced but missing: $sitemap_file" >&2
      continue
    fi
    grep -o '<loc>[^<]*' "$sitemap_file" | sed 's|^<loc>||' >> "$urls_file" || true
  done <<< "$sitemap_files"

  sort -u -o "$urls_file" "$urls_file"
  echo "$urls_file"
}

# --- 2. Hash the built HTML behind every canonical URL into a fresh manifest ---
# trailingSlash is 'always', so https://host/en/country/ita/ maps to
# $DIST_DIR/en/country/ita/index.html (and the bare host root to index.html).
build_new_manifest() {
  local urls_file="$1"
  local new_manifest
  new_manifest=$(mktemp)

  while IFS= read -r url; do
    local rel file
    rel="${url#https://$SITE_HOST/}"
    rel="${rel%/}"
    if [ -z "$rel" ]; then
      file="$DIST_DIR/index.html"
    else
      file="$DIST_DIR/$rel/index.html"
    fi
    if [ ! -f "$file" ]; then
      echo "::warning::No built HTML for sitemap URL $url (expected $file) — skipping" >&2
      continue
    fi
    printf '%s\t%s\n' "$url" "$(sha256_file "$file")" >> "$new_manifest"
  done < "$urls_file"

  echo "$new_manifest"
}

# --- 3. Diff against the previous manifest: changed content + removed URLs ---
compute_submit_list() {
  local old_manifest="$1" new_manifest="$2"
  local submit_list
  submit_list=$(mktemp)

  if [ "$SUBMIT_ALL" = "true" ]; then
    echo "submit_all requested — submitting every URL" >&2
    cut -f1 "$new_manifest" > "$submit_list"
  elif [ ! -s "$old_manifest" ]; then
    echo "No previous manifest (first run or cache evicted) — submitting every URL" >&2
    cut -f1 "$new_manifest" > "$submit_list"
  else
    echo "Previous manifest: $(wc -l < "$old_manifest" | tr -d ' ') URLs" >&2
    # New URLs + URLs whose HTML hash changed
    awk -F'\t' 'NR==FNR { old[$1] = $2; next } !($1 in old) || old[$1] != $2 { print $1 }' \
      "$old_manifest" "$new_manifest" > "$submit_list"
    # Removed URLs: IndexNow expects deletions to be announced too, so
    # engines recrawl, see the 404/410, and drop them from their index.
    awk -F'\t' 'NR==FNR { new[$1] = 1; next } !($1 in new) { print $1 }' \
      "$new_manifest" "$old_manifest" >> "$submit_list"
  fi

  echo "$submit_list"
}

# --- 4. POST the submit list to IndexNow in chunks, with a pause between ---
submit_chunks() {
  local submit_list="$1"
  local url_json total offset=0 failures=0

  url_json=$(jq -R -s 'split("\n") | map(select(length > 0))' "$submit_list")
  total=$(jq 'length' <<< "$url_json")
  echo "Submitting $total URLs in chunks of $CHUNK_SIZE (sleep ${SLEEP_SECONDS}s between POSTs)"

  while [ "$offset" -lt "$total" ]; do
    local batch batch_count payload http_status
    batch=$(jq --argjson offset "$offset" --argjson size "$CHUNK_SIZE" '.[$offset:$offset+$size]' <<< "$url_json")
    batch_count=$(jq 'length' <<< "$batch")

    payload=$(jq -n \
      --arg host "$SITE_HOST" \
      --arg key "$INDEXNOW_KEY" \
      --arg keyLocation "$INDEXNOW_KEY_LOCATION" \
      --argjson urlList "$batch" \
      '{host: $host, key: $key, keyLocation: $keyLocation, urlList: $urlList}')

    http_status=$(curl -s -o /tmp/indexnow-response.txt -w "%{http_code}" \
      -X POST "https://api.indexnow.org/IndexNow" \
      -H "Content-Type: application/json; charset=utf-8" \
      -d "$payload")

    echo "Chunk at offset $offset ($batch_count URLs): HTTP $http_status"
    cat /tmp/indexnow-response.txt || true
    echo ""

    if [ "$http_status" -lt 200 ] || [ "$http_status" -ge 300 ]; then
      echo "::warning::IndexNow returned HTTP $http_status for chunk at offset $offset"
      failures=$((failures + 1))
    fi

    offset=$((offset + CHUNK_SIZE))
    if [ "$offset" -lt "$total" ]; then
      sleep "$SLEEP_SECONDS"
    fi
  done

  return "$failures"
}

main() {
  if [ ! -f "$SITEMAP_INDEX" ]; then
    echo "::error::Sitemap index not found at $SITEMAP_INDEX" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$MANIFEST_PATH")"

  local urls_file new_manifest submit_list count
  urls_file=$(build_canonical_urls)
  echo "Canonical URLs in sitemap: $(wc -l < "$urls_file" | tr -d ' ')"

  new_manifest=$(build_new_manifest "$urls_file")
  rm -f "$urls_file"

  submit_list=$(compute_submit_list "$MANIFEST_PATH" "$new_manifest")

  # The new manifest becomes the state on disk regardless of what happens
  # next; the CALLER decides whether to persist it (see exit-code contract
  # in the header comment above) — e.g. deploy.yml only runs
  # `actions/cache/save` when this script exits 0.
  mv "$new_manifest" "$MANIFEST_PATH"

  count=$(wc -l < "$submit_list" | tr -d ' ')
  echo "URLs to submit: $count"
  head -n 50 "$submit_list"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "count=$count" >> "$GITHUB_OUTPUT"
  fi
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### IndexNow change detection"
      echo "- Pages hashed: $(wc -l < "$MANIFEST_PATH" | tr -d ' ')"
      echo "- URLs to submit: $count"
      [ "$DRY_RUN" = "1" ] && echo "- DRY_RUN=1 — nothing was POSTed"
    } >> "$GITHUB_STEP_SUMMARY"
  fi

  if [ "$count" = "0" ]; then
    echo "Nothing changed — skipping submission"
    rm -f "$submit_list"
    exit 0
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY_RUN=1 — would submit the $count URL(s) above, no request sent"
    rm -f "$submit_list"
    exit 0
  fi

  local failures=0
  submit_chunks "$submit_list" || failures=$?
  rm -f "$submit_list"

  if [ "$failures" -gt 0 ]; then
    echo "::error::$failures chunk(s) failed — manifest on disk will not be persisted by the caller, so these URLs are retried next run"
    exit 1
  fi

  echo "All chunks submitted successfully"
}

main
