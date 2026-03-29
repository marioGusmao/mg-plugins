#!/usr/bin/env bash
# capture-event.sh — emit ai-sessions spool events from Claude hook payloads.

set -euo pipefail

readonly EVENT_TYPE="${1:-}"
readonly CLAUDE_TOOL="claude"
readonly SPOOL_DIR="${AI_SESSIONS_SPOOL_DIR:-${HOME}/.ai-sessions/spool}"
readonly SPOOL_FILE="${SPOOL_DIR}/events.jsonl"
readonly CONTINUITY_SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/scripts/build-continuity-packet.sh"
_SELF_REPORT_SESSION_ID=""
_SELF_REPORT_REPO_ID=""
_SELF_REPORT_BRANCH=""

# --- Hook self-reporting: capture start time ---
millis_now() {
  local now=""
  now="$(date +%s%3N 2>/dev/null || true)"
  if [[ "$now" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$now"
    return
  fi

  now="$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || true)"
  if [[ "$now" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$now"
    return
  fi

  echo "$(date +%s)000"
}
HOOK_START_MS="$(millis_now)"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
    return
  fi

  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
    return
  fi

  printf '%s-%s-%s\n' "$(date +%s)" "$$" "$RANDOM"
}

read_payload() {
  cat 2>/dev/null || true
}

project_dir_from_payload() {
  local payload="$1"
  local dir=""
  dir="$(jq -r '.cwd // .project_dir // .projectDir // empty' <<<"$payload" 2>/dev/null || true)"

  if [[ -n "$dir" ]]; then
    printf '%s\n' "$dir"
    return
  fi

  if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    printf '%s\n' "$CLAUDE_PROJECT_DIR"
    return
  fi

  pwd
}

detect_git() {
  local project_dir="$1"
  if ! git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    jq -nc --arg project_dir "$project_dir" '
      {
        repo_id: $project_dir,
        repo_root: $project_dir,
        project_dir: $project_dir,
        branch: "",
        is_worktree: false
      }
    '
    return
  fi

  local repo_root branch repo_id git_common_dir expected_common_dir is_worktree
  repo_root="$(git -C "$project_dir" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$project_dir")"
  branch="$(git -C "$project_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '')"
  repo_id="$(git -C "$project_dir" config --get remote.origin.url 2>/dev/null || printf '')"
  if [[ -z "$repo_id" ]]; then
    repo_id="$repo_root"
  fi

  git_common_dir="$(git -C "$project_dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || printf '')"
  expected_common_dir="${repo_root}/.git"
  is_worktree=false
  if [[ -n "$git_common_dir" && "$git_common_dir" != "$expected_common_dir" ]]; then
    is_worktree=true
  fi

  jq -nc \
    --arg repo_id "$repo_id" \
    --arg repo_root "$repo_root" \
    --arg project_dir "$project_dir" \
    --arg branch "$branch" \
    --argjson is_worktree "$is_worktree" '
    {
      repo_id: $repo_id,
      repo_root: $repo_root,
      project_dir: $project_dir,
      branch: $branch,
      is_worktree: $is_worktree
    }
  '
}

