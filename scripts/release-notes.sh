#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
#
# Releasens titel och text ur README:s avsnitt för versionen (0.12.5.4).
# Användning: scripts/release-notes.sh 0.12.5.4 titel|text
set -euo pipefail
v="$1"
head=$(grep -m1 -E "^Version ${v//./\\.}[ ,(]" README.md || true)
if [ -z "$head" ]; then
  [ "$2" = titel ] && echo "$v" || echo "Se README."
  exit 0
fi
if [ "$2" = titel ]; then
  # "Version 0.12.5.4, Licensen (samma …):" → "0.12.5.4 Licensen"
  name=$(echo "$head" | sed -E "s/^Version [0-9.]+,? ?//; s/ *\(.*$//; s/:$//")
  echo "$v${name:+ $name}"
else
  awk -v h="$head" '$0==h {on=1; next} on && /^Version [0-9]/ {exit} on {print}' README.md | sed -e '${/^$/d}'
  format=$(echo "$head" | grep -oE '\((samma |nytt )?filformat[^)]*\)' || true)
  [ -n "$format" ] && printf '\n%s\n' "${format:1:${#format}-2}" | sed 's/^./\U&/'
fi
exit 0
