# Phone & Terminal

*Le téléphone et l'ordinateur comme outils narratifs. Le réseau, c'est vous.*

*Pour les jeux d'enquête de toutes les époques : L'Appel de Cthulhu, Delta Green, Vampire, Blade Runner, Alien.*

Un module Foundry VTT qui donne aux personnages des téléphones, des ordinateurs portables et des terminaux installés dans les lieux. Chaque appel ou message vers un PNJ arrive chez le MJ, qui répond, laisse sonner ou décide que le numéro n'existe pas. Pensé pour l'enquête et le jeu narratif, pas comme un simulateur de smartphone.

- **Un raccourci : Ctrl+Shift+P** ouvre le panneau MJ, ou le téléphone du joueur. Les joueurs ont un bouton flottant de téléphone, le MJ un bouton télécom avec le nombre de non-lus.
- **Rien à configurer :** le MJ peut tout de suite appeler un joueur ou lui envoyer un message, depuis le panneau MJ.
- **Les appareils sont un plus.** Un appareil est un objet dans l'inventaire d'un personnage (téléphone, portable), ou il est installé dans un lieu : fixe ou terminal rattaché à une scène Foundry, utilisé par ceux qui s'y trouvent. Les appareils apportent l'historique, les contacts, les réponses, le partage et les habillages.
- **Les agents communiquent aussi entre eux.** Avec des appareils, les personnages s'appellent et s'envoient des messages directement, sans intervention du MJ, qui reçoit une copie discrète des messages.
- Foundry VTT v13 et v14. N'importe quel système de jeu.
- Interface en français et en anglais.
- **URL du manifeste :** `https://github.com/Dispositif/foundry-phone-terminal/releases/latest/download/module.json`

![Vue joueur](docs/player.png)

> **Le MJ doit être connecté.** Son navigateur fait office de réseau : sans MJ en ligne, les joueurs voient « Pas de réseau téléphonique [MJ absent] ». Ils peuvent relire leurs messages, mais ni écrire ni appeler.

[English version](README.md)

---

## Principes

- **Le MJ est le réseau.** Tout ce qui sort vers un PNJ arrive chez le MJ, qui répond, décroche ou laisse sonner.
- **Pas d'horloge.** Aucune date ni heure n'est jamais affichée, pour ne pas contredire la chronologie de la fiction. L'ordre des messages suffit.
- **Peu de réglages.** Des défauts sensés plutôt que des options.
- **Discrétion.** Seuls les joueurs concernés entendent la sonnerie ou le bip et voient le message.

## Idées pour votre table

- **Un contact qui rappelle**, ou ne rappelle jamais.
- **Un terminal dans une pièce.** Quiconque s'y trouve lit son courrier. Joignez des pages de journal pour simuler des fichiers : archives, journaux système, rapports d'enquête.
- **Un piratage, un téléphone volé.** Verrouillez un appareil, déverrouillez-le quand le jet réussit. Remettez-le à un autre personnage avec tout son historique.
- **Un scénario prêt à jouer.** Les liens `@SMS` et `@Call` dans un journal envoient un message ou font sonner un téléphone d'un clic.
- **Un dossier à distance.** Un terminal dans la barre latérale Objets, avec le droit de lecture « Observateur » à plusieurs joueurs : ils consultent son courrier de n'importe où, comme une base de données sécurisée du FBI. Joignez des pages de journal en guise de fichiers.
- **Un indice préparé.** Écrivez à l'avance l'historique d'un appareil : messages, photos, appels manqués.
- **Montrer plutôt que raconter.** Un joueur montre son écran aux agents dans la même pièce, ou transfère la photo.

---

## Installation

Dans Foundry : **Modules → Installer un module**, puis collez l'URL du manifeste :

```
https://github.com/Dispositif/foundry-phone-terminal/releases/latest/download/module.json
```

Activez **Phone & Terminal** dans votre monde. Pour essayer sur un monde vierge, lancez dans une macro MJ :

