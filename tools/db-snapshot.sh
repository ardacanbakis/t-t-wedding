#!/usr/bin/env bash
# Snapshot the live Supabase database, and clone a snapshot into another project.
#
#   tools/db-snapshot.sh dump                     # $SOURCE_DB_URL → backups/<stamp>/
#   tools/db-snapshot.sh restore backups/<stamp>  # snapshot → $TARGET_DB_URL
#
# Needs only Docker: pg_dump/psql come from the postgres:17 image (pg_dump must
# be >= the server's major version, and 17 covers Supabase's PG15/PG17).
# Use each project's *Session pooler* URI (Dashboard → Connect) — Docker Desktop
# can't reach the IPv6-only direct host. Unset URLs are prompted for silently,
# which keeps the database password out of shell history.
#
# restore = setup.sql (schema, RLS, RPCs) → TRUNCATE every public table → load
# the rows, in one transaction, then compare row counts with the snapshot. The
# TRUNCATE matters: setup.sql seeds default settings, story chapters and
# counters, and loading on top of those would keep the defaults, not your data.
#
# Only the public schema is copied. Admin logins live in auth.users — create
# them again in the target project (docs/SETUP.md §1.3).
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash: don't rewrite arguments that look like paths

IMAGE=postgres:17
cd "$(dirname "$0")/.."

die() { echo "error: $*" >&2; exit 1; }
pg() { docker run --rm -i "$IMAGE" "$@"; }
# Project ref from a pooler (postgres.<ref>:…) or direct (db.<ref>.supabase.co) URI.
ref_of() { sed -nE 's#.*(postgres\.|db\.)([a-z0-9]{20})[:@.].*#\2#p' <<<"$1"; }
host_of() { sed -nE 's#.*@([^:/]+).*#\1#p' <<<"$1"; }
ask_url() { # ask_url VAR "label" — use $VAR, else prompt without echo
  local v=${!1:-}
  [[ -n $v ]] || { read -rsp "$2 (Session pooler URI): " v; echo >&2; }
  [[ $v == postgres* ]] || die "$1 doesn't look like a postgresql:// URI"
  printf '%s' "$v"
}
# "table rows" per COPY block of a data-only dump; COPY escapes newlines, so
# one line is one row.
dump_counts() {
  awk '/^COPY public\./ { t = $2; sub(/^public\./, "", t); n = 0; on = 1; next }
       on && /^\\\.$/   { print t, n; on = 0; next }
       on               { n++ }' "$1" | LC_ALL=C sort
}

cmd_dump() {
  local src dir
  src=$(ask_url SOURCE_DB_URL "Live project")
  dir=backups/$(date +%Y-%m-%d_%H%M)
  mkdir -p "$dir"
  echo "Dumping public schema of $(ref_of "$src" || true) → $dir/"
  pg pg_dump "$src" --schema=public --data-only --no-owner --no-privileges >"$dir/data.sql"
  pg pg_dump "$src" --schema=public --schema-only --no-owner --no-privileges >"$dir/schema.sql"
  ref_of "$src" >"$dir/source-ref"
  dump_counts "$dir/data.sql" >"$dir/counts.txt"
  [[ -s $dir/counts.txt ]] || die "no table data found in $dir/data.sql"
  echo "Rows per table:"
  sed 's/^/  /' "$dir/counts.txt"
  echo "Done. Keep $dir/ private — it holds guest names and notes."
}

cmd_restore() {
  local dir=${1:-} tgt tref sref label ans q="" t n
  [[ -n $dir && -s $dir/data.sql && -s $dir/counts.txt ]] ||
    die "usage: $0 restore backups/<stamp>   (a folder made by '$0 dump')"
  tgt=$(ask_url TARGET_DB_URL "Target project")
  tref=$(ref_of "$tgt") sref=$(cat "$dir/source-ref" 2>/dev/null || true)
  if [[ -n $tref && $tref == "$sref" && -z ${ALLOW_SAME_PROJECT:-} ]]; then
    die "target is the project this snapshot came from ($sref). That's the live
       site — refusing. For a deliberate disaster-recovery restore, re-run with
       ALLOW_SAME_PROJECT=1."
  fi
  label=${tref:-$(host_of "$tgt")}
  echo "This ERASES every table in the public schema of '$label' and replaces"
  echo "it with the snapshot in $dir/."
  read -rp "Type '$label' to continue: " ans
  [[ $ans == "$label" ]] || die "aborted"

  echo "1/3 schema, policies and functions (supabase/setup.sql)…"
  { echo "set client_min_messages = warning;"; cat supabase/setup.sql; } |
    pg psql "$tgt" -X -q -v ON_ERROR_STOP=1 >/dev/null

  echo "2/3 replacing the seeded defaults with the snapshot's rows…"
  {
    echo "set client_min_messages = warning;"
    echo "do \$\$ begin execute (select 'truncate ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' restart identity' from pg_tables where schemaname = 'public'); end \$\$;"
    cat "$dir/data.sql"
  } | pg psql "$tgt" -X -q -v ON_ERROR_STOP=1 --single-transaction -f - >/dev/null

  echo "3/3 verifying row counts…"
  while read -r t n; do
    q+="${q:+ union all }select '$t', count(*) from public.\"$t\""
  done <"$dir/counts.txt"
  if diff "$dir/counts.txt" \
          <(pg psql "$tgt" -XAt -F ' ' -c "$q" | tr -d '\r' | LC_ALL=C sort); then
    echo "Row counts match:"
    sed 's/^/  /' "$dir/counts.txt"
    echo "Next: Authentication → Users → add your admin login(s) in '$label'."
  else
    die "row counts differ (snapshot on the left, target on the right)"
  fi
}

need_docker() { docker info >/dev/null 2>&1 || die "Docker isn't running — start Docker Desktop first"; }

case ${1:-} in
  dump) need_docker; cmd_dump ;;
  restore) need_docker; shift; cmd_restore "$@" ;;
  *) sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
