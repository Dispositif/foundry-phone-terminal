# Phone & Terminal

*Pour les jeux d'enquête de toutes les époques : L'Appel de Cthulhu, Delta Green, Vampire, Blade Runner, Alien.*

Un téléphone pour les personnages, pensé comme un **outil narratif** plutôt que comme une imitation de smartphone. Le MJ est le réseau : il incarne tous les correspondants, décide de l'issue des appels et contrôle la couverture.

- **Un raccourci : Ctrl+Shift+P** ouvre le panneau MJ, ou le téléphone du joueur. Les joueurs ont aussi un bouton flottant.
- **Sans rien configurer**, le MJ peut appeler un joueur ou lui envoyer un message depuis le panneau MJ.
- **Les appareils sont un plus.** Un appareil est un objet dans l'inventaire d'un personnage (téléphone, portable), ou il est installé dans un lieu : fixe ou terminal rattaché à une scène Foundry, utilisé par ceux qui s'y trouvent. Les appareils apportent l'historique, les contacts, les réponses, le partage et les habillages.
- **Un scénario prêt à jouer.** Les liens `@SMS` et `@Call` dans un journal envoient un message ou font sonner un téléphone d'un clic.
- **Les agents communiquent aussi entre eux.** Avec des appareils, les personnages s'appellent et s'envoient des messages directement, sans intervention du MJ, qui reçoit une copie discrète des messages.

Compatible Foundry VTT v13 et v14. Fonctionne avec n'importe quel système de jeu. Interface en français et en anglais.

**Installation** : dans Foundry, **Modules → Installer un module**, puis collez l'URL du manifeste :

```
https://github.com/Dispositif/foundry-phone-terminal/releases/latest/download/module.json
```

Pour essayer sur un monde vierge, lancez dans une macro MJ : `game.modules.get("soren-phone-terminal").api.demo()`.

[English version](README.md)

> **Le MJ doit être connecté.** Son navigateur fait office de réseau : sans MJ en ligne, les joueurs voient « 📱 Pas de réseau téléphonique [MJ absent] ». Ils peuvent relire leurs messages, mais ni écrire ni appeler.

---

## Principes

- **Le MJ est le réseau.** Tout ce qui sort vers un PNJ arrive chez le MJ, qui répond, décroche ou laisse sonner.
- **Pas d'horloge.** Aucune date ni heure n'est jamais affichée, pour ne pas contredire la chronologie de la fiction. L'ordre des messages suffit.
- **Peu de réglages.** Des défauts sensés plutôt que des options.
- **Discrétion.** Seuls les joueurs concernés entendent la sonnerie ou le bip et voient le message.

---

## Appareils

### Sans appareil

Le MJ peut appeler un joueur ou lui envoyer un message (choisir le joueur dans **Destinataire**). L'appel ou le message n'arrive qu'à ce joueur, dans le chat. Ni historique ni réponse : pour que les joueurs puissent répondre et garder une trace, donnez-leur un appareil.

### Un appareil, c'est un objet

- Un **appareil porté** est un objet de l'inventaire d'un personnage. Un **appareil installé** (fixe, terminal) est rattaché à une scène Foundry.
- N'importe quel objet peut devenir un appareil : on le crée depuis le panneau MJ (« Nouvel appareil ») ou on transforme un objet existant.
- Chaque appareil a un **modèle**, un **nom** (« perso », « jetable », « bureau »… ; par défaut le nom du modèle) et un **numéro** (ou une adresse mail pour les ordinateurs).
- Un personnage peut avoir plusieurs appareils.

### Modèles

| Modèle | Porté / installé | Appels | Messages | Pièces jointes | Affiche l'appelant |
|---|---|---|---|---|---|
| **Smartphone** | porté | oui | SMS | oui | oui |
| **Téléphone mobile** (années 90-2000) | porté | oui | SMS texte | non | oui |
| **Ordinateur** (portable) | porté | non | mails | oui | oui |
| **Terminal** | installé dans une scène | non | mails | oui | oui |
| **Téléphone fixe** | installé dans une scène | oui | non | non | non |

