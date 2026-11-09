# Changelog

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
