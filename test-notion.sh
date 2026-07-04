#!/usr/bin/env bash
# Helper de test manuel du socle Notion.
#   ./test-notion.sh setup                 -> prépare session + affiche token/agence
#   ./test-notion.sh create-content "Titre"
#   ./test-notion.sh create-curation "Titre"
#   ./test-notion.sh list                  -> liste contenus + curation (app)
#   ./test-notion.sh push                  -> app -> Notion
#   ./test-notion.sh pull                  -> Notion -> app
#   ./test-notion.sh notion                -> ce qu'il y a dans les 2 bases Notion
set -euo pipefail
cd "$(dirname "$0")"
BASE=${BASE:-http://localhost:3333/api}
EMAIL=${EMAIL:-demo@example.com}
PASS=${PASS:-password123}
CONTENT_DS=$(grep '^NOTION_CONTENT_DATABASE_ID=' .env | cut -d= -f2)
CURATION_DS=$(grep '^NOTION_CURATION_DATABASE_ID=' .env | cut -d= -f2)
NOTION_TOKEN=$(grep '^NOTION_TOKEN=' .env | cut -d= -f2)

pick() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);console.log($1)}catch(e){console.log('')}})"; }

token() {
  local t
  t=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
        -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | pick 'o.token||""')
  if [ -z "$t" ]; then
    t=$(curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
          -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Demo\"}" | pick 'o.token||""')
  fi
  echo "$t"
}

agency() {
  local tk=$1 id
  id=$(curl -s "$BASE/agencies" -H "Authorization: Bearer $tk" \
        | pick '(o[0]&&(o[0].id||(o[0].agency&&o[0].agency.id)))||""')
  if [ -z "$id" ]; then
    id=$(curl -s -X POST "$BASE/agencies" -H "Authorization: Bearer $tk" -H 'Content-Type: application/json' \
          -d '{"name":"Agence Demo"}' | pick 'o.agency?o.agency.id:o.id')
  fi
  echo "$id"
}

TK=$(token); AG=$(agency "$TK")
AUTH=(-H "Authorization: Bearer $TK")
CMD=${1:-setup}

case "$CMD" in
  setup)
    echo "BASE   = $BASE"
    echo "TOKEN  = $TK"
    echo "AGENCY = $AG"
    echo
    echo "Exemples prêts à copier :"
    echo "  curl -s -X POST $BASE/agencies/$AG/content -H 'Authorization: Bearer $TK' -H 'Content-Type: application/json' -d '{\"title\":\"Mon contenu\"}'"
    echo "  curl -s -X POST $BASE/agencies/$AG/notion/sync/push -H 'Authorization: Bearer $TK'"
    echo "  curl -s -X POST $BASE/agencies/$AG/notion/sync/pull -H 'Authorization: Bearer $TK'"
    ;;
  create-content)
    curl -s -X POST "$BASE/agencies/$AG/content" "${AUTH[@]}" -H 'Content-Type: application/json' \
      -d "{\"title\":\"${2:-Contenu de test}\",\"channel\":\"Catégorie 1\"}" | pick 'JSON.stringify(o,null,2)'
    ;;
  create-curation)
    curl -s -X POST "$BASE/agencies/$AG/curation" "${AUTH[@]}" -H 'Content-Type: application/json' \
      -d "{\"title\":\"${2:-Ressource de test}\",\"sourceUrl\":\"https://exemple.com\",\"status\":\"TO_REVIEW\"}" | pick 'JSON.stringify(o,null,2)'
    ;;
  list)
    echo "--- contenus ---"
    curl -s "$BASE/agencies/$AG/content" "${AUTH[@]}" | pick 'o.map(x=>x.title+" ["+x.syncStatus+"]").join("\n")'
    echo "--- curation ---"
    curl -s "$BASE/agencies/$AG/curation" "${AUTH[@]}" | pick 'o.map(x=>x.title+" ["+x.syncStatus+"]").join("\n")'
    ;;
  push) curl -s -X POST "$BASE/agencies/$AG/notion/sync/push" "${AUTH[@]}"; echo ;;
  pull) curl -s -X POST "$BASE/agencies/$AG/notion/sync/pull" "${AUTH[@]}"; echo ;;
  notion)
    for pair in "Articles:$CONTENT_DS:Nom de l'article" "Centre de ressources:$CURATION_DS:Nom du document"; do
      name="${pair%%:*}"; rest="${pair#*:}"; ds="${rest%%:*}"; titleprop="${rest#*:}"
      echo "--- $name ---"
      curl -s -X POST "https://api.notion.com/v1/data_sources/$ds/query" \
        -H "Authorization: Bearer $NOTION_TOKEN" -H "Notion-Version: 2025-09-03" \
        -H "Content-Type: application/json" -d '{"page_size":25}' \
        | TITLEPROP="$titleprop" python3 -c "import sys,json,os
d=json.load(sys.stdin); tp=os.environ['TITLEPROP']
for r in d.get('results',[]):
    print(' -', ''.join(x.get('plain_text','') for x in r['properties'][tp]['title']))"
    done
    ;;
  *) echo "Commande inconnue: $CMD"; exit 1 ;;
esac
