import { AudioHelper, MASKED, MODULE_ID } from "./constants.js";
import { updateFab } from "./fab.js";
import { t } from "./i18n.js";
import { PhonePanel } from "./gm-panel.js";
import { PlayerPhone } from "./player-phone.js";
import { rerenderPagers } from "./pager.js";
/* -------------------------------------------- */
/*  Utilities                                   */
/* -------------------------------------------- */

export function esc(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

export function nl2br(str) {
  return esc(str).replace(/\n/g, "<br>");
}

/** Normalizes a name or number for comparison ("555 0142" == "555-0142"). */
export function norm(str) {
  // Numbers: dashes (typographic ones too), spaces, dots, brackets and slashes are ignored.
  const s = String(str ?? "").normalize("NFKC").trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g, "-");
  return /^[\d\s\-+.()/]+$/.test(s) ? s.replace(/\D/g, "") : s;
}

/** Hidden number: the stored value, or its label in either language. */
export function isMasked(key) {
  const k = norm(key);
  return k === norm(MASKED) || k === norm(t("Masked")) || k === "hidden number" || k === "numéro masqué";
}

/** Display of a hidden correspondent in the current language. */
export function maskedLabel(key) {
  return isMasked(key) ? t("Masked") : key;
}

export function playLocal(src, { loop = false, gain = 1 } = {}) {
  const volume = game.settings.get(MODULE_ID, "volume") * gain;
  // 2nd argument false = sound played on this client only, never broadcast.
  return AudioHelper.play({ src, volume, loop, autoplay: true }, false);
}

/** The GM who handles player messages (only one, even with several GMs). */
export function isActiveGM() {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

export function gmWhisper(content, alias = `📱 ${t("PhoneAlias")}`) {
  return ChatMessage.create({
    content,
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    speaker: { alias }
  });
}

/** Random number <prefix>0xxx for a new device (555-0xxx by default); <prefix>02xx is kept for the NPC directory. */
export function randomNumber() {
  let n = Math.floor(Math.random() * 900);
  if (n >= 200) n += 100;
  let prefix = "555-";
  try {
    prefix = game.settings.get(MODULE_ID, "numberPrefix") ?? prefix;
  } catch {}
  return `${prefix}0${String(n).padStart(3, "0")}`;
}

/** Random email address for a laptop or a terminal: user33@mail.net */
export function randomEmail() {
  return `user${Math.floor(Math.random() * 90) + 10}@mail.net`;
}

/** Redraws open windows: close requests (tokens, bursts of messages) are merged into one. */
let rerenderTimer = null;
export function rerenderAll() {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    if (PhonePanel.instance?.rendered) PhonePanel.instance.render();
    if (PlayerPhone.instance?.rendered) PlayerPhone.instance.render();
    rerenderPagers();
    updateFab();
  }, 50);
}

