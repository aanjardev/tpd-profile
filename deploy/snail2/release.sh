#!/usr/bin/env bash
set -Eeuo pipefail
base=/var/www/tigapilardewata
mkdir -p "$base/releases" "$base/incoming"
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

verify() {
    local path code slug asset headers
    for path in / /about/ /siwride/ /partnership/ /contact/ /id/ /id/tentang/ /id/siwride/ /id/kemitraan/ /id/kontak/; do
        code=$(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:6767$path")
        [[ $code == 200 ]] || { echo "HTTP $code: $path" >&2; return 1; }
    done
    curl --max-time 15 -fsS -o "$base/incoming/en-check.html" http://127.0.0.1:6767/ || return 1
    grep -q '<html lang="en"' "$base/incoming/en-check.html" || return 1
    curl --max-time 15 -fsS -o "$base/incoming/id-check.html" http://127.0.0.1:6767/id/ || return 1
    grep -q '<html lang="id"' "$base/incoming/id-check.html" || return 1
    for path in /deployment-missing/ /id/deployment-missing/; do
        code=$(curl --max-time 15 -sS -o "$base/incoming/404-check.html" -w '%{http_code}' "http://127.0.0.1:6767$path")
        [[ $code == 404 ]] && grep -q 'Page Not Found' "$base/incoming/404-check.html" || return 1
    done
    for slug in tentang kemitraan kontak; do
        headers=$(curl --max-time 15 -sS -D - -o /dev/null "http://127.0.0.1:6767/$slug/?campaign=bali&lang=id")
        [[ $headers == *'301 Moved Permanently'* ]] || return 1
        printf '%s\n' "$headers" | tr -d '\r' | grep -qiFx "Location: /id/$slug/?campaign=bali&lang=id" || return 1
    done
    asset=$(find "$base/current/_astro" -type f -name '*.css' -printf '%P\n' | head -n 1)
    [[ -n $asset ]] || return 1
    curl --max-time 15 -fsS -o /dev/null "http://127.0.0.1:6767/_astro/$asset" || return 1
    curl --max-time 15 -fsS -o /dev/null http://127.0.0.1:6767/logo.jpeg || return 1
    echo 'HTTP checks passed (10 pages, locales, assets, redirects, custom 404).'
}

switch_to() {
    ln -sfn "$1" "$base/current.next"
    mv -Tf "$base/current.next" "$base/current"
}

action=${1:-verify}
if [[ $action == verify ]]; then verify; exit; fi
old=$(readlink -f "$base/current" || true)
if [[ $action == deploy ]]; then
    id=${2:?Release ID required}
    [[ $id =~ ^[0-9]{14}-[a-f0-9]{8}$ ]] || exit 1
    target="$base/releases/$id"
    [[ ! -e $target ]] || { echo 'Release already exists.' >&2; exit 1; }
    mkdir "$target"
    tar -xzf "$base/incoming/$id.tar.gz" -C "$target" --no-same-owner
    rm "$base/incoming/$id.tar.gz"
    for file in index.html id/index.html 404.html; do test -s "$target/$file"; done
    test -d "$target/_astro"
    chmod -R u=rwX,go=rX "$target"
elif [[ $action == rollback ]]; then
    target=$(readlink -f "$base/previous" || true)
    [[ $target == "$base/releases/"* && -f $target/.successful && $target != "$old" ]] || { echo 'No previous successful release.' >&2; exit 1; }
else
    echo 'Use deploy <id>, rollback, or verify.' >&2; exit 1
fi

# Restore the active release if verification fails or the process is interrupted.
restore() {
    status=$?
    trap - EXIT
    if [[ -n $old && -d $old ]]; then switch_to "$old"; else rm -f "$base/current"; fi
    echo 'Activation failed; restored previous state.' >&2
    exit "$status"
}
trap restore EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
switch_to "$target"
verify
touch "$target/.successful"
if [[ -n $old && $old != "$target" ]]; then
    ln -sfn "$old" "$base/previous.next"
    mv -Tf "$base/previous.next" "$base/previous"
fi
trap - EXIT INT TERM

# Keep five successful releases, always including current and rollback target.
mapfile -t releases < <(find "$base/releases" -mindepth 2 -maxdepth 2 -name .successful -printf '%h\n' | sort -r)
keep=("$target")
[[ -n $old ]] && keep+=("$old")
for release in "${releases[@]}"; do
    [[ " ${keep[*]} " == *" $release "* ]] && continue
    if (( ${#keep[@]} < 5 )); then keep+=("$release"); else rm -rf -- "$release"; fi
done
echo "Active release: $target"
