# Fidelity Up — Documentation technique complète

> SaaS de fidélité Wallet pour commerces locaux.
> Massimo (14 Level Up) = agent commercial → vend l'abonnement → commerçant utilise l'app → client scanne et accumule des points.

---

## URLs de production

| Environnement | URL |
|---|---|
| App (Vercel) | https://fidelity-up.vercel.app |
| Supabase | https://zrbxgryrgpajqwciuozy.supabase.co |
| GitHub | https://github.com/massimotfbuisness-del/fidelity-up |
| AddToWallet | https://app.addtowallet.co |

---

## Variables d'environnement requises

### `.env.local` (local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://zrbxgryrgpajqwciuozy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADDTOWALLET_API_KEY=f5ecadd7-c2c6-3a8e-a95b-cf0aba1007e3
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Variables à configurer sur Vercel

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | https://zrbxgryrgpajqwciuozy.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (clé anon Supabase) |
| `ADDTOWALLET_API_KEY` | f5ecadd7-c2c6-3a8e-a95b-cf0aba1007e3 |
| `NEXT_PUBLIC_APP_URL` | https://fidelity-up.vercel.app |

> **Important** : `NEXT_PUBLIC_APP_URL` doit pointer vers le domaine de production sinon les QR codes générés pointent vers localhost.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| CSS | Tailwind CSS v4 |
| Base de données | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password) |
| Wallet provider | AddToWallet.co (Apple Wallet + Google Wallet) |
| QR génération | `qrcode.react` (QRCodeSVG) |
| QR scan | `jsqr` (lecture caméra native) |
| Déploiement | Vercel (auto-deploy depuis GitHub master) |

---

## Architecture

### Séparation des responsabilités

```
AddToWallet.co
  └── Rôle : moteur technique invisible
  └── Crée les cartes Wallet physiques (Apple + Google)
  └── Génère le lien d'installation
  └── Jamais visible par le commerçant ni le client

Fidelity Up (notre app)
  └── Rôle : plateforme centrale
  └── Gestion des tenants / commerces
  └── Gestion des clients et visites
  └── Dashboards commerçant
  └── Scan client (QR camera)
  └── Récompenses et CRM
  └── Pages d'installation pour les clients
```

### Flux complet

```
1. SETUP COMMERÇANT
   /setup → formulaire → crée tenant + tenant_profile + module loyalty
          → appelle POST /api/passes → AddToWallet crée carte template
          → install_url stocké en DB → redirige vers /board

2. AFFICHAGE QR COMMERÇANT
   /board → charge le pass de type "fidelite" du tenant
          → affiche QRCode de https://fidelity-up.vercel.app/install/{pass.id}
          → le commerçant montre ce QR à ses clients

3. INSCRIPTION CLIENT
   /install/{passId} → client scanne le QR
                     → saisit prénom + téléphone + email (optionnel)
                     → POST /api/create-wallet-pass
                     → upsert client dans Supabase
                     → crée carte personnelle sur AddToWallet (barcode = téléphone)
                     → retourne install_url
                     → affiche bouton "Ajouter à mon Wallet" + QR personnel

4. VISITE CLIENT
   /board → commerçant clique "Scanner client"
          → caméra scanne le QR du client (valeur = numéro de téléphone)
          → auto-enregistre la visite
          → met à jour visits_count + last_visit
          → alerte si récompense débloquée

5. ADMIN SUPER ADMIN
   /admin → accès avec info@14level-up.ch
          → voir tous les tenants
          → entrer dans n'importe quel commerce via localStorage
```

---

## Routes de l'application

| Route | Rôle |
|---|---|
| `/` | Redirect → `/merchants` |
| `/login` | Auth email/password |
| `/merchants` | Liste des commerces de l'utilisateur |
| `/setup` | Onboarding nouveau commerce (2 étapes) |
| `/board` | Dashboard commerçant principal (QR + scan + clients) |
| `/board/passes` | Gestion des cartes Wallet |
| `/board/settings` | Paramètres du commerce |
| `/install/[passId]` | Page d'installation pour les clients (publique) |
| `/admin` | Cockpit super admin (14 Level Up) |

---

## API Routes (backend)

### `POST /api/passes`
Crée un **pass template** (modèle) pour un commerce.
Utilisé lors du setup et de la création de nouvelles cartes.