```js
game.modules.get("soren-phone-terminal").api.demo()
```

Cela crée un smartphone pour chaque personnage assigné sans appareil, un téléphone fixe et un terminal sur la scène affichée, et un mobile de PNJ avec un message préparé. Pour tout retirer :

```js
game.modules.get("soren-phone-terminal").api.removeDemo()
```

---

## Appareils

### Sans appareil

Le MJ peut appeler un joueur ou lui envoyer un message (choisir le joueur dans **Destinataire**). L'appel ou le message n'arrive qu'à ce joueur, dans le chat. Ni historique ni réponse : pour que les joueurs puissent répondre et garder une trace, donnez-leur un appareil.

### Un appareil, c'est un objet

- Un **appareil porté** est un objet de l'inventaire d'un personnage. Un **appareil installé** (fixe, terminal) est rattaché à une scène Foundry.
- On crée un appareil depuis le panneau MJ (« Nouvel appareil »).
- Chaque appareil a un **modèle**, un **nom** (« perso », « jetable », « bureau »… ; par défaut le nom du modèle ; c'est aussi le nom de l'objet) et un **numéro** (ou une adresse mail pour les ordinateurs).
- Un personnage peut avoir plusieurs appareils.
- Un clic sur un objet-appareil ouvre l'appareil lui-même. Le MJ retrouve la fiche d'objet du système depuis la vue de l'appareil.
- L'objet prend l'icône du modèle et une courte description (modèle et numéro), sauf si vous en avez choisi d'autres.

### Modèles

| Modèle | Porté / installé | Appels | Messages | Pièces jointes | Affiche l'appelant |
|---|---|---|---|---|---|
| **Smartphone** | porté | oui | SMS | oui | oui |
| **Téléphone mobile** (années 90-2000) | porté | oui | SMS texte | non | oui |
| **Ordinateur** (portable) | porté | non | mails | oui | oui |
| **Terminal** | installé dans une scène | non | mails | oui | oui |
| **Téléphone fixe** | installé dans une scène | oui | non | non | non |

- **Mails** : la première ligne fait office d'objet. Les mails fonctionnent même si les SMS sont désactivés dans les réglages.
- **Appareils installés** (fixe, terminal) : rattachés à une scène, ils ne dépendent pas du réseau mobile et ont toujours la ligne.

### Habillages

![Habillages](docs/skins.png)

