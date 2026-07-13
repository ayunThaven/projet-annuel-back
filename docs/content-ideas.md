# Module idees SEO

Le module `IdeasModule` genere des idees de contenu SEO, les stocke dans une
inbox de validation, puis permet de transformer une idee choisie en contenu du
calendrier editorial.

Il s'appuie sur `AiService`, les contenus existants et la curation de l'agence
pour proposer des sujets utiles tout en limitant les doublons.

## Routes disponibles

Toutes les routes sont protegees par `AuthGuard` et `AgencyRolesGuard`.

- `GET /api/agencies/:agencyId/ideas` : liste les idees de l'agence.
- `POST /api/agencies/:agencyId/ideas/generate` : genere un lot d'idees et les
  ajoute a l'inbox.
- `PATCH /api/agencies/:agencyId/ideas/:id` : met a jour le statut d'une idee
  (`NEW` ou `DISMISSED`). L'acceptation passe par la route dediee.
- `POST /api/agencies/:agencyId/ideas/:id/accept` : cree un `content_item` au
  statut `IDEA`, puis marque l'idee comme `ACCEPTED`.
- `GET /api/agencies/:agencyId/ideas/settings` : lit la configuration de
  generation automatique de l'agence.
- `PATCH /api/agencies/:agencyId/ideas/settings` : met a jour la configuration
  automatique. Reserve aux `OWNER`.

La generation et l'acceptation sont accessibles aux `OWNER` et `EDITOR`.
La lecture est accessible aux `OWNER`, `EDITOR` et `VIEWER`.

## Donnees principales

`content_ideas` contient l'inbox d'idees :

- titre, angle, type de contenu, mots-cles, intention SEO et justification ;
- score de doublon, statut de doublon et elements similaires detectes ;
- source `MANUAL` ou `SCHEDULED` ;
- statut `NEW`, `ACCEPTED` ou `DISMISSED` ;
- lien optionnel vers le contenu cree lors de l'acceptation.

`idea_generation_settings` contient le parametrage par agence :

- activation ;
- cadence `DAILY` ou `WEEKLY` (`DAILY` par defaut, soit 24h) ;
- heure locale, jour hebdomadaire, timezone ;
- theme, secteur, nombre d'idees et verification des doublons ;
- `nextRunAt` et `lastRunAt`.

`idea_generation_runs` historise chaque generation manuelle ou planifiee :

- source ;
- statut `SUCCESS` ou `ERROR` ;
- snapshot des parametres utilises ;
- nombre d'idees generees ;
- erreur eventuelle.

## Generation manuelle

Le endpoint `POST /ideas/generate` recoit :

```json
{
  "theme": "SEO local",
  "sector": "commerces independants",
  "count": 3,
  "checkDuplicates": true
}
```

Le service construit un contexte avec :

- les derniers contenus de l'agence ;
- les derniers items de curation ;
- les idees deja presentes dans l'inbox.

L'IA doit retourner un JSON strict. Le back revalide ensuite chaque idee,
recalcule le score de doublon cote serveur, persiste les idees, puis cree un
run `SUCCESS` ou `ERROR`.

En provider `demo`, si la reponse n'est pas du JSON, le service genere des idees
deterministes pour permettre de tester le workflow sans cle externe.

## Generation planifiee

`IdeasScheduler` cree un job Cron dynamique par configuration d'agence active.
Le job est programme directement a l'heure locale choisie dans les parametres :

- `DAILY` a `HH:mm` devient `m H * * *` ;
- `WEEKLY` a `HH:mm` le jour choisi devient `m H * * day`.

Au demarrage du back, les jobs actifs sont reconstruits depuis
`idea_generation_settings`. Quand les parametres d'une agence sont modifies via
`PATCH /ideas/settings`, le job de cette agence est supprime puis recree avec le
nouvel horaire.

Le job appelle le meme chemin metier que la generation manuelle avec la source
`SCHEDULED`.

Apres chaque tentative, il met a jour :

- `lastRunAt` ;
- `nextRunAt`, calcule selon la cadence, l'heure locale et le fuseau.

La timezone par defaut est `Europe/Paris`.

## Acceptation d'une idee

L'acceptation ne redige pas le contenu. Elle cree seulement une entree dans le
calendrier editorial existant :

- `title` reprend le titre de l'idee ;
- `status` vaut `IDEA` ;
- `contentType` reprend le type propose ;
- `tags` reprend les mots-cles ;
- `notes` contient l'angle, l'intention SEO et la justification.

Le contenu cree garde le comportement habituel de synchronisation Notion via
`syncStatus=PENDING`.

## Tests

Les tests principaux sont dans :

- `src/ideas/ideas.service.spec.ts`
- `src/ideas/idea-generation-schedule.spec.ts`

Ils couvrent la generation, le fallback demo, le scoring de doublons,
l'acceptation en contenu, la validation des settings, le calcul de prochaine
execution et les expressions Cron generees.
