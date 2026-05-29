#!/usr/bin/env bash
# PreToolUse guard: block hand-edits to GENERATED artifacts.
#
# These files are produced by build scripts or the data pipeline. Editing the
# output directly is always a mistake — the next build/pipeline run overwrites it.
# Edit the GENERATOR instead:
#   public/llms.txt, public/llms-full.txt  -> scripts/generate-llms-full.ts
#   public/scores.json, data/scores, data/raw, data/history -> src/pipeline/run.ts
#   public/og/*  -> scripts/generate-og-images.ts
#   dist/*       -> `npm run build`
#
# The hook reads the PreToolUse JSON on stdin and extracts tool_input.file_path
# with node (a hard dependency of this repo). Exit 2 blocks the tool call and
# surfaces the stderr message to Claude.

input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).tool_input?.file_path||""))}catch{}})' 2>/dev/null)

[ -z "$file" ] && exit 0

case "$file" in
  */public/llms.txt|*/public/llms-full.txt|*/public/scores.json|\
  */public/og/*|*/dist/*|*/data/scores/*|*/data/raw/*|*/data/history/*)
    echo "BLOCKED: '$file' is a generated artifact. Edit the generator (e.g. scripts/generate-llms-full.ts) or rerun the pipeline/build — never hand-edit the output." >&2
    exit 2
    ;;
esac

exit 0
