# FaderZero — Série de prompts Codex

## Migration contrôlée Expo / React Native vers PWA React / Vite / TypeScript

**Objectif :** faire migrer progressivement l’application FaderZero vers une PWA offline-first sans casser l’application Expo existante, en gardant la logique métier utile et en sécurisant la base locale, la synchro QR et la migration des données.

**Note :** À envoyer à Codex un prompt à la fois. Ne pas lui demander de tout faire d’un coup. Après chaque étape : lire le diff, lancer les tests/build, puis commit.

---

## Règles générales pour tous les prompts

Tu travailles sur le dépôt FaderZero.

### Règles obligatoires

* Ne casse pas l’application Expo existante.
* La nouvelle PWA doit être créée dans un dossier séparé `/pwa`.
* Ne modifie pas les fichiers Expo sauf demande explicite.
* Travaille par petites étapes testables.
* Avant chaque modification importante, explique le plan.
* Après modification, donne la liste des fichiers changés, les commandes à lancer et les risques restants.
* TypeScript strict.
* Mobile-first.
* Offline-first.
* Aucun backend pour la V1.
* Garde les noms métiers existants quand c’est pertinent : `songs`, `setlists`, `setlistSongs`, `prompter`, `sync`.
* Évite les grosses abstractions inutiles.

---

## Prompt 1 — Audit du projet actuel

Analyse l’application Expo/React Native actuelle de FaderZero.

**Objectif :** produire un audit technique avant migration PWA.

### À analyser

* structure du projet
* navigation actuelle
* modèle SQLite
* écrans principaux
* logique métier réutilisable
* logique liée à Expo/React Native qui devra être remplacée
* sync QR existante
* prompteur
* points de dette technique

Ne modifie aucun fichier.

### Livrable attendu

1. résumé de l’architecture actuelle
2. tableau “à conserver / à remplacer / à réécrire”
3. risques de migration
4. plan de migration en petites étapes
5. première liste de fichiers à créer dans `/pwa`

---

## Prompt 2 — Création du squelette PWA

Crée une nouvelle application PWA dans `/pwa` sans toucher à l’application Expo existante.

### Stack cible

* Vite
* React
* TypeScript
* Tailwind CSS
* React Router
* Zustand
* Dexie + dexie-react-hooks
* vite-plugin-pwa
* lz-string
* qrcode
* html5-qrcode ou zxing-js, selon ce qui est le plus robuste
* Vitest

### Contraintes

* TypeScript strict
* architecture feature-based
* mobile-first
* thème sombre simple inspiré de FaderZero
* aucune dépendance inutile

### Structure souhaitée

```text
src/
  app/
  components/
  features/
    songs/
    setlists/
    prompter/
    sync/
    metronome/
  db/
    db.ts
    schema.ts
    repositories/
  services/
  stores/
  lib/
```

### Après création

* ajoute les scripts npm nécessaires
* vérifie que `npm install`, `npm run build` et `npm test` fonctionnent
* donne les commandes exactes à lancer

---

## Prompt 3 — Base locale Dexie

Implémente la base locale Dexie dans `/pwa`.

**Objectif :** recréer l’équivalent propre du modèle SQLite actuel.

### Tables minimales

* songs
* setlists
* setlistSongs

### Champs souhaités

#### Song

* id
* title
* artist optionnel
* lyrics
* key optionnel
* bpm optionnel
* notes optionnel
* createdAt
* updatedAt
* deletedAt optionnel

#### Setlist

* id
* name
* date optionnel
* notes optionnel
* createdAt
* updatedAt
* deletedAt optionnel

#### SetlistSong

* id
* setlistId
* songId
* position
* createdAt
* updatedAt

### Contraintes

* prévoir des migrations Dexie versionnées
* créer des repositories séparés
* ne pas accéder directement à Dexie depuis les composants React
* prévoir des helpers `createId` et `now`
* ajouter des tests unitaires simples sur les repositories

### Livrable attendu

* db/schema propre
* repositories `songs`, `setlists`, `setlistSongs`
* tests
* commandes de validation

---

## Prompt 4 — Migration de la fonctionnalité Morceaux

Migre uniquement la fonctionnalité “morceaux” dans la PWA.

**Objectif :** obtenir une première verticale complète fonctionnelle.

### À créer

* liste des morceaux
* création d’un morceau
* édition d’un morceau
* suppression soft-delete ou suppression simple selon l’existant
* recherche par titre
* tri alphabétique

### Contraintes UI

* mobile-first
* gros boutons utilisables en répétition
* design sombre
* pas de dépendance UI lourde

### Contraintes techniques

* utiliser le repository `songs`
* utiliser `dexie-react-hooks` ou un hook maison propre
* aucun accès direct à db depuis les composants
* gérer les états vide, chargement, erreur

Ne migre pas encore les setlists, le prompteur ou la sync QR.

### Après modification

* lance `npm run build`
* ajoute ou adapte les tests
* liste les fichiers modifiés

---

