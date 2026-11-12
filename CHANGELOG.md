# Changelog

## 1.0.0
- **First public release** on the Foundry package list. Same features as 0.41.0, tested in Foundry.
- README: a picture of the six device models.

## 0.41.0
- **GM panel, Files tab**: every file of every laptop and terminal in one list. Each file has a three-way switch, **Visible / Locked / Hidden**, and a click on its name previews it. Filters by state with their counts, and a search box.
- Two groupings: **by computer** (with the device lock, the mailbox (click to cycle Mail, Mail locked, No mail) and its GM view), or **by source journal**, handy with one journal per scenario: each row names its computer, and **Show all** / **Hide all** switch a whole journal at once. Images and files whose journal was deleted get their own groups.
- **Emails carrying a journal page** are listed too, with an @ and their correspondent. Their access follows the mailbox (shown, not switched per email).
- **Calls tab** grouped by real time: **Last hour of play**, **Last 24 hours**, **Before** (calls in progress go with the last hour).
- The GM panel opens a little wider (580 px) for its six tabs, with an opaque background for easier reading over the map.

## 0.40.0
- **Floating button on the line**: while an agent is on a call, the button of the device in use turns green with the call's timer under it; a click goes back to the call (device screen, or the landline in the room).
- **Switched-off device**: the player's button is greyed; a click still opens the dark screen and its power button.
- **GM button orange** while an agent is calling you (it shakes); a click brings the incoming call window back to the front instead of opening the panel.
- **Installed devices without a location**: a terminal or landline can have no scene ("No location (network access)", last choice of the place in New device; empty place in Edit device). Shared from the Items sidebar (Observer), it is reached from anywhere, like a case-file database several agents consult: each sharing player gets a small button for it under their phone. GM panel: grouped under "No location". A place name that matches no scene is still refused.
- **Layout**: near the bottom of the screen, the room buttons line up to the right of the main button instead of stacking down (players and GM). It follows the button when you move it.