detect_tmux() {
  if [[ -z "${TMUX:-}" ]] || ! command -v tmux >/dev/null 2>&1; then
    jq -nc '
      {
        tmux_session: null,
        tmux_window: null,
        tmux_window_id: null,
        tmux_pane: null,
        tmux_target: null,
        tmux_pid: null
      }
    '
    return
  fi

  local session_name window_name window_id pane_id target pane_pid
  session_name="$(tmux display-message -p '#{session_name}' 2>/dev/null || printf '')"
  window_name="$(tmux display-message -p '#{window_name}' 2>/dev/null || printf '')"
  window_id="$(tmux display-message -p '#{window_id}' 2>/dev/null || printf '')"
  pane_id="$(tmux display-message -p '#{pane_id}' 2>/dev/null || printf '')"
  target="$(tmux display-message -p '#S:#I.#P' 2>/dev/null || printf '')"
  pane_pid="$(tmux display-message -p '#{pane_pid}' 2>/dev/null || printf '')"

  jq -nc \
    --arg session_name "$session_name" \
    --arg window_name "$window_name" \
    --arg window_id "$window_id" \
    --arg pane_id "$pane_id" \
    --arg target "$target" \
    --arg pane_pid "$pane_pid" '
    {
      tmux_session: ($session_name | if . == "" then null else . end),
      tmux_window: ($window_name | if . == "" then null else . end),
      tmux_window_id: ($window_id | if . == "" then null else (tonumber? // null) end),
      tmux_pane: ($pane_id | if . == "" then null else . end),
      tmux_target: ($target | if . == "" then null else . end),
      tmux_pid: ($pane_pid | if . == "" then null else (tonumber? // null) end)
    }
  '
}

resolve_session_id() {
  local payload="$1"
  local session_id=""
  session_id="$(jq -r 'first(.session_id?, .sessionId?, .session.id?, .conversation_id?, .conversationId?) // empty' <<<"$payload" 2>/dev/null || true)"
  if [[ -n "$session_id" ]]; then
    printf '%s\n' "$session_id"
    return
  fi

  if [[ -n "${CLAUDE_SESSION_ID:-}" ]]; then
    printf '%s\n' "$CLAUDE_SESSION_ID"
    return
  fi

  printf ''
}

write_spool() {
  local event_type="$1"
  local event_data_json="$2"
  local session_id="$3"
  local repo_id="$4"
  local branch="$5"
  local source="$6"

  mkdir -p "$SPOOL_DIR" 2>/dev/null || return

  local json_line
  json_line="$(
    jq -nc \
      --arg event_id "$(uuid)" \
      --arg event_type "$event_type" \
      --arg session_id "$session_id" \
      --arg repo_id "$repo_id" \
      --arg branch "$branch" \
      --arg source "$source" \
      --arg created_at "$(timestamp)" \
      --argjson event_data "$event_data_json" '
      {
        event_id: $event_id,
        event_type: $event_type,
        event_data: $event_data,
      }
      + (if $session_id == "" then {} else {session_id: $session_id} end)
      + (if $repo_id == "" then {} else {repo_id: $repo_id} end)
      + (if $branch == "" then {} else {branch: $branch} end)
      + {
        source: $source,
        created_at: $created_at
      }
    '
  )"

  if [[ "$(uname -s)" == "Linux" ]] && command -v flock >/dev/null 2>&1; then
    (flock -x 200; printf '%s\n' "$json_line" >>"$SPOOL_FILE") 200>"${SPOOL_FILE}.lock"
  elif command -v perl >/dev/null 2>&1; then
    printf '%s\n' "$json_line" | perl -e 'use Fcntl qw(:flock); open(my $fh, ">>", $ARGV[0]) or die; flock($fh, LOCK_EX) or die; my $line = <STDIN>; print $fh $line; close($fh);' "$SPOOL_FILE"
  else
    printf '%s\n' "$json_line" >>"$SPOOL_FILE"
  fi
}

build_tool_input_summary() {
  local payload="$1"
  local summary
  summary="$(jq -c '.tool_input // .toolInput // {}' <<<"$payload" 2>/dev/null || printf '{}')"
  if [[ ${#summary} -gt 800 ]]; then
    summary="${summary:0:797}..."
  fi
  printf '%s\n' "$summary"
}

emit_config_event() {
  local absolute_path="$1"
  local session_id="$2"
  local repo_id="$3"
  local branch="$4"
  local repo_root="${5:-}"

  [[ -L "$absolute_path" ]] && return 0  # skip symlinks — prevent path traversal
  [[ -f "$absolute_path" ]] || return 0
  local content content_hash config_type
  content="$(cat "$absolute_path" 2>/dev/null)" || return 0
  content_hash="$(printf '%s' "$content" | shasum -a 256 | cut -d' ' -f1)"

  # Make config_path repo-relative when possible
  local config_path="$absolute_path"
  if [[ -n "$repo_root" && "$absolute_path" == "${repo_root}/"* ]]; then
    config_path="${absolute_path#"${repo_root}"/}"
  elif [[ -n "$HOME" && "$absolute_path" == "${HOME}/"* ]]; then
    config_path="~/${absolute_path#"${HOME}"/}"
  fi
  config_type="other"
  [[ "$config_path" == *"CLAUDE.md"* ]] && config_type="claude_md"
  [[ "$config_path" == *"AGENTS.md"* ]] && config_type="agents_md"
  [[ "$config_path" == *"/rules/"* ]] && config_type="rule"
  [[ "$config_path" == *"settings.json"* ]] && config_type="settings"
  [[ "$config_path" == *"hooks.json"* ]] && config_type="hooks"

  local summary config_event_data
  summary="${content:0:200}"
  config_event_data="$(
    jq -nc \
      --arg config_type "$config_type" \
      --arg config_path "$config_path" \
      --arg content_hash "$content_hash" \
      --arg content "$content" \
      --arg summary "$summary" '
      {
        config_type: $config_type,
        config_path: $config_path,
        content_hash: $content_hash,
        content: $content,
        summary: $summary
      }
    '
  )"
  write_spool "config.loaded" "$config_event_data" "$session_id" "$repo_id" "$branch" "hook:SessionStart:config"
}

scan_and_emit_configs() {
  local project_dir="$1"
  local session_id="$2"
  local repo_id="$3"
  local branch="$4"
  local repo_root="$5"

  # Scan for CLAUDE.md files (project root and home)
  for candidate in "${repo_root}/CLAUDE.md" "${project_dir}/CLAUDE.md" "${HOME}/CLAUDE.md"; do
    [[ -f "$candidate" ]] && emit_config_event "$candidate" "$session_id" "$repo_id" "$branch" "$repo_root"
  done

  # Scan for AGENTS.md
  [[ -f "${repo_root}/AGENTS.md" ]] && emit_config_event "${repo_root}/AGENTS.md" "$session_id" "$repo_id" "$branch" "$repo_root"

  # Scan for .claude/rules/*.md
  if [[ -d "${repo_root}/.claude/rules" ]]; then
    for rule_file in "${repo_root}/.claude/rules"/*.md; do
      [[ -f "$rule_file" ]] && emit_config_event "$rule_file" "$session_id" "$repo_id" "$branch" "$repo_root"
    done
  fi

  # Scan home-level rules
  if [[ -d "${HOME}/.claude/rules" ]]; then
    for rule_file in "${HOME}/.claude/rules"/*.md; do
      [[ -f "$rule_file" ]] && emit_config_event "$rule_file" "$session_id" "$repo_id" "$branch" ""
    done
  fi
}

emit_self_report() {
  local hook_event="$1"
  local hook_exit_code="${2:-0}"
  local hook_stdout_bytes="${3:-0}"

  local hook_end_ms hook_duration_ms
  hook_end_ms="$(millis_now)"
  hook_duration_ms=$(( hook_end_ms - HOOK_START_MS ))
  [[ $hook_duration_ms -lt 0 ]] && hook_duration_ms=0

  local self_report_data
  self_report_data="$(
    jq -nc \
      --arg event_type "$hook_event" \
      --arg plugin "claude-utils" \
      --argjson duration_ms "$hook_duration_ms" \
      --argjson stdout_bytes "$hook_stdout_bytes" \
      --argjson exit_code "$hook_exit_code" '
      {
        event_type: $event_type,
        plugin: $plugin,
        duration_ms: $duration_ms,
        stdout_bytes: $stdout_bytes,
        exit_code: $exit_code
      }
    '
  )"
  # Use write_spool which requires session_id/repo_id/branch from the outer scope
  write_spool "hook.self_report" "$self_report_data" "${_SELF_REPORT_SESSION_ID:-}" "${_SELF_REPORT_REPO_ID:-}" "${_SELF_REPORT_BRANCH:-}" "hook:self_report"
}

main() {
  if [[ -z "$EVENT_TYPE" ]]; then
    return
  fi

  if ! command -v jq >/dev/null 2>&1; then
    return
  fi

  local payload project_dir git_json tmux_json repo_id repo_root branch is_worktree session_id
  payload="$(read_payload)"
  project_dir="$(project_dir_from_payload "$payload")"
  git_json="$(detect_git "$project_dir")"
  tmux_json="$(detect_tmux)"
  repo_id="$(jq -r '.repo_id // empty' <<<"$git_json")"
  repo_root="$(jq -r '.repo_root // empty' <<<"$git_json")"
  branch="$(jq -r '.branch // empty' <<<"$git_json")"
  is_worktree="$(jq -r '.is_worktree' <<<"$git_json" 2>/dev/null || printf 'false')"
  session_id="$(resolve_session_id "$payload")"

  # Store context for emit_self_report BEFORE the case statement
  # so main's return code reflects the actual work exit code
  _SELF_REPORT_SESSION_ID="$session_id"
  _SELF_REPORT_REPO_ID="$repo_id"
  _SELF_REPORT_BRANCH="$branch"

  case "$EVENT_TYPE" in
    session.start)
      local tool event_data
      tool="$(jq -r '.tool // empty' <<<"$payload" 2>/dev/null || true)"
      [[ -n "$tool" ]] || tool="$CLAUDE_TOOL"
      event_data="$(
        jq -nc \
          --arg repo_root "$repo_root" \
          --arg project_dir "$project_dir" \
          --arg branch "$branch" \
          --arg tool "$tool" \
          --argjson is_worktree "$is_worktree" \
          --argjson tmux "$tmux_json" '
          {
            repo_root: $repo_root,
            project_dir: $project_dir,
            branch: $branch,
            is_worktree: $is_worktree,
            tool: $tool,
            tmux_context: $tmux
          } + $tmux
        '
      )"
      write_spool "session.start" "$event_data" "$session_id" "$repo_id" "$branch" "hook:SessionStart"
      # Config capture: scan and emit config.loaded events on session start
      scan_and_emit_configs "$project_dir" "$session_id" "$repo_id" "$branch" "$repo_root"
      ;;
    session.end)
      local status event_data
      status="$(jq -r '.status // "completed"' <<<"$payload" 2>/dev/null || printf 'completed')"
      event_data="$(jq -nc --arg status "$status" '{status: $status}')"
      write_spool "session.end" "$event_data" "$session_id" "$repo_id" "$branch" "hook:SessionEnd"
      ;;
    prompt)
      local message event_data
      message="$(jq -r '.message // empty' <<<"$payload" 2>/dev/null || true)"
      [[ -n "$message" ]] || return
      event_data="$(jq -nc --arg prompt_text "$message" --arg prompt "$message" '{prompt_text: $prompt_text, prompt: $prompt}')"
      write_spool "prompt" "$event_data" "$session_id" "$repo_id" "$branch" "hook:UserPromptSubmit"
      ;;
    observation)
      local tool_name file_path success tool_input_summary title detail files_json event_data
      tool_name="$(jq -r '.tool_name // .toolName // .tool // empty' <<<"$payload" 2>/dev/null || true)"
      [[ -n "$tool_name" ]] || return
      [[ "$tool_name" != "Skill" ]] || return
      file_path="$(jq -r 'first(.file_path?, .filePath?, .tool_input.file_path?, .toolInput.file_path?) // empty' <<<"$payload" 2>/dev/null || true)"
      files_json="$(jq -c '
        if (.filesModified? | type) == "array" then .filesModified
        elif (.files_modified? | type) == "array" then .files_modified
        elif (.files? | type) == "array" then .files
        elif (.file_path? // .filePath? // .tool_input.file_path? // .toolInput.file_path? // "") != "" then [(.file_path // .filePath // .tool_input.file_path // .toolInput.file_path)]
        else []
        end
      ' <<<"$payload" 2>/dev/null || printf '[]')"
      success="$(jq -r '
        if .success == true then "true"
        elif .success == false then "false"
        elif .isError == true or (.error? != null and .error != "") then "false"
        else "true"
        end
      ' <<<"$payload" 2>/dev/null || printf 'true')"
      tool_input_summary="$(build_tool_input_summary "$payload")"
      title="$tool_name"
      detail="$(jq -r '.detail // .error // empty' <<<"$payload" 2>/dev/null || true)"
      event_data="$(
        jq -nc \
          --arg type "tool_use" \
          --arg tool_name "$tool_name" \
          --arg file_path "$file_path" \
          --arg tool_input_summary "$tool_input_summary" \
          --argjson files_modified "$files_json" \
          --argjson success "$success" \
          --arg title "$title" \
          --arg detail "$detail" '
          {
            type: $type,
            tool_name: $tool_name,
            file_path: (if $file_path == "" then null else $file_path end),
            filesModified: $files_modified,
            tool_input_summary: $tool_input_summary,
            success: $success,
            title: $title,
            detail: (if $detail == "" then null else $detail end)
          }
        '
      )"
      write_spool "observation" "$event_data" "$session_id" "$repo_id" "$branch" "hook:PostToolUse"
      # Plan auto-complete: emit plan.item.complete if a file was modified (Edit/Write)
      if [[ -n "$file_path" && ("$tool_name" == "Edit" || "$tool_name" == "Write" || "$tool_name" == "edit" || "$tool_name" == "write") ]]; then
        local plan_complete_data
        plan_complete_data="$(jq -nc --arg file_path "$file_path" '{file_path: $file_path}')"
        write_spool "plan.item.complete" "$plan_complete_data" "$session_id" "$repo_id" "$branch" "hook:PostToolUse"
      fi
      ;;
    skill.invoke)
      local skill_name plugin arguments_json event_data
      skill_name="$(jq -r '.tool_input.skill // .toolInput.skill // .tool_input.name // .toolInput.name // empty' <<<"$payload" 2>/dev/null || true)"
      [[ -n "$skill_name" ]] || return
      plugin="$(jq -r '.tool_input.plugin // .toolInput.plugin // empty' <<<"$payload" 2>/dev/null || true)"
      arguments_json="$(jq -c '.tool_input.arguments // .toolInput.arguments // .tool_input.args // .toolInput.args // {}' <<<"$payload" 2>/dev/null || printf '{}')"
      event_data="$(
        jq -nc \
          --arg skill_name "$skill_name" \
          --arg plugin "$plugin" \
          --argjson arguments "$arguments_json" '
          {
            skill_name: $skill_name,
            plugin: (if $plugin == "" then null else $plugin end),
            arguments: $arguments
          }
        '
      )"
      write_spool "skill.invoke" "$event_data" "$session_id" "$repo_id" "$branch" "hook:PostToolUse:Skill"
      ;;
    agent.stop)
      local agent_name agent_type model plugin status error_message duration_ms tokens_in tokens_out event_data
      agent_name="$(jq -r '.agent_name // .agentName // .name // empty' <<<"$payload" 2>/dev/null || true)"
      [[ -n "$agent_name" ]] || return
      agent_type="$(jq -r '.agent_type // .agentType // empty' <<<"$payload" 2>/dev/null || true)"
      model="$(jq -r '.model // empty' <<<"$payload" 2>/dev/null || true)"
      plugin="$(jq -r '.plugin // empty' <<<"$payload" 2>/dev/null || true)"
      status="$(jq -r '.status // "completed"' <<<"$payload" 2>/dev/null || printf 'completed')"
      error_message="$(jq -r '.error_message // .errorMessage // .error // empty' <<<"$payload" 2>/dev/null || true)"
      duration_ms="$(jq -c '.duration_ms // .durationMs // null' <<<"$payload" 2>/dev/null || printf 'null')"
      tokens_in="$(jq -c '.tokens_in // .tokensIn // .usage.input_tokens // .usage.inputTokens // null' <<<"$payload" 2>/dev/null || printf 'null')"
      tokens_out="$(jq -c '.tokens_out // .tokensOut // .usage.output_tokens // .usage.outputTokens // null' <<<"$payload" 2>/dev/null || printf 'null')"
      event_data="$(
        jq -nc \
          --arg agent_name "$agent_name" \
          --arg agent_type "$agent_type" \
          --arg model "$model" \
          --arg plugin "$plugin" \
          --arg status "$status" \
          --arg error_message "$error_message" \
          --argjson duration_ms "$duration_ms" \
          --argjson tokens_in "$tokens_in" \
          --argjson tokens_out "$tokens_out" '
          {
            agent_name: $agent_name,
            agent_type: (if $agent_type == "" then null else $agent_type end),
            model: (if $model == "" then null else $model end),
            plugin: (if $plugin == "" then null else $plugin end),
            duration_ms: $duration_ms,
            tokens_in: $tokens_in,
            tokens_out: $tokens_out,
            status: $status,
            error_message: (if $error_message == "" then null else $error_message end)
          }
        '
      )"
      write_spool "agent.stop" "$event_data" "$session_id" "$repo_id" "$branch" "hook:SubagentStop"
      ;;
    config.loaded)
      local cfg_path
      cfg_path="$(jq -r '.file_path // empty' <<<"$payload" 2>/dev/null || true)"
      if [[ -n "$cfg_path" && -f "$cfg_path" ]]; then
        emit_config_event "$cfg_path" "$session_id" "$repo_id" "$branch" "$repo_root"
      fi
      ;;
    context.inject)
      if [[ -x "$CONTINUITY_SCRIPT" ]]; then
        "$CONTINUITY_SCRIPT" "$repo_id" "$branch" "$session_id" "$project_dir"
      fi
      ;;

    # ---- kdoc reconcile lifecycle events (passthrough to spool) ----
    reconcile.check)
      local rc_data
      rc_data="$(jq -nc \
        --argjson p "$payload" \
        '{
          findings_count: ($p.findings_count // 0),
          by_tier: ($p.by_tier // {}),
          by_code: ($p.by_code // {}),
          invocation_id: ($p.invocation_id // null)
        }' 2>/dev/null)" || rc_data='{"findings_count":0}'
      write_spool "reconcile.check" "$rc_data" "$session_id" "$repo_id" "$branch" "hook:reconcile"
      ;;
    reconcile.plan_created)
      local rp_data
      rp_data="$(jq -nc \
        --argjson p "$payload" \
        '{
          plan_path: ($p.plan_path // ""),
          findings_count: ($p.findings_count // 0),
          invocation_id: ($p.invocation_id // null)
        }' 2>/dev/null)" || rp_data='{}'
      write_spool "reconcile.plan_created" "$rp_data" "$session_id" "$repo_id" "$branch" "hook:reconcile"
      ;;
    reconcile.repair_applied)
      local ra_data
      ra_data="$(jq -nc \
        --argjson p "$payload" \
        '{
          code: ($p.code // ""),
          file_path: ($p.file_path // ""),
          tier: ($p.tier // ""),
          invocation_id: ($p.invocation_id // null)
        }' 2>/dev/null)" || ra_data='{}'
      write_spool "reconcile.repair_applied" "$ra_data" "$session_id" "$repo_id" "$branch" "hook:reconcile"
      ;;
    reconcile.repair_failed)
      local rf_data
      rf_data="$(jq -nc \
        --argjson p "$payload" \
        '{
          code: ($p.code // ""),
          file_path: ($p.file_path // ""),
          reason: ($p.reason // ""),
          invocation_id: ($p.invocation_id // null)
        }' 2>/dev/null)" || rf_data='{}'
      write_spool "reconcile.repair_failed" "$rf_data" "$session_id" "$repo_id" "$branch" "hook:reconcile"
      ;;
    reconcile.clean)
      local rcl_data
      rcl_data="$(jq -nc \
        --argjson p "$payload" \
        '{
          repairs_applied: ($p.repairs_applied // 0),
          invocation_id: ($p.invocation_id // null)
        }' 2>/dev/null)" || rcl_data='{"repairs_applied":0}'
      write_spool "reconcile.clean" "$rcl_data" "$session_id" "$repo_id" "$branch" "hook:reconcile"
      ;;
  esac

}

# Run main logic and capture exit code for self-report
_MAIN_EXIT=0
set +e
main "$@"
_MAIN_EXIT=$?
set -e

# --- Hook self-reporting: emit telemetry for every event handled ---
if [[ -n "$EVENT_TYPE" ]] && command -v jq >/dev/null 2>&1; then
  emit_self_report "$EVENT_TYPE" "$_MAIN_EXIT" 0 || true
fi
exit 0
