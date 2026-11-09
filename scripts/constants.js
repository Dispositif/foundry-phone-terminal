import { labels } from "./i18n.js";

export const MODULE_ID = "soren-phone-terminal";
export const LEGACY_IDS = ["soren-burner-phone", "dg-telephone"]; // anciens identifiants (Burner Phone v0.8-0.15, DG Téléphone v0.1-0.7)
export const SOCKET = `module.${MODULE_ID}`;
export const RING_SRC = `modules/${MODULE_ID}/sounds/ring.wav`;
export const SMS_SRC = `modules/${MODULE_ID}/sounds/sms.wav`;
export const PICKUP_SRC = `modules/${MODULE_ID}/sounds/pickup.wav`;
export const HANGUP_SRC = `modules/${MODULE_ID}/sounds/hangup.wav`;
/** Valeur stockée pour un numéro masqué (donnée interne, affichée traduite). */
export const MASKED = "Numéro masqué";
export const LOG_MAX = 200; // entrées non préparées gardées par appareil (les entrées préparées par le MJ sont toujours gardées)

export const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
export const AudioHelper = foundry.audio.AudioHelper;

const MODE_LABELS = labels("Mode", ["on", "silent", "off"]);
export const MODES = {
  on: { get label() { return MODE_LABELS.on; }, icon: "fa-bell" },
  silent: { get label() { return MODE_LABELS.silent; }, icon: "fa-bell-slash" },
  off: { get label() { return MODE_LABELS.off; }, icon: "fa-power-off" }
};

/** Résultats vus par le MJ (appels sortants du MJ). */
export const RESULT_LABELS = labels("Result", ["answer", "decline", "missed", "cancelled", "off", "nobody", "nosignal"]);

