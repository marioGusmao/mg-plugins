#!/usr/bin/env bash
# build-continuity-packet.sh — render continuity context from ai-sessions SQLite state.

set -euo pipefail

readonly DB_PATH="${AI_SESSIONS_DB_PATH:-${HOME}/.ai-sessions/sessions.db}"

detect_git() {
  local project_dir="${1:-$(pwd)}"
  if ! git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    jq -nc --arg repo_id "$project_dir" --arg branch "" '{repo_id: $repo_id, branch: $branch}'
    return
  fi

  local repo_root repo_id branch
  repo_root="$(git -C "$project_dir" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$project_dir")"
  repo_id="$(git -C "$project_dir" config --get remote.origin.url 2>/dev/null || printf '%s' "$repo_root")"
  branch="$(git -C "$project_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '')"

  jq -nc --arg repo_id "$repo_id" --arg branch "$branch" '{repo_id: $repo_id, branch: $branch}'
}

sql_param() {
  local value="${1:-}"
  if [[ -n "$value" ]]; then
    jq -rn --arg v "$value" '$v'
  else
    printf 'null'
  fi
}

run_query() {
  local repo_id="$1"
  local branch="$2"
  local session_id="$3"
  local sql="$4"

  sqlite3 -json "$DB_PATH" <<SQL 2>/dev/null || printf '[]'
.parameter init
.parameter set @repo $(sql_param "$repo_id")
.parameter set @branch $(sql_param "$branch")
.parameter set @session $(sql_param "$session_id")
$sql
SQL
}

