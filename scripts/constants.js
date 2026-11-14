import { labels } from "./i18n.js";

export const MODULE_ID = "soren-phones-computers";
export const LEGACY_IDS = ["soren-phone-terminal", "soren-burner-phone", "dg-telephone"]; // former ids (Phone & Terminal v0.16-0.29, Burner Phone v0.8-0.15, DG Téléphone v0.1-0.7)
export const SOCKET = `module.${MODULE_ID}`;
export const RING_SRC = `modules/${MODULE_ID}/sounds/ring.ogg`;
export const SMS_SRC = `modules/${MODULE_ID}/sounds/sms.ogg`;
export const PICKUP_SRC = `modules/${MODULE_ID}/sounds/pickup.ogg`;
export const HANGUP_SRC = `modules/${MODULE_ID}/sounds/hangup.ogg`;
export const RINGBACK_SRC = `modules/${MODULE_ID}/sounds/ringback.ogg`;
// Data exchange heard when a secure line is set up.
export const SECURE_SRC = `modules/${MODULE_ID}/sounds/secure.ogg`;
export const VIBRATE_SRC = `modules/${MODULE_ID}/sounds/vibrate.ogg`;
/** Stored value for a hidden number (internal data, shown translated). */
export const MASKED = "Numéro masqué"; // kept in French: stored in existing data
export const PAGER_MAX = 12; // characters on a pager's one-line screen
export const LOG_MAX = 200; // non-prepared entries kept per device (entries prepared by the GM are always kept)

export const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
export const AudioHelper = foundry.audio.AudioHelper;

const MODE_LABELS = labels("Mode", ["on", "silent", "off"]);
export const MODES = {
  on: { get label() { return MODE_LABELS.on; }, icon: "fa-bell" },
  silent: { get label() { return MODE_LABELS.silent; }, icon: "fa-bell-slash" },
  off: { get label() { return MODE_LABELS.off; }, icon: "fa-power-off" }
};

/** Outcomes seen by the GM (GM outgoing calls). */
export const RESULT_LABELS = labels("Result", ["answer", "decline", "missed", "cancelled", "off", "nobody", "nosignal"]);


/** Registered "device" sheet, set in flags.core.sheetClass of device items. */
export const SHEET_ID = `${MODULE_ID}.PhoneSheet`;

/** Default NPC directory (New Orleans sample). Directory numbers use 555-02xx, never given to new devices. */
export const DIRECTORY_SAMPLE = `# Tip: add the agents' own numbers as public, so they all know each other:
Agent Reyes | 555-0142 | public

# Delta Green
Marlin Hunt | 555-0242
Cell's dead drop | 555-0287

# Last Things Last
Clyde Baughman | 555-0209
Michael Baughman | 555-0232

# Public
Pizza Delta | 555-0202 | public
Crescent City Taxi | 555-0203 | public
Union Passenger Terminal | 555-0204 | public
Charity General Hospital | 555-0205 | public
NOPD 8th District (front desk) | 555-0206 | public
Lafitte Motel | 555-0200 | public`;
