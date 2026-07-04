# Intégration Notion — guide de test

Ce document explique comment lancer et tester le socle de **synchronisation
bidirectionnelle Notion** du back (NestJS + TypeORM + Postgres).

Ce qu'il fait :

- **Export** des contenus et de la curation **vers Notion** (`push`).
- **Import** depuis Notion **vers l'application** (`pull`).
- Synchronisation dans les deux sens, avec détection de conflit.

Bases Notion utilisées (template *Content marketing & curation*) :

| Base Notion            | Entité applicative | Table Postgres   |
| ---------------------- | ------------------ | ---------------- |
| **Articles**           | `ContentItem`      | `content_items`  |
| **Centre de ressources** | `CurationItem`   | `curation_items` |

---

## 1. Prérequis

- Node 18+ et npm
- Un Postgres (local, ou le conteneur Docker jetable ci-dessous)
- Accès au **workspace Notion** contenant le template dupliqué

```bash
npm install
```

---

## 2. Configuration Notion (à faire une fois)

### 2.1 Créer la connexion (jeton d'accès)

1. Notion → **Paramètres** → **Connexions** → **Gérer** → *ou* <https://www.notion.so/my-integrations>.
2. **Nouvelle connexion** → méthode **« Jeton d'accès »** (jeton d'API statique du
   workspace) → choisir le workspace du template → **Créer**.
3. Ouvrir la connexion → copier le **jeton** (`ntn_...`) → c'est le `NOTION_TOKEN`.

### 2.2 Partager les 2 bases avec la connexion

Sur la page du template dupliqué (ou sur chaque base) : menu `•••` →
**Connexions** → ajouter la connexion créée. Sans ce partage, l'API renvoie 404.

### 2.3 Récupérer les `data_source_id`

> ⚠️ Le SDK utilise l'API Notion **2025-09-03** : les identifiants attendus sont
> des **data source IDs**, pas les anciens database IDs.

Lister ce que voit la connexion :

```bash
curl -s https://api.notion.com/v1/search \
  -H "Authorization: Bearer <NOTION_TOKEN>" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" -d '{"page_size":50}' \
| python3 -c "import sys,json
for r in json.load(sys.stdin)['results']:
    if r['object']=='data_source':
        print(''.join(t.get('plain_text','') for t in r.get('title',[])), '->', r['id'])"
```

Note l'`id` de **Articles** (→ `NOTION_CONTENT_DATABASE_ID`) et de
**Centre de ressources** (→ `NOTION_CURATION_DATABASE_ID`).

---

## 3. Fichier `.env`

Copier `.env.example` en `.env` et renseigner :

```bash
# Base de données (voir §4 pour le conteneur Docker)
DATABASE_URL=postgres://postgres:postgres@localhost:5433/seo_genius
DB_PORT=5433

# Notion
NOTION_TOKEN=ntn_xxx
NOTION_CONTENT_DATABASE_ID=<data_source_id Articles>
NOTION_CURATION_DATABASE_ID=<data_source_id Centre de ressources>
NOTION_SYNC_ENABLED=false          # true = sync périodique automatique
NOTION_SYNC_CRON=*/5 * * * *
```

`.env` est **gitignoré** : ne jamais committer le token.

---

## 4. Base de données

### Option A — Postgres jetable via Docker (recommandé pour tester)

```bash
docker run -d --name seo-genius-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=seo_genius \
  -p 5433:5432 postgres:16-alpine
```

### Option B — Postgres local

Adapter `DATABASE_URL` / `DB_*` dans `.env`.

Puis appliquer les migrations :

```bash
npm run migration:run       # crée les tables
# npm run migration:revert  # rollback (test)
```

---

## 5. Lancer l'application

```bash
npm run start          # http://localhost:3333 (préfixe /api)
```

---

## 6. Endpoints

Toutes les routes sont **scopées à une agence** et protégées par JWT + rôle
d'agence (`OWNER` / `EDITOR` / `VIEWER`). Écriture = OWNER/EDITOR, lecture = les 3.

### CRUD contenus / curation

| Méthode | Route                                     |
| ------- | ----------------------------------------- |
| POST    | `/api/agencies/:agencyId/content`         |
| GET     | `/api/agencies/:agencyId/content`         |
| GET     | `/api/agencies/:agencyId/content/:id`     |
| PATCH   | `/api/agencies/:agencyId/content/:id`     |
| DELETE  | `/api/agencies/:agencyId/content/:id`     |

Idem pour `.../curation`.

> Toute création/édition passe l'élément en `syncStatus = PENDING` : il sera
> exporté vers Notion au prochain `push`.

### Synchronisation

