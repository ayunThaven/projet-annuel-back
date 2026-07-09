# Plan d'intégration — Curation de contenu (backend)

Ce document décrit, étape par étape, l'implémentation du périmètre **Curation de contenu**
du projet annuel (Groupe 6). Chaque étape est autonome, testable, et écrite pour être
exécutée directement par Claude Code.

## 0. Contexte & attendus

Attendus du client (Notion — feedback Groupe 6), périmètre curation :

- **Intégration des flux RSS** (ingestion automatique de ressources externes).
- **Gestion des tags** sur les ressources curées.
- **Stockage des ressources** dans l'application.
- **Rétention** : données conservées **30 jours** dans l'app, archivage long terme dans **Notion**.
- **Export de la curation vers Notion**.
- **Synchronisation bidirectionnelle** app ↔ Notion (push et pull).

Contraintes techniques transverses : app en français, multi-agences (isolation par `agencyId`),
NestJS + TypeORM + PostgreSQL, déploiement en ligne.

### État actuel du dépôt (TDD amorcé)

Les **specs existent déjà**, mais **pas les implémentations** :

- `src/curation/curation.service.spec.ts` → attend `CurationService`, `CurationItemEntity`, DTOs.
- `src/content/content.service.spec.ts` → attend `ContentService`, `ContentItemEntity`, DTOs.
- `src/notion/notion-client.service.spec.ts` → attend `NotionClientService`, constants, types.
- `src/notion/notion-sync.service.spec.ts` → attend `NotionSyncService` (push/pull content & curation).

Manquent totalement (aucune spec) : **enum `SyncStatus`**, **contrôleurs**, **modules**,
**mapper Notion**, **ingestion RSS**, **migration** et **câblage** (`app.module`, `data-source`).

Conventions à respecter (observées dans le code existant) :

- Isolation agence via relation `agency` + `@AgencyRoles(...)` + `AuthGuard`/`AgencyRolesGuard`.
- Colonnes Notion optionnelles sur `AgencyEntity` (`notionDatabaseId` déjà présent).
- Migrations SQL manuelles (voir `1782864000000-init-auth-agencies.ts`), jamais `synchronize`.
- Enregistrer chaque entité dans `src/database/data-source.ts` **et** la migration.

**Règle de validation générale** : à la fin de chaque étape, `npm test` (Jest) passe,
`npm run lint` est propre, et `npm run build` compile.

---

## Étape 1 — Enum `SyncStatus` (socle commun)

Créer `src/common/enums/sync-status.enum.ts` :

```ts
export enum SyncStatus {
  PENDING = 'PENDING',   // modifié localement, à pousser vers Notion
  SYNCED = 'SYNCED',     // aligné avec Notion
  ERROR = 'ERROR',       // dernière synchro en échec
}
```

**Test** : les specs curation/content/notion importent déjà cet enum ; il doit résoudre à la
compilation. Pas de spec dédiée nécessaire.

---

## Étape 2 — Domaine Curation (CRUD + statut de synchro)

Objectif : faire passer `src/curation/curation.service.spec.ts`.

### 2.1 Entité `src/curation/entities/curation-item.entity.ts`

Champs (déduits de la spec) :

| Champ        | Type                    | Notes                                    |
|--------------|-------------------------|------------------------------------------|
| `id`         | uuid PK                 |                                          |
| `title`      | varchar                 | requis                                   |
| `sourceUrl`  | varchar nullable        | URL de la ressource                      |
| `source`     | varchar nullable        | nom du flux/source (ex. « Medium »)      |
| `topics`     | text[] / simple-array nullable | tags/thématiques                  |
| `status`     | varchar                 | ex. `ACTIVE` / `ARCHIVED`                |
| `curatedBy`  | varchar nullable        | email du curateur                        |
| `notes`      | text nullable           |                                          |
| `syncStatus` | enum `SyncStatus`       | défaut `PENDING`                         |
| `agency`     | ManyToOne `AgencyEntity`| colonne `agencyId`, `onDelete: CASCADE`  |
| `notionPageId` | varchar nullable      | id de page Notion (pour la synchro)      |
| `createdAt` / `updatedAt` | timestamps  |                                          |

> `notionPageId` n'est pas exercé par la spec CRUD mais est requis à l'étape 4 (synchro).
> L'ajouter dès maintenant évite une seconde migration.

### 2.2 DTOs

