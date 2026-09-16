#!/usr/bin/env bash
set -euo pipefail

repo="mihir-patel-05/OzempicAI"
base_dir="$(cd "$(dirname "$0")" && pwd)"
issue_dir="$base_dir/github-issues"

gh auth status >/dev/null

for issue_number in {19..42} 48; do
  gh issue close "$issue_number" --repo "$repo" --reason "not planned" --comment "Closing the retired Swift/iOS backlog. Replacement requirements are being published for the current React PWA and Supabase product strategy."
done

titles=(
  "Product initiative: Useful meal decisions for changing appetite"
  "Discovery: Validate changing-appetite job and retention baseline"
  "Foundation: Reliable health-data entry, goals, correction, and time handling"
  "Feature: My Day and quick repeat meals"
  "Feature: Appetite Compass with reviewed meal recommendations"
  "Feature: Flexible Week, Rescue Meal, and grocery reconciliation"
  "Feature: Meal Memory with confirmed text, barcode, and photo-assisted capture"
  "Feature: Strength and daily-life progress"
  "Feature: Weekly Story and user-reviewed visit brief"
  "Feature: Gentle return, maintenance mode, and reminder controls"
  "Platform: Offline reliability, privacy, RLS, and rollback controls"
  "Rollout: Evidence gates, stable holdout, and W4 useful-retention measurement"
)

files=(
  "00-initiative.md"
  "01-discovery.md"
  "02-foundations.md"
  "03-my-day.md"
  "04-appetite-compass.md"
  "05-flexible-week.md"
  "06-meal-memory.md"
  "07-strength-progress.md"
  "08-weekly-story.md"
  "09-gentle-return.md"
  "10-platform-trust.md"
  "11-rollout-measurement.md"
)

for index in "${!titles[@]}"; do
  existing="$(gh issue list --repo "$repo" --state all --search "${titles[$index]} in:title" --json title --jq ".[] | select(.title == \"${titles[$index]}\") | .title" | head -n 1)"
  if [[ -z "$existing" ]]; then
    gh issue create --repo "$repo" --title "${titles[$index]}" --body-file "$issue_dir/${files[$index]}"
  else
    echo "Already exists: ${titles[$index]}"
  fi
done

gh issue list --repo "$repo" --state open --limit 100
