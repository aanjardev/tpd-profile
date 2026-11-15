#!/usr/bin/env bash
set -Eeuo pipefail
base=/var/www/tigapilardewata/cms
service=tigapilardewata-cms
conf=/etc/nginx/sites-available/tigapilardewata
enabled=/etc/nginx/sites-enabled/tigapilardewata
[[ $(id -u) == 0 ]] || { echo 'Run release as root.' >&2; exit 1; }
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another CMS deployment is running.' >&2; exit 1; }
verify() {
    local path code
    for path in / /id/ /blog/ /id/blog/ /admin/login/ /healthz/; do
        code=$(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:46767$path")
        [[ $code == 200 ]] || { echo "CMS HTTP $code: $path" >&2; return 1; }
    done
    [[ $(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:46767/admin/) == 303 ]]
    [[ $(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:46767/cms-missing/) == 404 ]]
    echo 'CMS health, public pages, blog, authentication and 404 checks passed.'
}
switch_to() { ln -sfn "$1" "$base/current.next"; mv -Tf "$base/current.next" "$base/current"; }
action=${1:-verify}
if [[ $action == verify ]]; then verify; exit; fi
[[ -s /etc/tigapilardewata-cms.env ]] || { echo 'Configure CMS_ORIGIN in /etc/tigapilardewata-cms.env first.' >&2; exit 1; }
grep -Eq '^CMS_ORIGIN=https://[^/[:space:]]+$' /etc/tigapilardewata-cms.env || { echo 'CMS_ORIGIN must be a public HTTPS origin without trailing slash.' >&2; exit 1; }
old=$(readlink -f "$base/current" || true)
if [[ $action == deploy ]]; then
    id=${2:?Release ID required}
    [[ $id =~ ^[0-9]{14}-[a-f0-9]{8}$ ]] || exit 1
    target="$base/releases/$id"
    [[ ! -e $target ]] || { echo 'Release already exists.' >&2; exit 1; }
    mkdir "$target"
    tar -xzf "$base/incoming/$id.tar.gz" -C "$target" --no-same-owner
    for file in dist/server/entry.mjs package.json package-lock.json scripts/admin.mjs; do test -s "$target/$file"; done
    build_origin=$(/usr/bin/node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).origin' "$target/dist/cms-build.json")
    configured_origin=$(sed -n 's/^CMS_ORIGIN=//p' /etc/tigapilardewata-cms.env)
    [[ $build_origin == "$configured_origin" ]] || { echo 'Build SITE_URL and runtime CMS_ORIGIN must match.' >&2; exit 1; }
    chown -R tpd-cms:tpd-cms "$target"
    runuser -u tpd-cms -- env npm_config_cache="$base/shared/npm-cache" npm ci --omit=dev --no-audit --no-fund --prefix "$target"
    # Releases are immutable to the runtime user; writable data lives in shared/.
    chown -R root:tpd-cms "$target"
    chmod -R u=rwX,g=rX,o= "$target"
elif [[ $action == rollback ]]; then
    target=$(readlink -f "$base/previous" || true)
    [[ $target == "$base/releases/"* && -f $target/.successful && $target != "$old" ]] || { echo 'No previous CMS release.' >&2; exit 1; }
else echo 'Use deploy <id>, rollback, or verify.' >&2; exit 1; fi
backup=$(mktemp -d)
had_conf=0; had_enabled=0
if [[ -e $conf ]]; then cp -a "$conf" "$backup/conf"; had_conf=1; fi
if [[ -e $enabled || -L $enabled ]]; then cp -a "$enabled" "$backup/enabled"; had_enabled=1; fi
restore() {
    status=$?; trap - EXIT
    if [[ -n $old ]]; then switch_to "$old"; systemctl restart "$service" || true;
    else systemctl stop "$service" || true; rm -f "$base/current"; fi
    rm -f "$conf" "$enabled"
    (( had_conf == 0 )) || cp -a "$backup/conf" "$conf"
    (( had_enabled == 0 )) || cp -a "$backup/enabled" "$enabled"
    nginx -t && systemctl reload nginx || true
    rm -rf -- "$backup"
    echo 'Activation failed; restored the previous application and Nginx configuration.' >&2
    exit "$status"
}
trap restore EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
switch_to "$target"
systemctl restart "$service"
ready=0
for attempt in $(seq 1 30); do
    if curl --max-time 2 -fsS http://127.0.0.1:46767/healthz/ >/dev/null; then ready=1; break; fi
    sleep 1
done
[[ $ready == 1 ]]
verify
if [[ ! -e $base/nginx.pre-cms && $had_conf == 1 ]]; then cp -a "$backup/conf" "$base/nginx.pre-cms"; fi
install -m 644 "$base/nginx.conf" "$conf"
ln -sfn "$conf" "$enabled"
nginx -t
systemctl reload nginx
[[ $(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:6767/healthz/) == 200 ]]
systemctl enable "$service"
touch "$target/.successful"
if [[ -n $old && $old != "$target" ]]; then ln -sfn "$old" "$base/previous.next"; mv -Tf "$base/previous.next" "$base/previous"; fi
trap - EXIT INT TERM
rm -rf -- "$backup"
[[ $action != deploy ]] || rm -f "$base/incoming/$id.tar.gz"
mapfile -t releases < <(find "$base/releases" -mindepth 2 -maxdepth 2 -name .successful -printf '%h\n' | sort -r)
keep=("$target"); [[ -z $old ]] || keep+=("$old")
for release in "${releases[@]}"; do
    [[ " ${keep[*]} " == *" $release "* ]] && continue
    if (( ${#keep[@]} < 5 )); then keep+=("$release"); else rm -rf -- "$release"; fi
done
echo "Active CMS release: $target. Database and uploads in shared/ were preserved."