- **Mails** : la première ligne fait office d'objet. Les mails fonctionnent même si les SMS sont désactivés dans les réglages.
- **Appareils installés** (fixe, terminal) : rattachés à une scène, ils ne dépendent pas du réseau mobile. Seule leur propre bascule « pas de réseau » les coupe (ligne coupée).
- Chaque modèle a son **habillage** : smartphone sombre et arrondi, écran LCD vert pour le mobile, client de messagerie clair pour l'ordinateur, poste de bureau gris pour le terminal, bakélite et cadran rotatif pour le fixe (compatible années 1920 à 1980).
- Le MJ peut choisir un autre **habillage** par appareil (« Modifier l'appareil »), parmi ceux qui conviennent au modèle :
  - fixe : **Moderne, à touches** (1980-2020 : petit afficheur, clavier) ;
  - autres appareils : **Console texte** (vert phosphore sur noir, texte seul) ou **Sécurisé** (kaki, majuscules, bandeau « Confidentiel défense »).
  - ordinateur et terminal : **Fédéral (FBI)**, poste gouvernemental bleu marine et or, mails présentés en fiches de dossier (référence, tampon « Confidentiel » à la réception), écran de verrouillage « Identification requise ».
- Chaque appareil enregistre son habillage (« default » = celui du modèle). Un habillage retiré ou renommé dans une version future retombe sur celui du modèle.
- La fenêtre d'appel entrant prend l'habillage de l'appareil qui sonne. La vue MJ d'un appareil aussi, avec un liseré orange « Vue MJ · préparation ».

### Qui a l'appareil en main ?

- **Appareil porté** : le joueur dont c'est le personnage assigné ; à défaut, les joueurs propriétaires du personnage. Pensez à assigner son personnage à chaque joueur, sinon un joueur propriétaire de plusieurs PJ verrait les appareils des autres.
- **Appareil installé** : tous les agents dont un jeton est sur la scène ; à défaut, les joueurs qui regardent la scène. L'appareil apparaît et disparaît de leur fenêtre au fil de leurs déplacements.
- **Porté par personne** (objet du monde, ou PNJ) : personne ne décroche. Pratique pour préparer un téléphone à l'avance.

### Changer de main

- **Donner à…** : l'appareil passe à un autre personnage, à un PNJ ou à personne, avec son numéro, ses contacts et son historique (téléphone saisi, téléphone remis par un contact…).
- **Copier l'objet** donne une **SIM clonée** : les deux appareils ont le même numéro et sonnent tous les deux. Le panneau MJ le signale par une icône.

---

## Côté joueur

### Ouvrir le téléphone

- **Ctrl+Shift+P** (raccourci modifiable) ouvre « Mon téléphone » (ou « Mes appareils »).
- Le **bouton flottant** (si activé par le MJ) :
  - toujours visible, déplaçable par glisser, position mémorisée ;
  - pastille rouge avec le nombre de messages non lus ;
  - vibre quand le téléphone sonne ;
  - ouvre le dernier appareil personnel choisi.
- Dans une pièce équipée d'un fixe ou d'un terminal, un **petit bouton de lieu** apparaît sous le téléphone, avec ses propres non-lus. Il vibre quand le fixe sonne, ouvre directement l'appareil de la pièce et disparaît quand l'agent s'en va.
- Avec plusieurs appareils, la fenêtre rouvre sur le **dernier appareil choisi**. S'il n'est plus à portée (pièce quittée, appareil donné), elle revient à un appareil personnel et le signale (« 📍 Terminal n'est plus à portée »).

### Messages

- Liste des conversations par correspondant, la plus récente en premier, avec les non-lus.
- Ouvrir une conversation la marque comme lue.
- **Répondre**, **écrire un nouveau message** ou **appeler** depuis une conversation. Entrée envoie, Maj+Entrée va à la ligne.
- Impossible de répondre ou de rappeler un numéro masqué.
- Bip discret à la réception (son de mail pour les ordinateurs), et copie du message dans le chat, en privé.

### Partager

- **Montrer l'écran** (icône œil, sur un message ou en haut d'une conversation) : l'agent tend son appareil aux agents présents sur la même scène, cochés par défaut. Ils voient l'image, la page de journal (son contenu, sans avoir besoin du droit de lecture) ou la conversation, dans une fenêtre « X vous montre son écran ». Une fois fermée, il ne leur reste rien. Fonctionne sans réseau. Le MJ est prévenu.
- **Transférer** (icône flèche, sur un message) : le message et sa pièce jointe repartent par le réseau vers un contact ou un numéro, comme un vrai message (réseau nécessaire, trace dans l'historique, copie au MJ). Un agent destinataire reçoit automatiquement le droit de lire le journal joint ; un PNJ le reçoit dans la boîte du MJ. Le message porte la mention « Transféré ». Un vieux mobile ne transfère que le texte.

### Appels

- Un appel entrant affiche l'appelant (sauf sur un fixe) avec **Répondre** / **Refuser**. Sons distincts pour la sonnerie (selon le modèle), le décroché et le refus.
- Sans réponse au bout du délai réglé par le MJ : appel manqué.
- Le **téléphone fixe** n'est qu'un cadran rotatif : un clic sur un trou compose le chiffre (le disque tourne), ou on tape le numéro au clavier. Entrée appelle. Ni historique, ni liste d'appels, ni contacts.

### Modes

- Normal, **silencieux** (pas de sonnerie ni de bip) ou **éteint** (appels manqués, messages reçus sans bip).
- Pas de modes sur un appareil installé, puisqu'il est partagé.

### Ce que le joueur voit selon l'état de l'appareil

- **Pas de réseau** (📵) : ni écrire ni appeler. Les messages et appels manqués attendent et arrivent tous au retour du réseau, avec un récapitulatif.
- **Verrouillé** : écran de verrouillage avec le nombre de non-lus. Les messages arrivent avec leur expéditeur, mais leur texte reste masqué. Les appels sonnent normalement.

---

## Communications

### Le MJ vers un agent

- Le MJ fait sonner un appareil ou lui envoie un message, sous l'identité de son choix : un nom de PNJ, un numéro, ou « Numéro masqué ».
- Destinataire : un appareil précis (liste « Appareils »), un numéro, ou un joueur.
- **Pièces jointes** (smartphone, ordinateur, terminal) : une image (📎 ou glisser une tuile) ou une page de journal glissée depuis la barre latérale. Le destinataire reçoit automatiquement le droit de lire le journal joint.

### Un agent vers un PNJ

- **Message** : il arrive dans l'onglet **Messages** du panneau MJ, qui répond dans le fil.
- **Appel** : le MJ entend la sonnerie et choisit l'issue : **Décrocher**, **Messagerie**, **Pas de réponse**, **Injoignable** ou **Numéro non attribué**.

### Entre agents

- Un agent appelle un autre agent : le téléphone de l'autre sonne, sans intervention du MJ.
- Les messages entre agents sont livrés directement, avec une copie discrète au MJ.

### Contacts

- Le carnet se construit en jouant : tout correspondant qui a écrit ou appelé apparaît.
- Le MJ peut donner des contacts à un appareil, une ligne par contact : « Nom | numéro » (numéro facultatif).

---

## Côté MJ

### Le panneau MJ : Réseau (Ctrl+Shift+P)

- Barre du haut : état du réseau, messages en attente, et bascule **Couper le réseau** mobile.
- Onglet **Envoyer** : destinataire (avec l'icône du modèle), expéditeur affiché, puis **Message** ou **Appel**. Seul ce que le destinataire sait faire est proposé (pas de message vers une ligne fixe, pas d'appel vers un terminal). **Envoyer** ou **Faire sonner**, pièce jointe, et **Copier en lien** pour un journal.
- Onglet **Messages** : un fil par agent et par PNJ, en bulles. Réponse directement sous le fil (Entrée envoie), ou rappel de l'agent.
- Onglet **Appareils**, groupés par porteur (portrait du personnage) ou par lieu (vignette de la scène). Un clic sur un appareil le choisit comme destinataire. Pour chacun :
  - icône du modèle, mode, nombre de messages non lus par le joueur ;
  - signalements : numéro cloné, verrouillé, pas de réseau ;
  - actions au survol : ouvrir et préparer l'historique, contacts, verrouiller, pas de réseau, donner à…, modifier, retirer.

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
- Pas besoin de retenir la syntaxe : le bouton 🔗 du panneau MJ copie le lien correspondant à ce qui est saisi.
- Les joueurs ne voient jamais ces boutons, seulement le texte.

---

## Réglages

| Réglage | Portée | Effet |
|---|---|---|
| Volume de la sonnerie et du bip | chaque joueur | |
| Durée de sonnerie avant appel manqué | monde | |
| SMS activés | monde | désactivés pour une époque sans SMS : restent les appels et les mails |
| Bouton flottant | monde | affiche ou masque le bouton des joueurs |
| Raccourci d'ouverture | chaque joueur | Ctrl+Shift+P par défaut |
| Langue du module | monde | Automatique (langue de Foundry de chaque joueur), Français ou English. Recharge la page. Les libellés de l'écran des réglages suivent toujours la langue de Foundry. |

---

## Démo

Pour essayer le module sur un monde vierge, lancer dans une macro (MJ) :

```js
game.modules.get("soren-phone-terminal").api.demo()
```

Cela crée un smartphone pour chaque agent assigné qui n'a pas d'appareil, un téléphone fixe et un terminal sur la scène affichée, et un mobile de PNJ avec un message préparé. Pour tout retirer :

```js
game.modules.get("soren-phone-terminal").api.removeDemo()
```

---

## Mise à jour du module

- Après une mise à jour des fichiers : **Cmd+Shift+R** (Ctrl+Shift+R sous Windows) chez le MJ et chez chaque joueur.
- Relancer le monde seulement si le fichier `module.json` a changé.
- Les données des anciennes versions (Burner Phone `soren-burner-phone`, DG Téléphone `dg-telephone`) sont reprises automatiquement au chargement : appareils, historiques et réglages du monde. Désactivez l'ancien module avant d'activer celui-ci.
