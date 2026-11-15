#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
base=/var/www/tigapilardewata/cms
[[ $(id -u) == 0 ]] || { echo 'Run setup as root.' >&2; exit 1; }
[[ -x /usr/bin/node ]] || { echo 'Install Node.js 24.22+ at /usr/bin/node first.' >&2; exit 1; }
/usr/bin/node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<24 || (a===24 && b<22)) process.exit(1)'
command -v npm >/dev/null
nginx -t
bash -n release.sh
if ! id tpd-cms >/dev/null 2>&1; then useradd --system --home-dir "$base/shared" --shell /usr/sbin/nologin tpd-cms; fi
install -d -m 755 "$base/releases" "$base/incoming"
install -d -m 750 -o tpd-cms -g tpd-cms "$base/shared"
install -m 644 tigapilardewata-cms.service /etc/systemd/system/tigapilardewata-cms.service
install -m 644 nginx.conf "$base/nginx.conf"
install -m 755 release.sh "$base/release.sh"
systemctl daemon-reload
echo 'CMS setup prepared. Set /etc/tigapilardewata-cms.env, then run npm run deploy:snail2.'
echo 'Nginx has not been changed. The first successful CMS deploy switches its configuration.'