| Méthode | Route                                          | Effet          |
| ------- | ---------------------------------------------- | -------------- |
| POST    | `/api/agencies/:agencyId/notion/sync/push`     | App → Notion   |
| POST    | `/api/agencies/:agencyId/notion/sync/pull`     | Notion → App   |

Réponse : `{ created, updated, skipped, errors }`.

---

## 7. Tester rapidement

Un script d'aide gère l'authentification (register/login auto + agence) :

```bash
./test-notion.sh setup                     # affiche token + agence + exemples
./test-notion.sh create-content "Mon article"
./test-notion.sh create-curation "Ma ressource"
./test-notion.sh list                      # état côté app (PENDING/SYNCED)
./test-notion.sh push                      # app  -> Notion
./test-notion.sh pull                      # Notion -> app
./test-notion.sh notion                    # contenu réel des 2 bases Notion
```

### Scénario A — Export (App → Notion)

```bash
./test-notion.sh create-content "Écrit depuis l'app"
./test-notion.sh push
```

→ la ligne apparaît dans la base **Articles** de Notion.

### Scénario B — Import (Notion → App)

1. Dans Notion, modifier le titre/la date d'un article (ou ajouter une ligne).
2. ```bash
   ./test-notion.sh pull
   ./test-notion.sh list
   ```

→ la modification est répercutée en base.

### Sans le script (curl brut)

```bash
# 1. s'inscrire / se connecter
TOKEN=$(curl -s -X POST http://localhost:3333/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"password123"}' | jq -r .token)

# 2. créer une agence (on devient OWNER)
AG=$(curl -s -X POST http://localhost:3333/api/agencies \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Agence Test"}' | jq -r '.agency.id')

# 3. créer un contenu puis l'exporter
curl -s -X POST http://localhost:3333/api/agencies/$AG/content \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Hello Notion","channel":"Catégorie 1"}'
curl -s -X POST http://localhost:3333/api/agencies/$AG/notion/sync/push \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Tests automatisés

```bash
npm test        # unitaires : mappers, client, moteur de sync (aucun réseau)
npm run build   # compilation TypeScript
```

Les tests utilisent un `FakeNotionClient` et un repository en mémoire : ils ne
touchent ni Notion ni la base.

---

## 9. Mapping des colonnes

Les correspondances champ ⇄ colonne Notion sont centralisées et **à ajuster** si
le template évolue :

- Contenus : [`src/notion/mappers/content.mapper.ts`](src/notion/mappers/content.mapper.ts) → `CONTENT_PROPERTIES`
- Curation : [`src/notion/mappers/curation.mapper.ts`](src/notion/mappers/curation.mapper.ts) → `CURATION_PROPERTIES`

Mapping actuel (template FR) :

| App (ContentItem) | Colonne Notion « Articles » |
| ----------------- | --------------------------- |
| `title`           | `Nom de l'article`          |
| `publicationDate` | `Date de publication`       |
| `channel`         | `Catégorie` (select)        |

| App (CurationItem) | Colonne Notion « Centre de ressources » |
| ------------------ | --------------------------------------- |
| `title`            | `Nom du document`                       |
| `sourceUrl`        | `Source` (url)                          |
| `topics`           | `Catégorie` (multi-select)              |
| `status`           | `État` (A lire / Validée / Archivée)    |
| `notes`            | `Résumé`                                |

Les champs applicatifs sans colonne dans le template ne sont pas synchronisés.

---

## 10. Dépannage

| Symptôme                                   | Cause / solution                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `Notion database id is not configured`     | `NOTION_CONTENT/CURATION_DATABASE_ID` manquant dans `.env`              |
| `Notion token is not configured`           | `NOTION_TOKEN` manquant dans `.env`                                     |
| API Notion 404 sur une base                | La base n'est pas partagée avec la connexion (§2.2)                     |
| `pull` importe des titres vides            | Noms de colonnes différents du template → ajuster les mappers (§9)      |
| `EADDRINUSE :3333`                          | Un serveur tourne déjà : `lsof -ti tcp:3333 \| xargs kill`             |
| Erreur de connexion Postgres sur `:5433`   | Conteneur arrêté : `docker start seo-genius-pg`                         |

---

## 11. Architecture (repères)

- `src/notion/notion-client.service.ts` — fournit le client Notion (token → SDK).
- `src/notion/mappers/` — traduction entité ⇄ propriétés Notion (fonctions pures).
- `src/notion/notion-sync.service.ts` — moteur `push`/`pull` + résolution de conflit.
- `src/notion/notion.controller.ts` — endpoints de sync.
- `src/notion/notion-sync.scheduler.ts` — sync périodique (si `NOTION_SYNC_ENABLED=true`).
- `src/content/`, `src/curation/` — entités + CRUD.
