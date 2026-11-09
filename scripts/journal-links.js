import { MASKED } from "./constants.js";
import { allPhones, anyMessaging, phonesByNumber } from "./devices.js";
import { sendSms } from "./messages.js";
import { ring } from "./ring.js";
import { esc, isMasked, maskedLabel, norm } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Liens @SMS / @Call dans les journaux        */
/* -------------------------------------------- */

/** Texte brut à partir du HTML capturé dans un journal. */
export function plainText(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return div.textContent.trim();
}

/** Destinataire d'un lien : numéro, nom d'un personnage (son téléphone) ou nom d'un joueur. */
export function resolveTarget(to) {
  to = to?.trim();
  if (!to) return null;
  if (phonesByNumber(to).length) return `phone:${to}`;
  const n = norm(to);
  const actor = game.actors.find((a) => norm(a.name) === n);
  if (actor) {
    const phones = allPhones().filter((p) => p.actor === actor);
    const best = phones.find((p) => (p.phone.model ?? "smartphone") === "smartphone") ?? phones[0];
    if (best) return `phone:${best.phone.number}`;
  }
  const user = game.users.find((u) => !u.isGM && norm(u.name) === n);
  return user ? `user:${user.id}` : null;
}

export function parseAtt(str) {
  if (!str) return null;
  const [type, ...rest] = str.split(":");
  const value = rest.join(":");
  if (type === "img" && value) return { type: "image", src: value };
  if (type === "doc" && value) return { type: "doc", uuid: value, name: fromUuidSync(value)?.name ?? t("Document") };
  return null;
}

/** Construit le lien à partir de l'état du panneau MJ et le copie. */
export async function copyJournalLink({ target, sender, text, att }) {
  const [kind, value] = String(target ?? "").split(/:(.*)/s);
  let to = value;
  if (kind === "user") {
    const user = game.users.get(value);
    to = user?.character?.name ?? user?.name;
  }
  if (!to) return ui.notifications.warn(t("Warn.ChooseRecipient"));
  const clean = (str) => String(str ?? "").replace(/[\[\]{}|]/g, " ").replace(/\s+/g, " ").trim();
  const from = clean(sender) && !isMasked(sender) ? clean(sender) : "";
  const attStr = att ? (att.type === "image" ? `img:${att.src}` : `doc:${att.uuid}`) : "";
  const body = clean(text);
  const isSms = anyMessaging() && (body || attStr);
  const args = [clean(to), from, isSms ? attStr : ""];
  while (args.length > 1 && !args[args.length - 1]) args.pop();
  const link = isSms ? `@SMS[${args.join("|")}]{${body}}` : `@Call[${args.join("|")}]`;
  try {
    if (game.clipboard?.copyPlainText) await game.clipboard.copyPlainText(link);
    else await navigator.clipboard.writeText(link);
    ui.notifications.info(`📋 ${t("Link.Copied", { link })}`);
  } catch {
    ui.notifications.warn(t("Link.CopyFailed", { link }));
  }
}

export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push({
    pattern: /@(SMS|Call)\[([^\]]*)\](?:\{([^}]*)\})?/g,
    enricher: async (match) => {
      const [, kind, rawArgs, rawText] = match;
      const [to = "", from = "", attStr = ""] = plainText(rawArgs).split("|").map((x) => x.trim());
      const text = plainText(rawText);
      if (!game.user.isGM) {
        // Les joueurs ne voient jamais de bouton : seulement le texte du SMS.
        const span = document.createElement("span");
        span.textContent = kind === "SMS" ? text : "";
        return span;
      }
      const a = document.createElement("a");
      a.classList.add("spt-link", kind === "SMS" ? "sms" : "call");
      Object.assign(a.dataset, { kind, to, from, text, att: attStr });
      a.title = t("Link.ClickToSend");
      const who = esc(maskedLabel(from || MASKED));
      a.innerHTML =
        kind === "SMS"
          ? `<i class="fas fa-comment-sms"></i> ${who} → ${esc(to)}${attStr ? ' <i class="fas fa-paperclip"></i>' : ""} : « ${esc(text)} »`
          : `<i class="fas fa-phone-volume"></i> ${t("Link.Calls", { who, to: esc(to) })}`;
      return a;
    }
  });
}

export async function runJournalLink({ kind, to, from, text, att }) {
  const target = resolveTarget(to);
  if (!target) return ui.notifications.warn(`📱 ${t("Warn.RecipientNotFound", { to })}`);
  const sender = from || MASKED;
  if (kind === "SMS") return sendSms(target, text, { sender, att: parseAtt(att) });
  return ring(target, { caller: sender });
}

