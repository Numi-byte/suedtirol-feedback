#!/usr/bin/env bash
# Test the activation boundary and capture against disposable PostgreSQL only.
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
test_container="feedback-test-results-$$"
test_log=$(mktemp)
cleanup() { docker rm -f "$test_container" >/dev/null 2>&1 || true; rm -f "$test_log"; }
trap cleanup EXIT
docker run -d --rm --name "$test_container" -e POSTGRES_PASSWORD=local-test-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$test_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 30 ]]; then echo "Test database did not become ready" >&2; exit 1; fi
  sleep 1
done
run_sql() {
  if ! docker exec -i "$test_container" psql -U postgres -v ON_ERROR_STOP=1 < "$1" > "$test_log" 2>&1; then
    cat "$test_log" >&2; exit 1
  fi
}
run_sql "$repo_root/supabase/tests/bootstrap.sql"
for migration in "$repo_root"/supabase/migrations/*.sql; do
  if [[ "$(basename -- "$migration")" == 20261020120000_capture_structured_test_feedback.sql ]]; then
    run_sql "$repo_root/supabase/tests/feedback-test-results-seed.sql"
  fi
  run_sql "$migration"
done
run_sql "$repo_root/supabase/tests/feedback-test-results.sql"
tail -1 "$test_log"