- `src/curation/dto/create-curation-item.dto.ts` : `title` (requis), et optionnels
  `sourceUrl`, `source`, `topics: string[]`, `status`, `curatedBy`, `notes`. Validation
  `class-validator` (`@IsString`, `@IsOptional`, `@IsArray`, `@IsUrl` sur `sourceUrl`).
- `src/curation/dto/update-curation-item.dto.ts` : `extends PartialType(CreateCurationItemDto)`.

### 2.3 Service `src/curation/curation.service.ts`

Comportements exigés par la spec :

- `create(agencyId, dto)` : `repository.create({ agency: { id: agencyId }, ...champs,
  syncStatus: PENDING })` puis `save`. **Trim** du `title`. Champs optionnels absents → `null`.
- `findAll(agencyId)` : `find({ where: { agency: { id } }, order: { createdAt: 'DESC' } })`.
- `findOne(agencyId, id)` : `findOne({ where: { id, agency: { id: agencyId } } })`,
  `NotFoundException` si absent.
- `update(agencyId, id, dto)` : recharge via `findOne`, applique le patch, force
  `syncStatus = PENDING`, `save`.
- `remove(agencyId, id)` : `findOne` puis `remove`, retourne `{ success: true }`.

### 2.4 Contrôleur `src/curation/curation.controller.ts`

Routes REST sous `agencies/:agencyId/curation`, protégées par
`@UseGuards(AuthGuard, AgencyRolesGuard)` :

- `POST` — `@AgencyRoles(OWNER, EDITOR, { agencyIdSource: 'params' })`
- `GET` (liste), `GET :id` — inclure `VIEWER`
- `PATCH :id`, `DELETE :id` — `OWNER, EDITOR`

### 2.5 Module `src/curation/curation.module.ts`

`TypeOrmModule.forFeature([CurationItemEntity])`, importe `AuthModule` + `AgenciesModule`
(pour `AgencyRolesGuard`), déclare contrôleur + service, **exporte `CurationService`**
(consommé par le module Notion).

**Test / checkpoint** :
```bash
npx jest src/curation/curation.service.spec.ts
```

---

## Étape 3 — Domaine Content (CRUD + statut de synchro)

Objectif : faire passer `src/content/content.service.spec.ts`. Structure **identique** à
l'étape 2 (copie adaptée).

### 3.1 Entité `src/content/entities/content-item.entity.ts`

Champs : `title`, `status`, `publicationDate` (timestamp nullable — le service **convertit
la string ISO du DTO en `Date`**), `channel`, `contentType`, `url`, `tags` (simple-array),
`notes`, `syncStatus`, `agency` (ManyToOne), `notionPageId` (nullable), timestamps.

### 3.2 DTOs, Service, Contrôleur, Module

- DTOs : `publicationDate` reçue en `string` (`@IsDateString`), convertie côté service
  (`new Date(dto.publicationDate)` sinon `null`).
- Service : mêmes règles que curation (trim `title`, nulls, `PENDING`, isolation agence).
- Contrôleur : `agencies/:agencyId/content`, mêmes rôles.
- Module : exporte `ContentService`.

**Test / checkpoint** :
```bash
npx jest src/content/content.service.spec.ts
```

> Le domaine Content est piloté par l'équipe « génération de contenu » ; il est inclus ici
> car la **synchro Notion** (étape 4) opère sur *content* **et** *curation* selon les specs.
> Se coordonner pour ne pas dupliquer : si Content existe déjà côté autre dev, réutiliser.

---

## Étape 4 — Intégration Notion (client + synchro bidirectionnelle)

Objectif : faire passer `notion-client.service.spec.ts` et `notion-sync.service.spec.ts`.

### 4.1 Port & constantes

- `src/notion/notion.constants.ts` : `export const NOTION_CLIENT_FACTORY = Symbol('NOTION_CLIENT_FACTORY');`
- `src/notion/notion.types.ts` :
  ```ts
  export interface NotionClientPort {
    searchPages(databaseId: string, filter?: unknown): Promise<NotionPage[]>;
    createPage(databaseId: string, props: Record<string, unknown>): Promise<NotionPage>;
    updatePage(pageId: string, props: Record<string, unknown>): Promise<NotionPage>;
  }
  ```
  Ports abstraits pour rester testable sans dépendre du SDK Notion officiel.

### 4.2 `NotionClientService` (`src/notion/notion-client.service.ts`)

`getClient(tokenOverride?)` : trim l'override ; sinon lit `ConfigService.get('NOTION_TOKEN')`.
Aucun token → `throw new Error('Notion token is not configured (set NOTION_TOKEN or provide a
per-agency token).')` (message **exact** attendu par la spec). Appelle la factory
`NOTION_CLIENT_FACTORY` avec le token résolu.