extract_reconcile_health() {
  local reconcile_json="$1"

  jq -rc '
    (.[0]? // {}) as $row
    | ($row.event_data // "" | fromjson? // {}) as $event
    | ($event.by_tier // {}) as $tiers
    | ($event.by_code // {}) as $codes
    | {
        created_at: ($row.created_at // ""),
        findings_count: (($event.findings_count // 0) | tonumber? // 0),
        auto_fix_count: (($tiers.auto_fix // 0) | tonumber? // 0),
        needs_approval_count: (($tiers.needs_approval // 0) | tonumber? // 0),
        report_only_count: (($tiers.report_only // 0) | tonumber? // 0),
        codes_summary: (
          $codes
          | to_entries
          | sort_by(-(.value | tonumber? // 0), .key)
          | .[:5]
          | map(.key + "=" + ((.value | tonumber? // 0) | tostring))
          | join(", ")
        )
      }
  ' <<<"$reconcile_json" 2>/dev/null || printf '{}'
}

render_knowledge_health_body() {
  local health_json="$1"

  jq -r '
    if ((.findings_count // 0) | tonumber? // 0) == 0 then
      [
        "- Latest reconcile check: " + (.created_at // "unknown"),
        "- Status: clean",
        "- Auto-fix findings: " + (((.auto_fix_count // 0) | tonumber? // 0) | tostring),
        "- Needs approval: " + (((.needs_approval_count // 0) | tonumber? // 0) | tostring),
        "- Report only: " + (((.report_only_count // 0) | tonumber? // 0) | tostring)
      ]
    else
      [
        "- Latest reconcile check: " + (.created_at // "unknown"),
        "- Total findings: " + (((.findings_count // 0) | tonumber? // 0) | tostring),
        "- Auto-fix findings: " + (((.auto_fix_count // 0) | tonumber? // 0) | tostring),
        "- Needs approval: " + (((.needs_approval_count // 0) | tonumber? // 0) | tostring),
        "- Report only: " + (((.report_only_count // 0) | tonumber? // 0) | tostring)
      ]
      + (if (.codes_summary // "") != "" then ["- Top finding codes: " + .codes_summary] else [] end)
    end
    | join("\n")
  ' <<<"$health_json" 2>/dev/null || true
}

persist_context_inject_event() {
  local repo_id="$1"
  local branch="$2"
  local session_id="$3"
  local auto_fix_count="$4"
  local needs_approval_count="$5"

  local event_data columns_sql values_sql event_columns
  event_data="$(
    jq -nc \
      --argjson auto_fix_count "${auto_fix_count:-0}" \
      --argjson needs_approval_count "${needs_approval_count:-0}" \
      '{
        kdoc_health: {
          signal_source: "continuity_packet",
          auto_fix_count: $auto_fix_count,
          needs_approval_count: $needs_approval_count
        }
      }'
  )"

  local event_id
  event_id="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "cp-$(date +%s)-$$")"

  columns_sql="event_id, event_type, event_data, created_at"
  values_sql="@event_id, @event_type, @event_data, datetime('now')"
  event_columns="$(sqlite3 "$DB_PATH" "PRAGMA table_info(events);" 2>/dev/null | awk -F'|' '{print $2}')"

  if grep -qx 'repo_id' <<<"$event_columns"; then
    columns_sql+=", repo_id"
    values_sql+=", @repo_id"
  fi
  if grep -qx 'branch' <<<"$event_columns"; then
    columns_sql+=", branch"
    values_sql+=", @branch"
  fi
  if grep -qx 'session_id' <<<"$event_columns"; then
    columns_sql+=", session_id"
    values_sql+=", @session_id"
  fi

  sqlite3 "$DB_PATH" <<SQL >/dev/null 2>&1 || return 1
.parameter init
.parameter set @event_id $(sql_param "$event_id")
.parameter set @event_type 'context.inject'
.parameter set @event_data $(sql_param "$event_data")
.parameter set @repo_id $(sql_param "$repo_id")
.parameter set @branch $(sql_param "$branch")
.parameter set @session_id $(sql_param "${session_id:-continuity-packet}")
INSERT INTO events ($columns_sql)
VALUES ($values_sql);
SQL
}

render_section() {
  local title="$1"
  local body="$2"
  if [[ -n "$body" ]]; then
    printf '## %s\n%s\n\n' "$title" "$body"
  fi
}

main() {
  if ! command -v jq >/dev/null 2>&1 || ! command -v sqlite3 >/dev/null 2>&1; then
    return
  fi

  if [[ ! -f "$DB_PATH" ]]; then
    return
  fi

  local repo_id="${1:-}"
  local branch="${2:-}"
  local session_id="${3:-}"
  local project_dir="${4:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"

  if [[ -z "$repo_id" || -z "$branch" ]]; then
    local git_json
    git_json="$(detect_git "$project_dir")"
    [[ -n "$repo_id" ]] || repo_id="$(jq -r '.repo_id // empty' <<<"$git_json")"
    [[ -n "$branch" ]] || branch="$(jq -r '.branch // empty' <<<"$git_json")"
  fi

  local pending_json accomplished_json failed_json decisions_json concurrent_json recent_prompts_json pending_actions_json open_flags_json unread_cross_workshop_json reconcile_health_json
  pending_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT category, description, file_pattern
    FROM plan_items
    WHERE status IN ('pending', 'in_progress')
      AND (@repo IS NULL OR repo_id = @repo)
      AND (@branch IS NULL OR branch = @branch)
    ORDER BY created_at DESC
    LIMIT 15;
  ")"
  accomplished_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT title, detail, tool_name, created_at
    FROM observations
    WHERE (@repo IS NULL OR repo_id = @repo)
      AND (@branch IS NULL OR branch = @branch)
      AND (success = 1 OR success IS NULL)
      AND type NOT IN ('error', 'failure')
    ORDER BY created_at DESC
    LIMIT 10;
  ")"
  failed_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT title, detail, tool_name, created_at
    FROM observations
    WHERE (@repo IS NULL OR repo_id = @repo)
      AND (@branch IS NULL OR branch = @branch)
      AND (success = 0 OR type IN ('error', 'blocked', 'failure'))
    ORDER BY created_at DESC
    LIMIT 5;
  ")"
  decisions_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT decisions, created_at
    FROM summaries
    WHERE (@repo IS NULL OR repo_id = @repo)
      AND (@branch IS NULL OR branch = @branch)
      AND decisions IS NOT NULL
      AND TRIM(decisions) != ''
    ORDER BY created_at DESC
    LIMIT 5;
  ")"
  concurrent_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT
      s.session_id,
      s.started_at,
      (
        SELECT files_modified
        FROM observations o
        WHERE o.session_id = s.session_id
        ORDER BY o.created_at DESC
        LIMIT 1
      ) AS files_modified
    FROM sessions s
    WHERE s.status = 'active'
      AND (@repo IS NULL OR s.repo_id = @repo)
      AND (@session IS NULL OR s.session_id != @session)
    ORDER BY s.started_at DESC
    LIMIT 5;
  ")"
  recent_prompts_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT prompt_text, created_at
    FROM prompts
    WHERE (@repo IS NULL OR repo_id = @repo)
      AND (@branch IS NULL OR branch = @branch)
    ORDER BY created_at DESC
    LIMIT 5;
  ")"
  pending_actions_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT aq.id, aq.action_type, aq.action_config_json, aq.priority, aq.created_at,
      rr.name AS rule_name, rr.description AS rule_description
    FROM action_queue aq
    LEFT JOIN reaction_rules rr ON aq.rule_id = rr.id
    WHERE aq.status = 'pending'
      AND (aq.target_repo_id IS NULL OR aq.target_repo_id = @repo)
    ORDER BY aq.priority DESC, aq.created_at ASC
    LIMIT 5;
  ")"
  open_flags_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT af.id, af.entity_type, af.entity_id, af.flag_type, af.detail, af.created_at
    FROM action_flags af
    WHERE af.status = 'open'
    ORDER BY af.created_at DESC
    LIMIT 5;
  ")"
  unread_cross_workshop_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT DISTINCT m.from_workshop_name, m.message_type, m.content, m.priority, m.created_at
    FROM cross_workshop_messages m
    WHERE (
      m.to_workshop_id IS NOT NULL
      AND m.read = 0
      AND EXISTS (
        SELECT 1
        FROM workshops w
        WHERE w.id = m.to_workshop_id
          AND (@repo IS NULL OR w.repo_id = @repo)
      )
    )
    OR (
      m.to_workshop_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM workshops w
        WHERE (@repo IS NULL OR w.repo_id = @repo)
          AND w.lifecycle_state = 'active'
          AND w.id != m.from_workshop_id
          AND NOT EXISTS (
            SELECT 1
            FROM cross_workshop_read_receipts r
            WHERE r.message_id = m.id
              AND r.workshop_id = w.id
          )
      )
    )
    ORDER BY
      CASE m.priority
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC,
      m.created_at DESC
    LIMIT 5;
  ")"
  reconcile_health_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT event_data, created_at
    FROM events
    WHERE event_type = 'reconcile.check'
      AND repo_id = @repo
    ORDER BY created_at DESC
    LIMIT 1;
  ")"

  # Capability summary from truth-engine (if tables exist)
  local capability_summary_json capability_summary_body
  capability_summary_json="$(run_query "$repo_id" "$branch" "$session_id" "
    SELECT capability_id, display_name, status, confidence, policy
    FROM capabilities
    ORDER BY confidence DESC, display_name ASC
    LIMIT 20;
  " 2>/dev/null)" || capability_summary_json="[]"
  capability_summary_body="$(jq -r '
    if (. | length) == 0 then ""
    else
      map("- \(.capability_id) — \(.status), confidence \(.confidence)" + (if .policy != "allow" then ", policy: \(.policy)" else "" end))
      | join("\n")
    end
  ' <<<"$capability_summary_json" 2>/dev/null || true)"

  local pending_body accomplished_body failed_body decisions_body concurrent_body recent_prompts_body pending_actions_body open_flags_body unread_cross_workshop_body warnings_body work_stream_body knowledge_health_body knowledge_health_summary reconcile_health_count
  pending_body="$(jq -r '
    map("- " + ((.category // "task") + ": " + .description + (if (.file_pattern // "") != "" then " (" + .file_pattern + ")" else "" end)))
    | join("\n")
  ' <<<"$pending_json" 2>/dev/null || true)"
  accomplished_body="$(jq -r '
    map("- " + (.created_at // "") + " " + (.title // .tool_name // "observation") + (if (.detail // "") != "" then ": " + .detail else "" end))
    | join("\n")
  ' <<<"$accomplished_json" 2>/dev/null || true)"
  failed_body="$(jq -r '
    map("- " + (.created_at // "") + " " + (.title // .tool_name // "failure") + (if (.detail // "") != "" then ": " + .detail else "" end))
    | join("\n")
  ' <<<"$failed_json" 2>/dev/null || true)"
  decisions_body="$(jq -r '
    map("- " + (.created_at // "") + ": " + .decisions)
    | join("\n")
  ' <<<"$decisions_json" 2>/dev/null || true)"
  concurrent_body="$(jq -r '
    map("- " + .session_id + " (started " + (.started_at // "unknown") + ")" +
      (if (.files_modified // "") != "" and .files_modified != "[]" then " files=" + .files_modified else "" end))
    | join("\n")
  ' <<<"$concurrent_json" 2>/dev/null || true)"
  recent_prompts_body="$(jq -r '
    map("- " + (.created_at // "") + ": " + ((.prompt_text // "") | tostring | .[0:120]))
    | join("\n")
  ' <<<"$recent_prompts_json" 2>/dev/null || true)"
  pending_actions_body="$(jq -r '
    map("- [priority:" + ((.priority // "?") | tostring) + "] " + (.rule_name // "manual") + ": " + (.action_type // "unknown") + " (" + (.created_at // "unknown") + ")")
    | join("\n")
  ' <<<"$pending_actions_json" 2>/dev/null || true)"
  open_flags_body="$(jq -r '
    map("- [" + (.flag_type // "unknown") + "] " + (.entity_type // "entity") + ":" + (.entity_id // "unknown") + " -- " + (.detail // "no detail") + " (" + (.created_at // "unknown") + ")")
    | join("\n")
  ' <<<"$open_flags_json" 2>/dev/null || true)"
  unread_cross_workshop_body="$(jq -r '
    map("- " + (.from_workshop_name // "unknown") + " [" + (.priority // "normal") + "/" + (.message_type // "message") + "] " + (.created_at // "unknown") + ": " + ((.content // "") | tostring | .[0:120]))
    | join("\n")
  ' <<<"$unread_cross_workshop_json" 2>/dev/null || true)"
  reconcile_health_count="$(jq -r 'length' <<<"$reconcile_health_json" 2>/dev/null || echo 0)"
  if [[ "$reconcile_health_count" -gt 0 ]]; then
    knowledge_health_summary="$(extract_reconcile_health "$reconcile_health_json")"
    knowledge_health_body="$(render_knowledge_health_body "$knowledge_health_summary")"
  else
    knowledge_health_summary='{}'
    knowledge_health_body=''
  fi

  local pending_count concurrent_count failed_count pending_actions_count open_flags_count unread_cross_workshop_count stale_pending_count
  pending_count="$(jq -r 'length' <<<"$pending_json" 2>/dev/null || echo 0)"
  concurrent_count="$(jq -r 'length' <<<"$concurrent_json" 2>/dev/null || echo 0)"
  failed_count="$(jq -r 'length' <<<"$failed_json" 2>/dev/null || echo 0)"
  pending_actions_count="$(jq -r 'length' <<<"$pending_actions_json" 2>/dev/null || echo 0)"
  open_flags_count="$(jq -r 'length' <<<"$open_flags_json" 2>/dev/null || echo 0)"
  unread_cross_workshop_count="$(jq -r 'length' <<<"$unread_cross_workshop_json" 2>/dev/null || echo 0)"
  stale_pending_count="$(jq -r '[.[] | select(.category != null)] | length' <<<"$pending_json" 2>/dev/null || echo 0)"

  warnings_body="$(
    {
      [[ "$concurrent_count" -gt 1 ]] && printf -- '- %s concurrent active sessions on this repo — coordinate to avoid conflicts.\n' "$concurrent_count"
      [[ "$failed_count" -gt 0 ]] && printf -- '- %s recent failure(s) on this branch — review before retrying similar approaches.\n' "$failed_count"
      [[ "$stale_pending_count" -gt 5 ]] && printf -- '- %s pending plan items with no recent progress.\n' "$stale_pending_count"
      [[ "$pending_actions_count" -gt 0 ]] && printf -- '- %s pending corrective action(s) from rules engine. Run action_queue_process to review.\n' "$pending_actions_count"
      [[ "$open_flags_count" -gt 0 ]] && printf -- '- %s open flag(s) need attention. Review via action_flag_resolve.\n' "$open_flags_count"
      [[ "$unread_cross_workshop_count" -gt 0 ]] && printf -- '- %s unread cross-workshop message(s). Check workshop_inbox.\n' "$unread_cross_workshop_count"
    } | sed '/^$/d'
  )"
  work_stream_body="Branch: ${branch:-unknown} | Repo: ${repo_id:-unknown}"

  if [[ -n "$knowledge_health_body" ]]; then
    persist_context_inject_event \
      "$repo_id" \
      "$branch" \
      "${session_id:-continuity-packet}" \
      "$(jq -r '(.auto_fix_count // 0) | tonumber? // 0' <<<"$knowledge_health_summary" 2>/dev/null || echo 0)" \
      "$(jq -r '(.needs_approval_count // 0) | tonumber? // 0' <<<"$knowledge_health_summary" 2>/dev/null || echo 0)" \
      || warnings_body="$(
        {
          [[ -n "$warnings_body" ]] && printf '%s\n' "$warnings_body"
          printf -- '- Failed to persist continuity-packet dedupe signal.\n'
        } | sed '/^$/d'
      )"
  fi

  if [[ -z "$work_stream_body$knowledge_health_body$capability_summary_body$pending_body$accomplished_body$failed_body$decisions_body$concurrent_body$recent_prompts_body$pending_actions_body$open_flags_body$unread_cross_workshop_body$warnings_body" ]]; then
    return
  fi

  render_section "Warnings" "$warnings_body"
  render_section "Work Stream" "$work_stream_body"
  render_section "Capability Truth Engine" "$capability_summary_body"
  render_section "Knowledge Health" "$knowledge_health_body"
  render_section "Pending Work Items" "$pending_body"
  render_section "Recent Accomplishments" "$accomplished_body"
  render_section "Failed Attempts" "$failed_body"
  render_section "Recent Decisions" "$decisions_body"
  render_section "Concurrent Sessions" "$concurrent_body"
  render_section "Pending Actions" "$pending_actions_body"
  render_section "Open Flags" "$open_flags_body"
  render_section "Unread Cross-Workshop Messages" "$unread_cross_workshop_body"
  render_section "Recent Prompts" "$recent_prompts_body"
}

main "$@" || true
exit 0
