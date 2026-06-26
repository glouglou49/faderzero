# FaderZero

FaderZero est une application mobile Expo pensee pour les musiciens et les groupes qui veulent preparer, organiser et utiliser un repertoire de chansons en repetition ou sur scene.

L'application permet de :

- gerer un repertoire local de morceaux
- editer titre, statut, tempo, tonalite, paroles et notes
- utiliser un prompteur live
- partager une chanson entre appareils via QR codes
- recevoir une chanson et l'inserer ou la fusionner dans la base locale

## Vision

FaderZero cherche a couvrir un flux simple et utile :

1. capturer une idee de morceau
2. la faire evoluer dans le repertoire
3. la preparer pour la scene
4. la transmettre rapidement a un autre appareil, sans backend

Le projet est encore en developpement, mais la base produit est deja la : stockage local, editeur, navigation scene, et synchronisation de morceaux.

## Stack technique

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- SQLite local via `expo-sqlite`
- NativeWind pour le styling
- `expo-camera` pour la reception QR
- `react-native-qrcode-svg` + `lz-string` pour la transmission QR

## Fonctionnalites actuelles

### Repertoire

- liste locale des chansons
- recherche par titre
- creation avec verification d'unicite du titre
- navigation vers la fiche detail d'un morceau

### Editeur de chanson

- edition du titre
- statut de creation
- selecteur de tempo BPM
- selecteur de tonalite
- edition des paroles et notes
- raccourcis d'insertion : `Couplet`, `Intro`, `Refrain`, `Pont`, `Solo`, `Outro`, `Accord [ ]`
- undo / redo
- autosave SQLite
- suppression
- partage vers l'ecran de transmission

### Live

- prompteur live avec vitesse reglable
- navigation entre morceaux
- mode plein ecran scene sur Android
- ecran metronome reserve pour le futur moteur live

### Synchronisation

- transmission d'une chanson via QR codes fragmentes
- reception via scanner camera
- reconstitution, decompression et import local
- mise a jour intelligente si le titre existe deja

## Structure du projet

```text
app/
  _layout.tsx             Layout racine + initialisation SQLite
  (tabs)/
    _layout.tsx           Navigation principale
    repertoire.tsx        Repertoire des chansons
    profile.tsx           Profil / entree sync
  song/
    [id].tsx              Editeur detail d'une chanson
  live/
    prompter.tsx          Prompteur scene
    metronome.tsx         Placeholder metronome
  sync/
    transmit.tsx          Partage QR
    receive.tsx           Reception QR

components/
  CustomTabBar.tsx        Barre de navigation custom

assets/
  images/                 Icons, splash, assets app
```

## Base de donnees locale

La base SQLite est creee au lancement de l'application dans [app/_layout.tsx](D:/App%20en%20dev/FaderZero/app/_layout.tsx).

Table actuelle :

```sql
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  bpm INTEGER,
  key TEXT,
  text_content TEXT,
  updated_at TEXT
);
```

## Démarrage du projet

### Prerequis

- Node.js
- npm
- Expo Go ou un dev client Expo

### Installation

```bash
npm install
```

### Lancer le projet

```bash
npm start
```

Puis selon le besoin :

```bash
npm run android
npm run ios
npm run web
```

### Verification

```bash
npm run lint
npx tsc --noEmit
```

## Configuration Expo

Identifiants actuels :

- iOS bundle id : `com.yann.faderzero`
- Android package : `com.yann.faderzero`
- scheme deep link : `faderzero`

Le projet utilise aussi :

- `typedRoutes`
- `reactCompiler`
- `newArchEnabled`

## Flux de synchronisation QR

Le partage ne depend pas d'un serveur distant.

Principe actuel :

1. on charge la chanson depuis SQLite
2. on la serialize en JSON
3. on compresse la charge utile avec `lz-string`
4. on la decoupe en morceaux
5. on affiche une boucle de QR codes
6. l'autre appareil scanne, reconstitue et propose l'ajout ou le remplacement

Ce choix permet un transfert local simple entre deux appareils, meme hors ligne.

## Etat du projet

Deja exploitable :

- repertoire
- editeur
- BPM / tonalite / statut
- prompteur
- sync QR

En cours ou a venir :

- metronome live complet
- setlist live plus riche
- profil / parametres
- consolidation de certains flux UI et scene

## Notes de developpement

- Les changements Expo doivent rester compatibles SDK 54.
- La navigation repose sur Expo Router, donc les ecrans vivent dans `app/`.
- Les donnees chansons sont considerees comme locales d'abord.
- Une partie du projet a ete pensee pour rester utilisable offline.

## Commandes utiles

```bash
npm start
npm run lint
npx tsc --noEmit
```

## Licence

Projet prive pour le moment.