### 4.3 Factory réelle + provider

Fournir dans le module une factory qui construit un client concret à partir du SDK
`@notionhq/client` (à ajouter en dépendance) implémentant `NotionClientPort`.
En test/démo, un `DemoNotionClient` en mémoire (pas d'appel réseau).

### 4.4 Mapper `src/notion/notion.mapper.ts`

Fonctions pures de conversion entité ↔ propriétés Notion :
`curationToNotionProps`, `contentToNotionProps`, `notionPageToCuration`, `notionPageToContent`.
Testables unitairement (mapping des tags/topics vers multi-select, dates, titre).

### 4.5 `NotionSyncService` (`src/notion/notion-sync.service.ts`)

Type exporté `SyncSummary { created; updated; skipped; errors }`. Méthodes (spec) :

- `pushAll(agency)` = merge de `pushContent` + `pushCuration`.
- `pullAll(agency)` = merge de `pullContent` + `pullCuration`.
- `pushContent/pushCuration(agency)` : lit les items `syncStatus = PENDING`, appelle le privé
  `pushItems(...)`, met `SYNCED` en cas de succès (`ERROR` sinon).
- `pullContent/pullCuration(agency)` : `pullItems(...)` depuis `agency.notionDatabaseId`,
  upsert par `notionPageId`.
- Privés `pushItems` / `pullItems` : logique commune (création/màj + comptage summary).

Dépendances injectées (spec) : repos Content & Curation, `NotionClientService`, `ConfigService`.

### 4.6 Contrôleur `src/notion/notion-sync.controller.ts`

Sous `agencies/:agencyId/notion`, rôle `OWNER` (ou `EDITOR`) :

- `POST push` → `pushAll`
- `POST pull` → `pullAll`
- (option) `POST push/content`, `push/curation`, etc. pour granularité.

### 4.7 Module `src/notion/notion.module.ts`

`TypeOrmModule.forFeature([ContentItemEntity, CurationItemEntity, AgencyEntity])`,
provider `NOTION_CLIENT_FACTORY`, `NotionClientService`, `NotionSyncService`, contrôleur.
Importe `AuthModule` + `AgenciesModule`.

**Test / checkpoint** :
```bash
npx jest src/notion
```

---

## Étape 5 — Ingestion des flux RSS (cœur métier curation)

Aucune spec n'existe encore → **écrire les tests d'abord** (TDD).

### 5.1 Dépendance

Ajouter un parseur : `rss-parser` (`npm i rss-parser`).

### 5.2 Entité `FeedSourceEntity` (`src/curation/entities/feed-source.entity.ts`)

Un flux RSS abonné par agence :

| Champ | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `url` | varchar | URL du flux |
| `name` | varchar nullable | libellé |
| `defaultTopics` | simple-array nullable | tags appliqués aux items ingérés |
| `enabled` | boolean défaut `true` | |
| `lastFetchedAt` | timestamp nullable | |
| `agency` | ManyToOne `AgencyEntity` | isolation |
| `createdAt` / `updatedAt` | timestamps | |

### 5.3 DTOs

`create-feed-source.dto.ts` (`url` requis `@IsUrl`, `name?`, `defaultTopics?`),
`update-feed-source.dto.ts` (`PartialType` + `enabled?`).

### 5.4 `FeedSourceService` (`src/curation/feed-source.service.ts`)

CRUD des flux, isolation par agence (même patron que `CurationService`).
**Spec à écrire** : create/findAll/findOne/update/remove + `NotFoundException`.

### 5.5 `RssIngestionService` (`src/curation/rss-ingestion.service.ts`)

- Injecte le parseur via un **port** `RSS_PARSER` (pour mocker en test, pas de réseau réel).
- `ingestFeed(feed)` : parse l'URL, mappe chaque entrée → `CreateCurationItemDto`
  (`title`, `sourceUrl = item.link`, `source = feed.name`, `topics = feed.defaultTopics`).
- **Anti-doublon** : ne pas créer un `CurationItemEntity` si un item avec le même
  `sourceUrl` existe déjà pour l'agence. Retourne un résumé `{ imported, skipped }`.
- `ingestAllForAgency(agencyId)` : itère sur les flux `enabled`, met à jour `lastFetchedAt`.

**Specs à écrire** (avec parser mocké) :
- mappe correctement une entrée de flux vers un item de curation ;
- ignore les entrées dont le `sourceUrl` existe déjà (dédup) ;
- applique `defaultTopics` du flux ;
- met à jour `lastFetchedAt`.

### 5.6 Contrôleur

Étendre/ajouter `agencies/:agencyId/curation/feeds` :

- `POST feeds`, `GET feeds`, `PATCH feeds/:id`, `DELETE feeds/:id` (gestion des flux).
- `POST feeds/:id/ingest` et `POST feeds/ingest` (déclenchement manuel de l'ingestion).

### 5.7 Planification (optionnel mais recommandé)

`@nestjs/schedule` (`ScheduleModule.forRoot()`) + un cron (ex. horaire) qui appelle
`ingestAllForAgency` pour chaque agence ayant des flux actifs. Garder désactivable via env
(`RSS_CRON_ENABLED`).

**Test / checkpoint** :
```bash
npx jest src/curation
```

---

## Étape 6 — Rétention 30 jours + archivage Notion

Attendu : conserver 30 jours en base, archiver le reste dans Notion.

- `RetentionService` (`src/curation/retention.service.ts` ou commun) : supprime les
  `CurationItemEntity` (et `ContentItemEntity`) dont `createdAt` > 30 jours **et**
  `syncStatus = SYNCED` (garantie d'archivage Notion avant purge).
- Cron quotidien via `@nestjs/schedule`, seuil `RETENTION_DAYS` (défaut 30) en env.
- **Spec à écrire** : purge uniquement les items synchronisés et anciens ; conserve
  `PENDING`/`ERROR` même anciens (sinon perte de données non archivées).

---

## Étape 7 — Migration base de données

Nouvelle migration `src/database/migrations/<timestamp>-curation-content-notion.ts` :

- `CREATE TYPE "..._syncstatus_enum" AS ENUM ('PENDING','SYNCED','ERROR')` (une par table
  ou un type partagé selon convention TypeORM).
- Tables `curation_items`, `content_items`, `feed_sources` avec colonnes ci-dessus,
  FK `agencyId → agencies(id) ON DELETE CASCADE`, index sur `agencyId`, et index unique
  `(agencyId, sourceUrl)` sur `curation_items` pour l'anti-doublon.
- `down()` symétrique (DROP tables + types).

Générer plutôt via TypeORM après enregistrement des entités :
```bash
npm run migration:generate
```
puis relire/ajuster le SQL. Vérifier :
```bash
npm run migration:run
npm run migration:show
```

---

## Étape 8 — Câblage applicatif

1. `src/database/data-source.ts` : ajouter `CurationItemEntity`, `ContentItemEntity`,
   `FeedSourceEntity` au tableau `entities` et la nouvelle migration à `migrations`.
2. `src/app.module.ts` : importer `CurationModule`, `ContentModule`, `NotionModule`
   (+ `ScheduleModule.forRoot()` si crons activés).
3. `.env.example` : ajouter
   ```
   NOTION_TOKEN=
   RETENTION_DAYS=30
   RSS_CRON_ENABLED=false
   ```

**Checkpoint global** :
```bash
npm run lint && npm run build && npm test
```

---

## Étape 9 — Documentation & smoke test manuel

- `docs/curation.md` : modèle de données, endpoints, flux RSS, synchro Notion, rétention.
- Mettre à jour `README.md` (section curation + variables d'env).
- Smoke test manuel (avec un token Notion de test et un flux RSS public) :
  1. Créer une agence, s'y authentifier.
  2. `POST feeds` avec une URL RSS réelle, puis `POST feeds/:id/ingest`.
  3. `GET curation` → vérifier les items importés + dédup au second ingest.
  4. `POST notion/push` → vérifier la création dans Notion et `syncStatus = SYNCED`.
  5. Modifier dans Notion, `POST notion/pull` → vérifier la mise à jour en base.

---

## Récapitulatif de l'ordre d'exécution

| # | Étape | Livrable testable |
|---|-------|-------------------|
| 1 | Enum `SyncStatus` | compile |
| 2 | Domaine Curation | `curation.service.spec` ✅ |
| 3 | Domaine Content | `content.service.spec` ✅ |
| 4 | Intégration Notion | `notion-*.spec` ✅ |
| 5 | Ingestion RSS + anti-doublon | nouvelles specs ✅ |
| 6 | Rétention 30 j | nouvelle spec ✅ |
| 7 | Migration | `migration:run` OK |
| 8 | Câblage app | `build` + `test` OK |
| 9 | Docs + smoke test | validation manuelle |

Dépendances à installer : `@notionhq/client`, `rss-parser`, `@nestjs/schedule`.
