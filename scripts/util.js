import { AudioHelper, MASKED, MODULE_ID } from "./constants.js";
import { updateFab } from "./fab.js";
import { t } from "./i18n.js";
import { PhonePanel } from "./gm-panel.js";
import { PlayerPhone } from "./player-phone.js";
/* -------------------------------------------- */
/*  Utilitaires                                 */
/* -------------------------------------------- */

export function esc(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

export function nl2br(str) {
  return esc(str).replace(/\n/g, "<br>");
}

/** Normalise un nom ou un numéro pour comparaison ("555 0142" == "555-0142"). */
export function norm(str) {
  const s = String(str ?? "").trim().toLowerCase();
  return /^[\d\s\-+.()]+$/.test(s) ? s.replace(/\D/g, "") : s;
}

/** Numéro masqué : la valeur stockée, ou son libellé dans l'une des langues. */
export function isMasked(key) {
  const k = norm(key);
  return k === norm(MASKED) || k === norm(t("Masked")) || k === "hidden number" || k === "numéro masqué";
}

/** Affichage d'un correspondant masqué dans la langue courante. */
export function maskedLabel(key) {
  return isMasked(key) ? t("Masked") : key;
}

export function playLocal(src, { loop = false } = {}) {
  const volume = game.settings.get(MODULE_ID, "volume");
  // 2e argument false = son joué uniquement sur ce client, jamais diffusé.
  return AudioHelper.play({ src, volume, loop, autoplay: true }, false);
}

/** Le MJ qui traite les messages des joueurs (un seul, même avec plusieurs MJ). */
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

export function randomNumber() {
  return `555-0${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
}

/** Redessine les fenêtres ouvertes : les demandes rapprochées (jetons, messages en rafale) n'en font qu'une. */
let rerenderTimer = null;
export function rerenderAll() {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    if (PhonePanel.instance?.rendered) PhonePanel.instance.render();
    if (PlayerPhone.instance?.rendered) PlayerPhone.instance.render();
    updateFab();
  }, 50);
}

