# FaderZero

Migration progressive de FaderZero vers une PWA offline-first, sans casser l'application Expo existante.

## Rules

Les règles détaillées vivent dans `.agents/rules/`. Lire le fichier pertinent avant d'agir :

- **PWA Migration** - [.agents/rules/pwa-migration.md](.agents/rules/pwa-migration.md) - Contraintes obligatoires pour la coexistence `expo/` et `pwa/`.

## Universal Rules

- **CRITICAL**: Ne casse jamais l'application Expo existante dans `expo/`.
- **CRITICAL**: Ne modifie pas les fichiers Expo sauf demande explicite de l'utilisateur.
- **CRITICAL**: Toute nouvelle implémentation web doit vivre dans `pwa/` et rester offline-first.
