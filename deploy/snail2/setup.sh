#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
base=/var/www/tigapilardewata
conf=/etc/nginx/sites-available/tigapilardewata
enabled=/etc/nginx/sites-enabled/tigapilardewata
[[ $(id -u) == 0 ]] || { echo 'Run setup as root.' >&2; exit 1; }
nginx -t
if [[ ! -e $enabled ]] && ss -lntH 'sport = :6767' | grep -q .; then
    echo 'Port 6767 is already occupied; setup stopped.' >&2; exit 1
fi
mkdir -p "$base/releases" "$base/incoming"
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
bash -n release.sh
backup=$(mktemp -d)
had_conf=0
had_enabled=0
if [[ -e $conf ]]; then cp -a "$conf" "$backup/conf"; had_conf=1; fi
if [[ -e $enabled || -L $enabled ]]; then cp -a "$enabled" "$backup/enabled"; had_enabled=1; fi
restore() {
    status=$?
    trap - EXIT
    rm -f "$conf" "$enabled"
    (( had_conf == 0 )) || cp -a "$backup/conf" "$conf"
    (( had_enabled == 0 )) || cp -a "$backup/enabled" "$enabled"
    nginx -t && systemctl reload nginx
    rm -rf "$backup"
    exit "$status"
}
trap restore EXIT
install -m 644 nginx.conf "$conf"
ln -sfn "$conf" "$enabled"
nginx -t
systemctl reload nginx
install -m 755 release.sh "$base/release.sh"
trap - EXIT
rm -rf "$backup"
echo 'Nginx configured on port 6767. Run npm run deploy:snail2 next.'
