#!/usr/bin/env bash
# Uses a disposable local container, never the hosted project.
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
test_container="feedback-security-$$"
test_log=$(mktemp)
cleanup() { docker --host=unix:///var/run/docker.sock rm -f "$test_container" >/dev/null 2>&1 || true; rm -f "$test_log"; }
trap cleanup EXIT
docker --host=unix:///var/run/docker.sock run -d --rm --name "$test_container" -e POSTGRES_PASSWORD=disposable-local-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker --host=unix:///var/run/docker.sock exec "$test_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 30 ]]; then echo 'Test database did not become ready' >&2; exit 1; fi
  sleep 1
done
run_sql() {
  if ! docker --host=unix:///var/run/docker.sock exec -i "$test_container" psql -U postgres -v ON_ERROR_STOP=1 < "$1" > "$test_log" 2>&1; then cat "$test_log" >&2; exit 1; fi
}
run_sql "$repo_root/supabase/tests/bootstrap.sql"
for migration in "$repo_root"/supabase/migrations/*.sql; do run_sql "$migration"; done
run_sql "$repo_root/supabase/tests/security-boundaries.sql"
tail -1 "$test_log"

run_sql "$repo_root/supabase/tests/user-management.sql"
tail -1 "$test_log"

run_sql "$repo_root/supabase/tests/municipality-backfill.sql"
tail -1 "$test_log"

run_sql "$repo_root/supabase/tests/feedback-form-settings.sql"
tail -1 "$test_log"

run_sql "$repo_root/supabase/tests/feedback-order-permissions.sql"
tail -1 "$test_log"

run_sql "$repo_root/supabase/tests/feedback-reply-permissions.sql"
tail -1 "$test_log"
