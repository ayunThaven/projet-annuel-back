# Socle IA

Le module `AiModule` fournit une couche commune pour appeler un modele LLM sans
lier le projet a un fournisseur precis.

## Routes disponibles

Toutes les routes sont protegees par `AuthGuard`.

- `GET /api/ai/providers` : liste les providers disponibles et leur statut de
  configuration. Les secrets ne sont jamais retournes.
- `POST /api/ai/generate` : endpoint simple avec `prompt` et optionnellement
  `context`, `systemPrompt`, `provider`, `model`, `temperature`, `maxTokens`.
- `POST /api/ai/chat` : endpoint plus bas niveau avec un tableau `messages`
  au format `{ role, content }` et un `context` optionnel.

## Contexte applicatif

`AiService` injecte toujours un contexte systeme SEO Genius avant l'appel au
provider. Ce contexte cadre l'IA sur la generation et l'optimisation de contenu
SEO en francais, et lui demande de refuser les demandes hors perimetre.

Les modules metier peuvent ajouter un contexte dynamique via le champ `context`.
Il peut contenir par exemple un brief, des ressources RSS, une cible editoriale,
des mots-cles, des contraintes de ton ou des informations agence.

`AI_APP_CONTEXT` permet d'ajouter un complement global depuis l'environnement,
mais le contexte par defaut reste versionne dans `src/ai/prompts`.

## Configuration

Par defaut, `AI_PROVIDER=gemini` utilise le provider Gemini de l'application.

```env
AI_PROVIDER=gemini
AI_APP_CONTEXT=
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_TIMEOUT_MS=30000
```

Pour tester l'API sans cle externe, utiliser le provider local :

```env
AI_PROVIDER=demo
AI_DEMO_MODEL=demo-local
```

Le modele reste interchangeable par configuration avec `GEMINI_MODEL`, ou route
par route avec le champ optionnel `model`.

## Ajouter un provider

1. Creer une classe dans `src/ai/providers`.
2. Implementer `AiProvider`.
3. Declarer le provider dans `AiModule`.
4. L'ajouter a la map dans `AiService`.

Les modules metier doivent consommer `AiService` plutot que les providers
directement. Cela permet de changer de modele ou de fournisseur sans modifier
les futurs modules de generation SEO.