## Prompt 5 — Migration des setlists

Migre la fonctionnalité “setlists” dans la PWA.

**Objectif :** pouvoir créer une setlist, y ajouter des morceaux, les ordonner et les retirer.

### Fonctions attendues

* liste des setlists
* création / édition / suppression
* détail d’une setlist
* ajout de morceaux existants
* retrait d’un morceau d’une setlist
* réordonnancement par position
* affichage du nombre de morceaux

### Point important

Le modèle doit permettre d’avoir deux fois le même morceau dans une même setlist si nécessaire.

Donc ne pas utiliser une clé unique `setlistId + songId` comme contrainte principale.

### Contraintes

* utiliser les repositories
* préserver l’intégrité des données
* prévoir nettoyage des entrées `setlistSongs` si un morceau est supprimé
* UI mobile-first

### Après modification

* tests repositories
* `npm run build`
* résumé des risques restants

---

## Prompt 6 — Prompteur live

Migre le prompteur live dans la PWA.

**Objectif :** obtenir un mode scène fiable pour lire les paroles.

### Fonctions attendues

* sélectionner un morceau depuis le répertoire
* sélectionner un morceau depuis une setlist
* affichage plein écran
* taille de texte réglable
* autoscroll réglable
* bouton play/pause autoscroll
* reset position
* garder l’écran lisible en mobile
* mise en évidence ou formatage simple des accords entre crochets `[Am]`, `[G]`, etc.

### Contraintes

* utiliser CSS/React Web, pas de logique React Native
* penser iPhone Safari et Android Chrome
* éviter les dépendances lourdes
* ne pas encore ajouter le métronome

### Après modification

* `npm run build`
* tester manuellement le mode responsive
* indiquer les limitations connues sur iOS/PWA

---

## Prompt 7 — Sync QR : export/transmission

Migre la partie transmission QR dans la PWA.

**Objectif :** exporter les données locales vers une séquence de QR codes.

### À exporter

* songs
* setlists
* setlistSongs

### Format de payload souhaité

```json
{
  "protocol": "faderzero-sync",
  "protocolVersion": 1,
  "exportedAt": number,
  "sourceApp": "faderzero-pwa",
  "payloadHash": "string",
  "payload": {
    "songs": [],
    "setlists": [],
    "setlistSongs": []
  }
}
```

### Contraintes

* compresser le payload avec `lz-string` ou `fflate`
* fragmenter si nécessaire en plusieurs QR
* chaque fragment doit contenir `index`, `total`, `transferId`, `checksum/hash global`
* afficher clairement la progression : `QR 1/12`, `QR 2/12`, etc.
* ne pas exposer de données inutiles

### Après modification

* ajouter tests sur fragmentation/reconstruction si possible
* `npm run build`

---

## Prompt 8 — Sync QR : réception/import

Migre la réception QR dans la PWA.

**Objectif :** scanner une séquence de QR codes, reconstruire le payload et importer les données.

### Fonctions attendues

* accès caméra via API Web
* scan QR
* gestion des fragments dans le désordre
* affichage progression fragments reçus
* validation `protocol` / `protocolVersion`
* validation `hash/checksum` global
* import dans Dexie

### Règles d’import

* utiliser l’id comme source principale de vérité
* si un id existe déjà, comparer `updatedAt`
* si même titre mais id différent, ne pas écraser automatiquement
* prévoir un rapport d’import : créés, mis à jour, ignorés, conflits
* ne pas supprimer de données locales automatiquement

### Contraintes

* gérer les erreurs caméra clairement
* indiquer les limitations iOS/Safari
* ne pas casser les données locales si import incomplet

### Après modification

* tests unitaires sur la reconstruction/import
* `npm run build`

---

## Prompt 9 — Export/import JSON compatible ancienne app

Ajoute un système d’export/import JSON pour faciliter la migration depuis l’app Expo actuelle vers la PWA.

### Dans `/pwa`

* bouton exporter JSON
* bouton importer JSON
* validation du format
* rapport d’import

### Format cible

```json
{
  "version": 1,
  "app": "faderzero",
  "exportedAt": number,
  "songs": [],
  "setlists": [],
  "setlistSongs": []
}
```

Ensuite, propose les modifications minimales à faire dans l’app Expo existante pour ajouter un bouton “Exporter mes données”, mais ne les applique pas encore.

### Contraintes

* ne pas écraser automatiquement les données locales
* ne pas dépendre d’un backend
* gérer les erreurs JSON lisiblement

### Livrable

* fonctionnalité côté PWA
* proposition de patch séparé pour Expo
* commandes de validation

---

## Prompt 10 — Ajout minimal dans Expo : export JSON

Ajoute dans l’application Expo actuelle uniquement une fonctionnalité d’export JSON des données existantes.

**Objectif :** permettre aux utilisateurs de migrer leurs données vers la PWA.

### Contraintes très strictes