- Chaque modèle a son habillage : smartphone sombre et arrondi, écran LCD vert pour le mobile, client de messagerie clair pour l'ordinateur, poste de bureau gris pour le terminal, téléphone à touches pour le fixe (1980-2020 : petit afficheur, clavier).
- Le MJ peut choisir un autre habillage par appareil (**Modifier l'appareil**), parmi ceux qui conviennent au modèle :
  - fixe : **Vintage, cadran rotatif** (1920-1980 : bakélite noire) ;
  - téléphones et ordinateurs : **Console texte** (vert phosphore sur noir, texte seul) ou **Sécurisé (militaire)** (kaki, majuscules, bandeau « Confidentiel défense ») ;
  - ordinateur et terminal : **Fédéral (FBI)**, poste gouvernemental bleu marine et or, mails présentés en fiches de dossier (référence, tampon « Confidentiel »), écran de verrouillage « Identification requise ».
- Chaque appareil enregistre son habillage (« default » = celui du modèle). Un habillage retiré ou renommé dans une version future retombe sur celui du modèle.
- Chaque appareil est dessiné comme le vrai autour de son écran : smartphone, vieux mobile avec clavier décoratif, ordinateur portable, écran de terminal (un CRT pour les habillages Console et Militaire), poste de bureau ou téléphone à cadran en bakélite. La barre de titre Foundry laisse place à deux boutons discrets sur le bord haut (menu, fermer) ; on déplace la fenêtre par là. La vue MJ a le même cadre.
- La fenêtre d'appel entrant prend l'habillage de l'appareil qui sonne. La vue MJ d'un appareil aussi, avec un liseré orange « Vue MJ · préparation ».

### Qui a l'appareil en main ?

- **Appareil porté** : le joueur dont c'est le personnage assigné ; à défaut, les joueurs propriétaires du personnage. Pensez à assigner son personnage à chaque joueur, sinon un joueur propriétaire de plusieurs PJ verrait les appareils des autres.
- **Appareil installé** : tous les agents dont un jeton est sur la scène ; à défaut, les joueurs qui regardent la scène. L'appareil apparaît et disparaît de leur fenêtre au fil de leurs déplacements.
- **Accès partagé** : un appareil de la barre latérale Objets est entre les mains des joueurs à qui vous le donnez (Observateur ou Propriétaire), où qu'ils soient. S'il est installé, il reste aussi utilisable sur sa scène.
- **Porté par personne** (objet du monde donné à personne, ou PNJ) : personne ne décroche. Pratique pour préparer un téléphone à l'avance.
- **Fixe dans une pièce vide** : l'appel d'un agent sonne chez le MJ (« Appel vers un fixe vide », avec le lieu), qui répond pour qui se trouve là.

### Changer de main

- **Donner à…** : l'appareil passe à un autre personnage, à un PNJ ou à personne, avec son numéro, ses contacts et son historique (téléphone saisi, téléphone remis par un contact…).
- **Glisser l'objet** sur un autre personnage fait de même : un appareil porté n'existe qu'en un exemplaire. Le dupliquer sur place donne un nouvel appareil, avec son propre numéro.

---

## Côté joueur

### Ouvrir le téléphone

- **Ctrl+Shift+P** (raccourci modifiable) ouvre « Mon téléphone » (ou « Mes appareils »).
- Le **bouton flottant** (si activé par le MJ) :
  - toujours visible, déplaçable par glisser, position mémorisée ;
  - pastille rouge avec le nombre de messages non lus ;
  - vibre quand le téléphone sonne ;
  - ouvre le dernier appareil personnel choisi.
- Dans une pièce équipée d'un fixe ou d'un terminal, un **petit bouton de lieu** apparaît sous le téléphone, avec ses propres non-lus. Il vibre quand le fixe sonne, ouvre directement l'appareil de la pièce et disparaît quand l'agent s'en va. Un appareil partagé utilisé à distance n'a pas de bouton : on l'ouvre avec Ctrl+Shift+P ou depuis la barre latérale Objets.
- Avec plusieurs appareils, la fenêtre rouvre sur le **dernier appareil choisi**. S'il n'est plus à portée (pièce quittée, appareil donné), elle revient à un appareil personnel et le signale.

### Messages

- Liste des conversations par correspondant, la plus récente en premier, avec les non-lus.
- Ouvrir une conversation la marque comme lue.
- **Répondre**, **écrire un nouveau message** ou **appeler** depuis une conversation. Entrée envoie, Maj+Entrée va à la ligne.
- Impossible de répondre ou de rappeler un numéro masqué.
- Bip discret à la réception (son de mail pour les ordinateurs), et copie du message dans le chat, en privé.

### Partager

- **Montrer l'écran** (icône œil, sur un message ou en haut d'une conversation) : l'agent tend son appareil aux agents présents sur la même scène, cochés par défaut. Ils voient l'image, la page de journal (son contenu, sans avoir besoin du droit de lecture) ou la conversation, dans une fenêtre « X vous montre son écran ». Une fois fermée, il ne leur reste rien. Fonctionne sans réseau. Le MJ est prévenu.
- **Transférer** (icône flèche, sur un message) : le message et sa pièce jointe repartent par le réseau vers un contact ou un numéro, comme un vrai message (réseau nécessaire, trace dans l'historique, copie au MJ). Un agent destinataire reçoit automatiquement le droit de lire le journal joint ; un PNJ le reçoit dans l'onglet **Messages** du panneau MJ. Le message porte la mention « Transféré ». Un vieux mobile ne transfère que le texte.

### Appels

- Un appel entrant affiche l'appelant avec **Répondre** / **Refuser** ; un fixe Moderne n'affiche qu'un numéro, un Vintage rien. Sons distincts pour la sonnerie (selon le modèle), le décroché et le refus.
- Quand le téléphone d'un agent sonne (mode sonnerie), tous les autres joueurs l'entendent plus doucement, avec une petite notification (« Le téléphone de Reyes sonne »). La narration avant le réalisme : toute la table le sait.
- Quand un agent passe un appel, il entend la tonalité d'appel ; tous les autres joueurs l'entendent aussi, plus doucement, avec une notification (« Reyes a l'oreille sur son téléphone »). Entre deux agents, tout le monde entend seulement la sonnerie.
- Sans réponse au bout du délai réglé par le MJ : appel manqué.
- Le **téléphone fixe** n'est qu'un clavier (ou un cadran rotatif en Vintage) : un clic compose le chiffre (en Vintage, le disque tourne), ou on tape le numéro au clavier. Entrée appelle. Ni historique, ni liste d'appels, ni contacts.

### Modes

- Normal, **silencieux** (pas de sonnerie ni de bip ; un appel entrant vibre seulement chez son porteur) ou **éteint** (appels manqués, messages reçus sans bip ; l'écran reste noir, avec un bouton **Allumer**).
- Ordinateurs et terminaux n'ont pas de modes : ils sont toujours allumés.
- Pas de modes sur un appareil installé, puisqu'il est partagé.

### Ce que le joueur voit selon l'état de l'appareil

- **Pas de réseau** : ni écrire ni appeler. Les messages et appels manqués attendent et arrivent tous au retour du réseau, avec un récapitulatif.
- **Verrouillé** : écran de verrouillage avec le nombre de non-lus. Les messages arrivent avec leur expéditeur, mais leur texte reste masqué. Les appels sonnent normalement.

---

## Communications

### Le MJ vers un agent

- Le MJ fait sonner un appareil ou lui envoie un message, sous l'identité de son choix : un nom de PNJ, un numéro, ou « Numéro masqué ».
- Destinataire : un appareil précis (liste « Appareils »), un numéro, ou un joueur.
- **Pièces jointes** (smartphone, ordinateur, terminal) : une image (trombone, ou glisser une tuile) ou une page de journal glissée depuis la barre latérale. Le destinataire reçoit automatiquement le droit de lire le journal joint.

### Un agent vers un PNJ

- **Message** : il arrive dans l'onglet **Messages** du panneau MJ, qui répond dans le fil.
- **Appel** : le MJ entend la sonnerie et choisit l'issue : **Décrocher**, **Messagerie**, **Pas de réponse**, **Injoignable** ou **Numéro non attribué**.

### Entre agents

- Un agent appelle un autre agent : le téléphone de l'autre sonne, sans intervention du MJ.
- Les messages entre agents sont livrés directement, avec une copie discrète au MJ.

### Contacts

- Le carnet se construit en jouant : tout correspondant qui a écrit ou appelé apparaît.
- Le MJ peut donner des contacts à un appareil, une ligne par contact : `Nom | numéro` (numéro facultatif).
- Le joueur modifie le carnet d'un appareil personnel qu'il a en main (icône carnet), et nomme un correspondant inconnu depuis la conversation (icône personnage). Fixes, terminaux et appareils partagés restent entre les mains du MJ.
- Les numéros sont comparés sans tirets, espaces, points ni parenthèses : `555-0133` est `5550133`.

---

## Côté MJ

![Panneau MJ](docs/gm.png)

### Le panneau MJ : Réseau (Ctrl+Shift+P)

- Le **bouton flottant télécom** du MJ l'ouvre (sur **Messages** s'il y a des messages d'agents non lus) et affiche leur nombre. Il a son propre réglage.
- Barre du haut : état du réseau, messages en attente, et bascule **Couper le réseau** mobile.
- Onglet **Envoyer** : destinataire (avec l'icône du modèle), expéditeur affiché (texte libre, numéro masqué si vide, avec suggestions : contacts du destinataire, expéditeurs récents, numéros des autres appareils), puis **Message** ou **Appel**. Seul ce que le destinataire sait faire est proposé (pas de message vers une ligne fixe, pas d'appel vers un terminal). **Envoyer** ou **Faire sonner**, pièce jointe, et **Copier en lien** pour un journal.
- Onglet **Messages** : un fil par agent et par PNJ, en bulles. Réponse directement sous le fil (Entrée envoie), ou rappel de l'agent.
- Onglet **Appareils**, groupés par porteur (portrait du personnage) ou par lieu (vignette de la scène). Un clic sur un appareil le choisit comme destinataire. Pour chacun :
  - icône du modèle, mode, nombre de messages non lus par le joueur ;
  - signalements : numéro partagé, verrouillé, pas de réseau ;
  - actions au survol : ouvrir et préparer l'historique, contacts, verrouiller, pas de réseau et donner à… (appareils portés), modifier, retirer (supprime l'objet, ou le garde comme objet ordinaire).

### Annuaire PNJ

- Bouton **Annuaire** (onglet Appareils du panneau MJ) : un PNJ par ligne, comme les contacts. Les lignes commençant par `#` sont des titres.

  ```
  # Scénario
  Marlin Hunt | 555-0242
  # Public
  Pizza Delta | 555-0202 | public
  ```
- Il démarre avec un exemple à La Nouvelle-Orléans. Une fois modifié, il est enregistré dans votre monde et les mises à jour du module n'y touchent jamais.
- Astuce : ajoutez les numéros des agents avec `| public` (`Agent Reyes | 555-0142 | public`) : ils connaissent ainsi tous le numéro des autres dès le départ.
- Gardez les numéros d'annuaire en **555-02xx** : un nouvel appareil ne reçoit jamais de numéro dans cette plage. Le préfixe **555-** se change dans les réglages du module (par ex. `504-555-`) ; la plage réservée le suit.
- Pour le MJ : les PNJ de l'annuaire arrivent en tête des suggestions d'expéditeur, et leur nom s'affiche dans l'onglet Messages et la fenêtre d'appel. Un numéro inconnu partout est signalé « numéro inconnu ».
- Un PNJ secret le reste : l'agent voit son numéro, sauf s'il l'a dans ses contacts.
- Les numéros `public` sont les pages jaunes : les agents les trouvent par leur nom en écrivant ou en composant, et voient leur nom.

### Préparer un appareil

- Le MJ ouvre n'importe quel appareil, même porté par un PNJ ou par personne.
- Il écrit son historique (SMS ou mails reçus et envoyés, appels reçus, émis, manqués), pièces jointes comprises, sans rien envoyer ni notifier personne.
- Il peut effacer un message ou un appel.

### Accusé de lecture

- Dans la vue MJ d'un appareil, chaque message reçu indique **Vu**, **Non lu** ou **En attente** (pas encore livré, faute de réseau).
- Les joueurs ne voient pas ces indications.

### Liens dans les journaux

- Dans les notes de scénario, `@SMS[destinataire|expéditeur]{texte}` et `@Call[destinataire|expéditeur]` deviennent des boutons : un clic envoie le message ou fait sonner l'appareil.
- Le destinataire peut être un numéro, un nom de personnage ou de joueur ; l'expéditeur est facultatif. Pièces jointes possibles (`img:` ou `doc:`).
- Pas besoin de retenir la syntaxe : le bouton lien du panneau MJ copie le lien correspondant à ce qui est saisi.
- Les joueurs ne voient jamais ces boutons, seulement le texte.