## 0.39.0
- **Files on computers.** Laptops and terminals get two tabs, **Mail** and **Files**. The GM drops journal pages or images into the Files tab of the device (GM view), or adds an image with the image button; nothing is notified. Players see a plain list (icon, name, Document or Image) and open a file **inside the screen**: the journal's text and images (secret blocks hidden), never the Foundry journal sheet, and no read permission is needed (the GM's browser renders the content). On hover: Show the screen and Forward.
- Per file, in the GM view: **Lock** (listed with a padlock, "Access denied" when opened), **Hide** (not listed for the players until revealed), Rename and Delete.
- **Journals in messages open on the device.** A journal page attached to a text or an email shows as a card in the bubble; it opens inside the screen (text and images, secrets hidden), with back to the conversation, Show the screen and Forward. The GM's browser renders it, so **players no longer get Foundry read permission** on attached journals: the document only lives on the device (permissions given before stay).
- **Enlarge** (expand icon) on an opened file or document: the same large, resizable reader as Show the screen, for oneself. Handy on a smartphone.
- A shown document opens large (760 px, 85 % of the height, 16 px text) and resizes with its window.
- Drops are checked, on a message or a computer's files, with a clear warning for each case: a whole journal (drag one page instead), a page a device cannot show (PDF, video: use a text or image page), a video, or another kind of document (actor, scene…).
- GM panel, Send tab: a short hint under the message says a journal page or an image can be dropped on it.
- **GM floating button**: under the telecom button, a small button per landline or terminal installed on the scene you are viewing (with the count of agents' unread messages). One click opens its GM view. They follow the scene.
- **Mailbox** setting per computer (Edit device): Available, **Locked** (the tab shows "Access restricted"; no badge, no writing) or **None** (files only, no tabs). The GM always sees the mailbox.

## 0.38.0
- **Call in progress window.** Once a call is answered, a black window opens in the middle of every screen, with a running timer (MM:SS) since the answer. The rest of the table sees the agent's portrait (character sheet) and the other end: both portraits between two agents, a silhouette named "Unknown" for an NPC; the window's cross closes it. The agent on the line sees only the other end, as their device names it (contact or number), with a **Hang up** button. The GM sees both ends, hangs up for an NPC, and has **Cut the line** (skull) to cut any call: network failure, dead zone, an enemy who controls the network.
- As soon as an agent dials, the rest of the table gets the window with "Calling…": the agent's portrait and an unknown end. It turns into the call when someone answers, and closes if nobody does.
- While it rings, the window replaces the old notices: the rest of the table sees the agent who dials ("Calling…"), then the portrait of the agent whose phone rings ("The phone is ringing…", not in silent mode); an agent called by an NPC shows with an unknown caller. The GM calling as an NPC gets the window too, with the NPC and the agent called, and can hang up. The notices "X has their ear to the phone", "X's phone is ringing", "Calling…" and "X answered" are gone.
- **Nothing in the chat any more**: the GM's copies of messages between agents, of messages to NPCs, of call results and of shared screens are removed (the GM panel and its notices cover them).
- The **Messages** tab has two sub-tabs: **NPCs** (as before, you answer) and **Between PCs** (the agents' conversations, one per pair, read only: no reply, no badge).
- **One call at a time**: while a call rings or is in progress, anyone else who dials (agent or GM) gets "Network busy" (red signal icon on the device; a notice for the GM). Logged as such in the history and the Calls tab.
- Calls in progress **survive a reload** (player or GM): the device screen or the window comes back with the hang-up button, and every timer runs on the server clock, so they all agree. A call more than an hour old is forgotten.
- While a phone rings, a soft halo pulses around the portrait of the agent called (call window, and the caller's portrait on a ringing smartphone).
- The GM's call window shows "Compromised device" under an agent whose device is compromised.
- **Missed calls** count as unread: badge on the floating button and on the conversation, until the agent opens it.
- The rest of the table hears the hang-up softer (70 %), like a phone ringing nearby.
- **Tracking** tab: under each agent, their last call in the past 30 minutes (table time), on a device they carry: "12 min ago · → Marlin Hunt · 02:47" (or the outcome, or "On the line"). A trace on the network.
- **End of call**: everyone hears the hang-up sound, and the window shows "Call ended" with the stopped timer for 10 seconds (a click closes it sooner). On a smartphone or mobile, a close key hides it right away.
- The caller no longer gets a "X picked up" notice, nor the spectators' window: their own device shows the call. A line cut by the GM looks exactly like a hang-up to the players; only the GM sees "Line cut".
- **Calls tab** in the GM panel: every call, answered or not, agents' calls between themselves included, most recent first (40 lines): who called whom, the outcome and, once hung up, the duration. A call in progress shows "On the line" with its running timer. The two ends of a call make one line (calls made before this version stay one line per device).
- Answer buttons are green, decline and hang-up buttons red, in the ringing windows, on the device screens (the device's look no longer greys them out) and on the landlines.
- On a **smartphone**, an incoming call from another agent who is in the contacts shows their portrait on the ringing screen.
- On a **smartphone** or a **mobile**, an outgoing call shows on the device itself while it rings ("Calling…", who is called, a hang-up key; on a smartphone, the portrait of the agent called if they are in the contacts, otherwise an empty portrait) instead of a window; closing the device hangs up.
- On a **smartphone**, the call shows on the device itself instead of the window: status and timer, the other end's portrait, name and number, and a hang-up key. If the agent closes their smartphone during the call, the call window opens, so they do not forget they are still on the line. The mobile does the same, without the portrait. The landlines show "On the line" with a hang-up key, next to the window.

## 0.37.0
- **Messages and calls sent to a player** (not to a device) now land on their character's phone instead of a popup window: the smartphone they carry, otherwise their mobile; if they carry none, one is created with the model of the new **Default device** setting (smartphone or mobile, default look). The message gets a history, the floating button badge and the in-device call screen like any other. The popup window is gone.
- In the GM panel recipients, **Players (direct)** now come first, and only players with an assigned character are listed; a direct send to a player without a character is refused with a warning.
- In the recipients, online players come before offline ones.
- README and catalogue description mention the automatic device creation.

## 0.36.0
- **New device in two steps.** Step 1: big tiles with the device icon and what it does, carried devices (smartphone, mobile, pager, laptop) then installed ones (modern landline, rotary landline, terminal). Step 2: a short form for that model: the agents' portraits to pick the holder in one click (or an NPC, or nobody), the place for an installed device (current scene first), a name that follows the holder ("Smartphone de Gomez"), a random number with a dice to draw another, and the looks only when there is a choice. "Create and open" opens the GM view of the new device right away. Editing a device keeps the full form.

## 0.35.0
- **Dead zones**: a "Dead zone" checkbox in the scene configuration (Basics tab). While an agent's player is on such a scene (token or not), the devices that agent carries have no mobile network and no Wi-Fi: messages wait, calls fail as unreachable. Back on another scene, what was waiting arrives. Landlines and terminals keep their line. The Tracking tab shows the agent as "Dead zone".

## 0.34.1
- Fixed: **Cancel** in the GM's text dialogs saved the word "cancel": the NPC directory and a device's contacts were replaced by it, and a new or edited device, a hand-over or a forward could go through with it. Cancel now changes nothing.

## 0.34.0
- **Compromised devices** (GM only): a warning toggle on each device in the GM panel marks a device as compromised (tapped, known to the enemy…). The mark shows in the devices list, the Tracking tab, the Messages tab and the GM's incoming call window, and the GM gets a warning when a compromised device calls or texts another agent or is called or texted by one. Players never see it.

## 0.33.1
- GM side (incoming call from an agent, messages tab): a number from the NPC directory shows the directory name, even when the agent saved it under another name in their contacts.
- GM messages and calls sent under an NPC directory name (public or not) now arrive as that NPC's number: the agent sees their own contact name for it, in the same conversation.

## 0.33.0
- New GM panel tab: **Tracking** (experimental feature). One group per agent: the best precision, and the devices the network can locate (carried, switched on, with signal): high for a smartphone (GPS) or a laptop (Wi-Fi), medium for a mobile (GSM), low for a pager (GSM). Terminals and landlines do not count. An agent with nothing locatable is listed with precision none and location unknown. A quick way to judge how exposed the agents are to an enemy with access to the network.

## 0.32.1
- **Rotary landline**: no device menu any more, only its number on a paper label stuck on the set. The GM view is the same as the players' (it has no contacts, history, caller display, ring modes or power button); the GM cannot dial from it.
- **Incoming calls show on the device itself** instead of a separate window, on the smartphone, the mobile (caller, green and red keys) and the modern landline (caller's number on the display when it is a number, Answer and Hang up keys). The device opens, or comes forward, on the ringing device; a phone can be answered even when locked. The rotary landline and computers keep the incoming call window.
- GM panel, Send tab: the recipients list shows the agents' devices first, then the other carried devices, then the fixed ones.
- **Players get no Foundry notifications any more**, except the table cues: another agent's phone is ringing, another agent is on the phone. Call results, errors (no signal, locked, switched off) and share/forward feedback now show as a short banner on the device screen. The missed call notice is gone (the call is in the device history).
- No more "signal back" notice for players when the network (global or per device) comes back: they check the signal on their device. Waiting messages still beep on arrival, and a pager still opens.
- **Nothing in the players' chat any more**: messages and emails are read only on the devices (beep, floating button badge, device window). A message the GM sends to a player without a device opens in a small phone-styled window. The GM still gets the copies of agent-to-agent messages and the call reports.
- A switched-off device (phone, pager) no longer shows incoming messages in its holder's chat: they wait, like without signal, and arrive (beep, pager window) when it is switched back on. Calls missed while off are reported at that moment too.

## 0.32.0
- New device: **Pager** (1980s-1990s). One line of 12 characters sent by the GM (a number to call back, a code, a word); longer text is cut. It beeps, or buzzes in silent mode, and opens by itself in its own small window next to the phone. ◀ ▶ browse the history; the red light blinks until a key is pressed. No calls; an agent writing to a pager number reaches the GM.
- Removed the **Text messages** world setting: texting is always available on phones that support it (smartphone, old mobile). Emails were never affected.

## 0.30.0
- Module renamed **Phones & Computers**, new id `soren-phones-computers` (was `soren-phone-terminal`). Same manifest URL, but Foundry sees a new module: install it, enable it instead of the old one, reload the world, then uninstall the old one. Devices, histories, contacts, settings and the NPC directory are migrated automatically.
- GitHub repository renamed `foundry-phones-computers`; old links redirect.
- After the migration, the GM sees a one-time window: what was recovered, and to disable then uninstall the old module (it warns again on each load while the old module is still enabled). A fresh install never shows it.
- The migration now moves every module flag and setting (it used to skip the newer settings, such as the directory), the device sheet choice and the model icons.

## 0.29.0
- **Device frames**: every device is drawn around its screen, without the Foundry title bar: smartphone, old mobile (decorative keypad), laptop, terminal (office monitor, or a CRT for the Console and Military looks, olive for Military), modern desk phone and black bakelite rotary phone (handset and coiled cord). The menu and close buttons stay, discreet, on the top edge, and the window still drags from there. The GM view gets the frame too, with its orange line.

## 0.28.0
- **NPC directory** (GM panel, Devices tab, **Directory** button): one NPC per line, `Name | number`, `#` lines as section titles, easy to paste. Directory NPCs come first in the sender suggestions; the GM sees their names in Messages and in the incoming call window, and a number known nowhere is flagged "unknown number".
- Secret NPCs stay secret: a message sent as a directory NPC shows its number on the agent's side, unless the agent has it in their contacts.
- `| public` entries (pizzeria, station…) are the yellow pages: agents find them by name when writing or dialing (landline too), and see their name.
- Directory and contacts windows are resizable; the text area follows the window size.
- The directory starts with a New Orleans sample (a handler, the cell's dead drop, two scenario numbers, public places) and a tip: list the agents' own numbers as public so they know each other. Once the GM edits it, it is stored in the world: module updates never overwrite it.
- Directory numbers use 555-02xx: new devices never get a 555-02xx number, nor one already used by a device or the directory.
- Player phone: the "New message" button becomes **Call / Message** (phone and message icons) on devices that can do both.
- New setting **Phone number prefix** (555- by default) for the numbers given to new devices; <prefix>02xx stays reserved for the directory.

## 0.27.0
- A **Modern** landline shows the caller's number when it is one (digits). Names and hidden numbers still just ring.
- An agent calling a landline in an empty room (nobody on its scene) now rings the GM, who answers for whoever is there, like a call to an NPC.
- When an agent's phone rings (ring mode), every other player hears it, softer, with a small notice: "Reyes's phone is ringing". It stops when the call is answered, declined or ends.
- Silent mode: an incoming call now buzzes (vibration sound) for the agent who holds the phone; nobody else hears it.
- Outgoing calls: the caller hears a ringback tone until the call is answered or ends. Every other player hears it too, softer, with a notice: "Reyes has an ear to the phone". In a call between agents, everyone (caller included) hears only the ringing phone.
- A switched-off device shows a dark "Off" screen to the player (no conversations, contacts or calls), with a **Switch on** button.
- GM floating button (telecom icon) with the number of unread agents' messages; click opens the Network panel (on Messages when something is unread). Own setting: "Floating button for the GM".
- Laptops show a Wi-Fi icon instead of the mobile signal bars. Without network (cut, no signal, GM away), the bars or Wi-Fi icon turn red instead of the crossed-out phone emoji; with network they are green.
- Laptops and terminals have no ring mode (silent, off): they are always on.
- Default ring duration is now 60 seconds (was 30).
- Fix: GM panel, Devices: a locked device no longer shows two lock icons on hover (clicking the first one sent you to the Send tab).

## 0.26.0
- GM panel: installed devices (landline, terminal) no longer have a "no signal" toggle, and players no longer see a signal icon on them; they always have a line.
- GM panel, Send tab: the displayed sender suggests a hidden number, the recipient's contacts, recent senders and other devices' numbers. Still free text; empty means hidden number.
- GM panel: the "Mark an item" button is gone. Create devices with **New device**.

## 0.25.0
- Players edit the address book of a personal device they hold, and name an unknown correspondent from the conversation ("Add to contacts"). Landlines, terminals and shared devices stay GM-only.
- Floating button: a room button only shows for an installed device on the agent's current scene. A shared terminal used from afar opens with Ctrl+Shift+P or from the Items sidebar.
- Device and item share one name: renaming one renames the other. Marking an item keeps its name unless you type another.
- Changing a device's model also changes the item image to the model's icon.
- New landlines use the **Modern** keypad look. The rotary dial becomes the **Vintage** look; existing landlines keep their rotary dial.
- Shared access: a device in the Items sidebar is held by the players given Observer or Owner permission, wherever they are (remote terminal, case file).
- A locked terminal shows an inactive login form, whatever its look.
- Fix: release zip now includes the templates and icons folders (GM panel, item icons).

## 0.24.0
- Clicking a device item opens the device itself (the phone for the player, the GM view for the GM) instead of an empty item sheet. The GM reaches the system's item sheet from the device view.
- Device items get an icon per model (smartphone, mobile, laptop, terminal, landline), unless the GM chose another image.
- Device name and item name stay in step: renaming one renames the other, as long as both still had the same name.
- Removing a device from the GM panel deletes its item. "Keep the item" only removes the device function.
- New laptops and terminals get a random email address (user33@mail.net) instead of a phone number.
- Dragging a carried device onto another character hands it over with its history, instead of making a copy with the same number. Duplicating it in place gives a new device with its own number. Installed devices are unchanged.
- The item description shows the model and number ("Smartphone · 555-0142"), unless the GM wrote one.
- Fix: the GM inbox styles no longer leak into the player's conversation view.
- Fix: with a look, the window title bar buttons (controls, close) showed empty boxes instead of their icons.

## 0.23.0
- GM **Messages** tab shows one thread per agent and NPC, as chat bubbles: the agent on the left, the NPC's replies on the right.
- Reply inline under each thread (Enter sends), or call the agent back.
- Send tab only offers what the recipient can do: no Message choice for a landline, no Call choice for a laptop or terminal.
- Fix: the GM panel tabs did nothing (name clash with Foundry's own tab action).

## 0.22.0
- GM panel renamed **Network**, with a cell tower icon. Players' scene control button uses a phone icon.
- GM panel rebuilt with three tabs: **Send**, **Messages**, **Devices**.
- Send tab: Message / Call toggle.
- Devices grouped by holder (character portrait) or place (scene thumbnail). Row actions appear on hover.
- GM panel moved to a Handlebars template. Accessibility labels on icon buttons.

## 0.21.0
- **Federal (FBI)** look for laptop and terminal.
- Dashes, spaces, dots and brackets ignored in numbers.
- Repository, MIT licence, English README, release workflow.

## 0.20.0
- Every device stores its look ("default" falls back to the model's look).
- **Modern, keypad** landline (1980-2020).

## 0.19.0
- Landline in black Bakelite with a rotary dial. Terminal look.
- Optional looks: **Text console**, **Secure (military)**.
- Incoming call window and GM view use the device's look.

## 0.18.0
- Grouped re-renders, demo (`api.demo()` / `api.removeDemo()`), CSS variables.

## 0.17.0
- Code split into ES modules. English and French language files. Module language setting.

## 0.16.0
- Renamed **Phone & Terminal** (`soren-phone-terminal`). Data from Burner Phone and `dg-telephone` migrated automatically.

## 0.14.0
- **Show the screen** and **Forward**.

## 0.11.0 - 0.13.0
- Floating button with unread badge, GM read receipts, **Terminal** model tied to a scene, room buttons, landline as a simple dial.