* ne pas modifier la structure existante de la base SQLite
* ne pas changer les écrans principaux sauf ajout d’un bouton ou écran d’export
* ne pas casser la sync QR existante
* exporter `songs`, `setlists`, `setlist_songs`
* générer un JSON compatible avec l’import PWA
* utiliser les APIs Expo disponibles pour partager/enregistrer le fichier

### Avant de modifier

* indique précisément quels fichiers tu vas toucher
* explique pourquoi

### Après modification

* donne les commandes de test
* donne une procédure manuelle de vérification

---

## Prompt 11 — Métronome PWA

Ajoute un premier métronome dans la PWA.

**Objectif :** métronome utilisable quand l’application est ouverte et l’écran allumé.

### Fonctions attendues

* BPM réglable
* start/stop
* tap tempo
* signature rythmique simple 4/4 par défaut
* accent sur le premier temps
* volume réglable
* sauvegarde du BPM éventuellement associé au morceau

### Contraintes techniques

* utiliser Web Audio API
* ne pas utiliser `setInterval` seul pour jouer les clics
* utiliser un scheduler Web Audio plus précis
* gérer la politique d’autoplay des navigateurs : démarrer uniquement après action utilisateur
* documenter les limites iOS/PWA : arrière-plan, écran verrouillé, précision selon navigateur

Ne cherche pas à faire un métronome “niveau app native pro” dans cette étape.

### Après modification

* `npm run build`
* expliquer comment tester la stabilité du tempo

---

## Prompt 12 — PWA polish et installation

Finalise la configuration PWA.

**Objectif :** rendre l’application installable proprement sur Android, iOS et desktop.

### À faire

* manifest complet
* icônes 192, 512 et maskable si possible
* `theme_color` et `background_color`
* service worker avec stratégie adaptée
* page offline ou fallback propre
* bouton ou message d’aide “Installer l’application”
* instructions spécifiques iOS : Safari > Partager > Ajouter à l’écran d’accueil
* gestion des mises à jour de l’app : informer l’utilisateur qu’une nouvelle version est disponible

### Contraintes

* ne pas casser le mode offline
* éviter de mettre en cache des données utilisateur dans le service worker
* les données utilisateur restent dans IndexedDB

### Après modification

* `npm run build`
* donner une checklist de test PWA

---

## Prompt 13 — Nettoyage, tests et stabilisation

Fais une passe de stabilisation de la PWA.

**Objectif :** préparer une version MVP utilisable.

### À vérifier

* TypeScript strict sans erreurs
* build production OK
* tests unitaires OK
* pas d’accès direct à Dexie depuis les composants
* repositories propres
* composants trop gros à découper
* erreurs utilisateur lisibles
* responsive mobile
* offline après rechargement
* import/export JSON
* sync QR
* prompteur
* métronome

Ne réécris pas toute l’app.

Propose d’abord une liste priorisée de corrections, puis applique uniquement les corrections critiques.

### Livrable

* liste des corrections faites
* liste des corrections non faites
* checklist avant mise en ligne

---

## Prompt 14 — Préparation hébergement

Prépare la PWA pour un déploiement simple.

### Cibles possibles

* Cloudflare Pages
* Netlify
* Vercel
* serveur perso Nginx/Caddy

**Objectif :** documenter et préparer le déploiement sans imposer une plateforme.

### À faire

* vérifier le build statique
* ajouter variables d’environnement seulement si nécessaire
* documenter la commande de build
* documenter la commande de preview
* ajouter un README dans `/pwa`
* ajouter checklist HTTPS obligatoire pour PWA/caméra

### Important

La caméra et la PWA nécessitent HTTPS en production.

### Livrable

* README `/pwa` clair
* guide de déploiement court
* checklist de test après déploiement

---

## Checklist après chaque prompt Codex

* Lire le diff complet avant d’accepter.
* Lancer `npm install` si les dépendances ont changé.
* Lancer `npm run build` dans `/pwa`.
* Lancer `npm test` si des tests existent.
* Vérifier que l’app Expo existante n’a pas été modifiée par erreur.
* Faire un commit Git séparé par étape.
* Tester manuellement sur mobile avec le navigateur.
* Noter les bugs dans un fichier TODO ou GitHub Issues.

---

## Ordre recommandé des commits

1. `chore: add PWA scaffold`
2. `feat(db): add Dexie schema and repositories`
3. `feat(songs): migrate songs feature`
4. `feat(setlists): migrate setlists feature`
5. `feat(prompter): add web prompter`
6. `feat(sync): add QR export`
7. `feat(sync): add QR import`
8. `feat(migration): add JSON import export`
9. `feat(expo): add legacy JSON export`
10. `feat(metronome): add Web Audio metronome`
11. `chore(pwa): polish install and offline behavior`
12. `test: stabilize MVP`

---

## Conseil final

Garde l’app Expo comme référence fonctionnelle jusqu’à ce que la PWA ait au minimum :

* morceaux
* setlists
* prompteur
* export/import JSON

Ensuite seulement, décide si la PWA remplace officiellement l’ancienne app.
