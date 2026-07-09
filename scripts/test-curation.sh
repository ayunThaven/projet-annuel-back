#!/usr/bin/env bash
#
# Script de test manuel du parcours "Curation de contenu".
#
# Enchaine : register -> login (cookie) -> creation d'agence -> ajout de flux RSS
# -> ingestion -> liste des ressources -> 2e ingestion (verifie l'anti-doublon).
#
# Pre-requis : l'API doit tourner (npm run start:dev) et la base migree.
#
# Usage :
#   ./scripts/test-curation.sh
#   BASE=http://localhost:3333/api ./scripts/test-curation.sh
#   EMAIL=autre@test.dev ./scripts/test-curation.sh
#
set -euo pipefail

BASE="${BASE:-http://localhost:3333/api}"
EMAIL="${EMAIL:-curation+$(date +%s)@test.dev}"
PASSWORD="${PASSWORD:-Sup3rSecret!}"
JAR="$(mktemp -t curation-cookies.XXXX)"

# Flux RSS testes (nom|url|topics). Modifiable librement.
FEEDS=(
  "Hacker News|https://news.ycombinator.com/rss|tech,hn"
  "Le Monde|https://www.lemonde.fr/rss/une.xml|actu,fr"
  "DEV.to|https://dev.to/feed|dev,blog"
)

# --- petits helpers -------------------------------------------------------
# Extrait une valeur d'un JSON lu sur stdin, via un chemin type "agency.id".
json() {
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        let v = JSON.parse(s);
        for (const k of process.argv[1].split(".")) v = v?.[k];
        console.log(v ?? "");
      } catch (e) {
        console.error("Reponse inattendue: " + s.slice(0, 200));
        process.exit(1);
      }
    });
  ' "$1"
}

step() { printf "\n\033[1;36m== %s ==\033[0m\n" "$1"; }

cleanup() { rm -f "$JAR"; }
trap cleanup EXIT

# --- verifie que l'API repond --------------------------------------------
if ! curl -sf -o /dev/null "$BASE/../" 2>/dev/null && ! curl -s -o /dev/null "$BASE/auth/me"; then
  echo "L'API ne repond pas sur $BASE — lance d'abord: npm run start:dev" >&2
  exit 1
fi

step "1. Creation du compte ($EMAIL)"
curl -s -c "$JAR" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Curation Tester\"}" \
  > /dev/null
echo "compte cree, session enregistree."

step "2. Creation de l'agence"
AGID="$(curl -s -b "$JAR" -X POST "$BASE/agencies" -H 'Content-Type: application/json' \
  -d '{"name":"Agence de test curation"}' | json agency.id)"
echo "agencyId = $AGID"

step "3. Ajout des flux RSS + ingestion"
for entry in "${FEEDS[@]}"; do
  IFS='|' read -r name url topics <<< "$entry"
  topics_json="$(node -e 'console.log(JSON.stringify(process.argv[1].split(",")))' "$topics")"
  fid="$(curl -s -b "$JAR" -X POST "$BASE/agencies/$AGID/curation/feeds" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$url\",\"name\":\"$name\",\"defaultTopics\":$topics_json}" | json id)"
  result="$(curl -s -b "$JAR" -X POST "$BASE/agencies/$AGID/curation/feeds/$fid/ingest" --max-time 40)"
  imported="$(echo "$result" | json imported)"
  skipped="$(echo "$result" | json skipped)"
  printf "  %-14s importes=%-4s ignores=%-4s\n" "$name" "$imported" "$skipped"
done

step "4. Nombre total de ressources curees"
count="$(curl -s -b "$JAR" "$BASE/agencies/$AGID/curation" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))')"
echo "total = $count ressources"

step "5. 2e ingestion globale (doit tout ignorer = anti-doublon)"
result="$(curl -s -b "$JAR" -X POST "$BASE/agencies/$AGID/curation/feeds/ingest" --max-time 60)"
echo "resultat = $result"

step "Termine"
echo "Compte de test : $EMAIL / $PASSWORD"
echo "agencyId       : $AGID"
echo "Pour explorer : reconnecte-toi puis liste les ressources :"
echo "  curl -s -c /tmp/j -X POST $BASE/auth/login -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}' >/dev/null"
echo "  curl -s -b /tmp/j $BASE/agencies/$AGID/curation | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.stringify(JSON.parse(s),null,2)))'"
