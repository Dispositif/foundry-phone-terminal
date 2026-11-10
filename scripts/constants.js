import { labels } from "./i18n.js";

export const MODULE_ID = "soren-phone-terminal";
export const LEGACY_IDS = ["soren-burner-phone", "dg-telephone"]; // former ids (Burner Phone v0.8-0.15, DG Téléphone v0.1-0.7)
export const SOCKET = `module.${MODULE_ID}`;
export const RING_SRC = `modules/${MODULE_ID}/sounds/ring.wav`;
export const SMS_SRC = `modules/${MODULE_ID}/sounds/sms.wav`;
export const PICKUP_SRC = `modules/${MODULE_ID}/sounds/pickup.wav`;
export const HANGUP_SRC = `modules/${MODULE_ID}/sounds/hangup.wav`;
/** Stored value for a hidden number (internal data, shown translated). */
export const MASKED = "Numéro masqué"; // kept in French: stored in existing data
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