**Body :**
```json
{
  "cardTitle": "Pizza du Coin — Carte Fidélité",
  "header": "Pizza du Coin",
  "hexBackgroundColor": "#6366f1",
  "barcodeType": "QR_CODE",
  "barcodeValue": "https://fidelity-up.vercel.app/install/",
  "textModulesData": [{ "id": "reward", "header": "Récompense après 10 visites", "body": "Café offert" }],
  "logoUrl": "https://..." // optionnel
}
```

**Réponse :**
```json
{
  "passId": "69d501ea6d8b39d9c45b60aa",
  "installUrl": "https://app.addtowallet.co/passgenerator/69d501ea6d8b39d9c45b60aa"
}
```

---

### `POST /api/create-wallet-pass`
Crée un **pass personnel** pour un client qui s'inscrit.
Le QR code de la carte contient son numéro de téléphone (pour le scan commerçant).

**Body :**
```json
{
  "pass_id": "uuid-du-pass-supabase",
  "name": "Marie",
  "phone": "+33612345678",
  "email": "marie@email.com" // optionnel
}
```

**Réponse :**
```json
{
  "success": true,
  "clientId": "uuid-client",
  "walletPassId": "69d...",
  "installUrl": "https://app.addtowallet.co/passgenerator/69d...",
  "phone": "+33612345678",
  "name": "Marie",
  "isNewClient": true
}
```

**Ce que fait l'endpoint :**
1. Charge le pass + tenant depuis Supabase
2. Upsert le client (crée si nouveau, met à jour si existant)
3. Crée un pass personnalisé sur AddToWallet avec le téléphone comme barcode
4. Stocke `wallet_pass_id` sur le client
5. Logue les events `client_created` et `pass_install_link_generated`

---

## Base de données Supabase

**Project ID :** `zrbxgryrgpajqwciuozy`
**Region :** eu-west-3 (Paris)

### Tables principales

