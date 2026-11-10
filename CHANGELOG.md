# Changelog

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
