# PWA Migration

Règles obligatoires pour faire coexister l'application Expo existante et la nouvelle PWA.

## When this applies

- Toute demande liée à `expo/`, `pwa/`, la migration web, la base locale, la sync ou l'import/export.

## Rules

- **CRITICAL**: Ne casse pas l'application Expo existante dans `expo/`.
- **CRITICAL**: La nouvelle PWA doit être créée et maintenue dans un dossier séparé `pwa/`.
- **CRITICAL**: Ne modifie pas les fichiers Expo sauf demande explicite.
- **ALWAYS**: Travaille par petites étapes testables.
- **ALWAYS**: Avant chaque modification importante, explique le plan.
- **ALWAYS**: Après modification, donne la liste des fichiers changés, les commandes à lancer et les risques restants.
- **ALWAYS**: Utilise TypeScript strict pour le code de la PWA.
- **ALWAYS**: Conçois l'interface en mobile-first.
- **ALWAYS**: Conçois la PWA en offline-first.
- **NEVER**: Ajoute un backend pour la V1.
- **ALWAYS**: Garde les noms métiers existants quand c'est pertinent : `songs`, `setlists`, `setlistSongs`, `prompter`, `sync`.
- **NEVER**: Introduis de grosses abstractions inutiles.