#### `tenants`
| Colonne | Type | Description |
|---|---|---|
| id | uuid | PK |
| name | text | Nom du commerce |
| type | text | restaurant / barber / retail / garage / autre |
| primary_color | text | Couleur hex (#6366f1 par défaut) |
| logo_url | text | URL du logo |
| email | text | Email du propriétaire |
| slug | text | Identifiant URL |
| owner_id | uuid | Ref vers auth.users |

#### `passes`
| Colonne | Type | Description |
|---|---|---|
| id | uuid | PK (utilisé dans les QR d'installation) |
| type | text | fidelite / visite / cadeau / coupon |
| name | text | Nom affiché |
| reward_threshold | integer | Visites avant récompense (défaut 10) |
| reward_description | text | Description de la récompense |
| addtowallet_pass_id | text | ID du pass chez AddToWallet |
| install_url | text | `https://app.addtowallet.co/passgenerator/{addtowallet_pass_id}` |
| wallet_provider | text | addtowallet (défaut) |
| tenant_id | uuid | FK → tenants |

#### `clients`
| Colonne | Type | Description |
|---|---|---|
| id | uuid | PK |
| phone | text | Numéro de téléphone (identifiant principal) |
| name | text | Prénom |
| email | text | Email (optionnel) |
| visits_count | integer | Total visites |
| reward_level | integer | Récompenses débloquées |
| wallet_pass_id | text | ID du pass personnel sur AddToWallet |
| last_visit | timestamptz | Date dernière visite |
| tenant_id | uuid | FK → tenants |

#### `visits`
| Colonne | Type | Description |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients |
| tenant_id | uuid | FK → tenants |
| pass_id | uuid | FK → passes (optionnel) |
| created_at | timestamptz | Date de la visite |

#### `events`
| Colonne | Type | Description |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| type | text | client_created / pass_install_link_generated / visit_recorded |
| entity_type | text | client / pass |
| entity_id | uuid | Référence vers l'entité |
| payload | jsonb | Données supplémentaires |

#### Autres tables
- `tenant_members` — rôles (super_admin / owner / manager / staff)
- `tenant_modules` — modules activés par tenant (loyalty, etc.)
- `tenant_profile` — données CRM (daily_customers, staff_size, has_ubereats, has_whatsapp)
- `rewards` — récompenses débloquées et rachetées
- `notifications` — notifications à envoyer

---

## AddToWallet.co — Intégration

**API Key :** `f5ecadd7-c2c6-3a8e-a95b-cf0aba1007e3`

### Comportement important à connaître

- `POST /api/card/create` retourne **uniquement** `{ cardId, msg }` — **jamais d'URL d'installation**
- L'URL d'installation se construit manuellement : `https://app.addtowallet.co/passgenerator/{cardId}`
- `GET /api/card/{cardId}` retourne les détails complets (applePassUrl, googlePassUrl, etc.)
- Chaque client a son propre pass avec son téléphone comme valeur de QR code

### Flow AddToWallet

```
Passe template (commerce) → cardId stocké dans passes.addtowallet_pass_id
Passe client (personnel)  → cardId stocké dans clients.wallet_pass_id
URL installation          → https://app.addtowallet.co/passgenerator/{cardId}
```

---

## Multi-tenant

- Chaque commerce = 1 tenant
- Un utilisateur peut avoir plusieurs commerces
- Le commerce actif est stocké dans `localStorage.getItem('activeTenantId')`
- Si pas de `activeTenantId`, prend le premier commerce de l'utilisateur
- Super admin (info@14level-up.ch) peut entrer dans n'importe quel commerce via `/admin`

---

## Super Admin

**Email :** `info@14level-up.ch`

Accès depuis `/merchants` → bouton "🔑 Admin" visible uniquement pour ce compte.

Fonctionnalités :
- Voir tous les tenants avec stats
- Filtrer par type de commerce
- Entrer dans un commerce (définit `localStorage.activeTenantId`)

---

## PWA (Progressive Web App)

- Manifest : `/public/manifest.json`
- Icônes : `/public/icon-192.png` et `/public/icon-512.png`
- Theme color : #4f46e5
- `start_url` : /merchants
- Installable sur iPhone et Android via "Ajouter à l'écran d'accueil"

---

## Développement local

```bash
cd fidelity-up
npm install
npm run dev
# → http://localhost:3000
```

---

## Déploiement

Le déploiement est automatique via Vercel.
Chaque push sur `master` → nouveau déploiement en production.

```bash
git add -A
git commit -m "description"
git push origin master
# Vercel déploie automatiquement en ~1 minute
```

---

## Identité visuelle — 14 Level Up

> Charte graphique V1.0 — 2026. Document confidentiel.
> Fidelity Up est un produit de 14 Level Up. Toute interface destinée aux agents, commerçants ou communications commerciales doit respecter cette charte.

---

### Logo

**Construction :** `14 | LEVEL UP`
- `14` — grand chiffre, Raleway ultra-light (100)
- `|` — séparateur vertical fin
- `LEVEL` — Raleway Bold, uppercase, tracking serré
- `UP` — même taille que LEVEL, couleur **Ambre #B08050**

**Versions autorisées :**

| Version | Usage | Fond |
|---|---|---|
| Principale fond clair | Communication, web | #F4F2EF (Ivoire) |
| Principale fond sombre | Presentations, slides | #1C1A17 (Encre) |
| Monochrome | Impression, fax | Noir sur blanc |
| Icône / Favicon | App mobile, onglet | Carré arrondi Encre ou Ambre |

**Zone de protection :** espace vide = hauteur du `1` dans le logo (valeur `x`) de chaque côté. Aucun élément ne peut empiéter.

**Règles absolues :**
- Ne pas déformer / étirer
- Ne pas recolorer (autre que versions officielles)
- Ne pas ajouter d'ombre portée
- Ne pas placer sur un fond dégradé
- Ne pas placer sur un motif ou texture
- Ne pas faire pivoter

---

### Palette chromatique

| Nom | Hex | Usage sémantique |
|---|---|---|
| **Ivoire** | `#F4F2EF` | Fond principal clair — Clarté, Élégance |
| **Encre** | `#1C1A17` | Fond sombre — Autorité, Profondeur |
| **Ambre** | `#B08050` | Accent, CTA, liens — Énergie, Action |
| **Sable** | `#C8B89A` | Secondaire, sous-titres, pictos |
| **Pierre** | `#7A7670` | Texte secondaire, captions |

**Règle d'utilisation :**
- Fond Encre = pages d'autorité, headers, cartes sombres
- Fond Ivoire = pages courantes, documents, contenu principal
- Ambre = **uniquement** pour les CTA, accents, et la partie `UP` du logo
- Pierre = textes secondaires, labels discrets

---

### Typographie

Toutes les polices sont **Raleway** (Google Fonts) sauf les captions qui utilisent **DM Mono**.

| Rôle | Police | Poids | Taille | Tracking | Autre |
|---|---|---|---|---|---|
| Display | Raleway | 100 | 64px | −3% | Titres héros |
| Titre | Raleway | 200 | 36px | −1% | H1, H2 |
| Label | Raleway | 800 | 13px | +35% | Uppercase, catégories |
| Corps | Raleway | 300 | 14px | — | line-height 1.8 |
| Accent | Raleway | 200 | 13px | +45% | Uppercase, taglines |
| Caption | DM Mono | 300 | 10px | +20% | Références, métadonnées |

**Import Google Fonts :**
```css
@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@100;200;300;800&family=DM+Mono:wght@300&display=swap');
```

---

### Composants UI (référence design system)

**Boutons CTA (primaire) :**
- Fond : `#B08050` (Ambre)
- Texte : blanc, Raleway 800, uppercase, tracking +35%
- Pas de border-radius arrondi — angle droit ou très légèrement arrondi (2–4px)
- Exemple : `COMMENCER →`

**Boutons secondaires :**
- Outline : border `#1C1A17` ou `#B08050` selon le fond
- Texte : Raleway 700, uppercase
- Exemple : `EN SAVOIR PLUS`

**Tags / Étiquettes :**
- Fond Encre ou outline léger
- Texte Raleway 800 uppercase, petite taille
- Exemple : `FORMATION` `NOUVEAU` `COACHING`

**Champs de saisie :**
- Style underline (pas de border box)
- Label : Raleway uppercase, Pierre `#7A7670`, tracking +20%
- Valeur : Raleway 300, Encre `#1C1A17`

**Barres de progression :**
- Ligne fine, couleur Ambre `#B08050`
- Label uppercase, Raleway 800

---

### Motifs & textures (usage fonds)

Utilisables en arrière-plan uniquement, **jamais au premier plan, jamais sur le logo**.

| Motif | Fond | Usage |
|---|---|---|
| Diagonales | Sombre (Encre) | Slides, covers |
| Pointillé | Clair (Ivoire) | Documents légers |
| Lignes | Sombre (Encre) | Headers, sections |
| Grille | Clair (Ivoire) | Fonds neutres |
| Concentrique | Sombre (Encre) | Visuels hero |
| Croisillon | Ambre | Accents, highlights |

---

### Valeurs de marque

**Tagline principale :** `ÉLÉVATION · MÉTHODE · EXCELLENCE`

**Phrase signature :** *"Progresser avec méthode et ambition."*

**Ton éditorial :**
- Direct, sobre, sans excès
- Phrases courtes, percutantes
- Uppercase pour les concepts clés
- Jamais familier, jamais agressif

**Exemples de formulations correctes :**
- "La progression est une décision quotidienne."
- "Chaque niveau franchit ouvre le suivant."
- "L'excellence est un choix."
- "Montez en compétence."

---

### Application dans Fidelity Up

Fidelity Up est le **produit phare** vendu par les agents 14 Level Up. L'interface doit refléter le positionnement premium de la marque mère.

**Recommandations concrètes pour l'UI :**

| Élément | Application recommandée |
|---|---|
| Fond app (board) | Ivoire `#F4F2EF` ou blanc cassé |
| Header / navbar | Encre `#1C1A17` ou couleur du tenant |
| Boutons primaires | Ambre `#B08050` avec texte blanc uppercase |
| Textes secondaires | Pierre `#7A7670` |
| Badges, tags | Encre `#1C1A17` texte blanc |
| Progress bars fidélité | Ambre `#B08050` |
| Police système | Raleway (à intégrer) ou équivalent système |

> Actuellement l'app utilise Indigo `#6366f1` comme couleur par défaut des tenants. Ce n'est pas la palette 14 Level Up. La couleur du tenant est personnalisable par le commerçant — la charte 14 Level Up s'applique aux éléments de la plateforme elle-même (admin, super admin, pages de marque).

---

## Points d'attention / pièges connus

1. **`NEXT_PUBLIC_APP_URL` sur Vercel** : doit être défini sinon les QR codes pointent vers localhost
2. **AddToWallet ne retourne pas d'install_url** : toujours construire `passgenerator/{cardId}`
3. **QR du commerçant** : pointe vers `/install/{pass.id}` (UUID Supabase, pas l'ID AddToWallet)
4. **QR du client** : contient son numéro de téléphone (pour scan par le commerçant)
5. **Scan caméra** : utilise `jsqr` chargé dynamiquement (no SSR), requiert HTTPS en production
6. **Multi-tenant** : toujours vérifier `activeTenantId` dans localStorage pour le bon commerce
