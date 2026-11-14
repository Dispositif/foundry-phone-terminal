import { MASKED } from "./constants.js";
import { allPhones, isComputer, phonesByNumber } from "./devices.js";
import { sendSms } from "./messages.js";
import { ring } from "./ring.js";
import { esc, isMasked, maskedLabel, norm, shieldIcon } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  @SMS / @Mail / @Call links in journals      */
/*  (@SMS and @Mail are the same message;       */
/*  @Secure...: on a secure line)               */
/* -------------------------------------------- */

/** Plain text from the HTML captured in a journal. */
export function plainText(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return div.textContent.trim();
}

/** Link recipient: number, character name (their phone) or player name. */
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

/** Builds the link from the GM panel state and copies it (secure: @SecureSMS / @SecureCall). */
export async function copyJournalLink({ target, sender, text, att }, { secure = false } = {}) {
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
  const isSms = !!(body || attStr);
  // A message to a laptop or terminal reads as an email in the journal.
  const msgKind = kind === "phone" && phonesByNumber(value).some((p) => isComputer(p.phone)) ? "Mail" : "SMS";
  const args = [clean(to), from, isSms ? attStr : ""];
  while (args.length > 1 && !args[args.length - 1]) args.pop();
  const prefix = secure ? "Secure" : "";
  const link = isSms ? `@${prefix}${msgKind}[${args.join("|")}]{${body}}` : `@${prefix}Call[${args.join("|")}]`;
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
    pattern: /@(Secure)?(SMS|Mail|Call)\[([^\]]*)\](?:\{([^}]*)\})?/g,
    enricher: async (match) => {
      const [, secure, written, rawArgs, rawText] = match;
      // @Mail is an @SMS written for a computer: same message, an envelope icon.
      const kind = written === "Call" ? "Call" : "SMS";
      const msgIcon = written === "Mail" ? "fa-envelope" : "fa-comment-sms";
      const [to = "", from = "", attStr = ""] = plainText(rawArgs).split("|").map((x) => x.trim());
      const text = plainText(rawText);
      if (!game.user.isGM) {
        // Players never see a button: only the message text.
        const span = document.createElement("span");
        span.textContent = kind === "SMS" ? text : "";
        return span;
      }
      const a = document.createElement("a");
      a.classList.add("spt-link", kind === "SMS" ? "sms" : "call");
      Object.assign(a.dataset, { kind, to, from, text, att: attStr, secure: secure ? "1" : "" });
      a.title = t("Link.ClickToSend");
      const who = esc(maskedLabel(from || MASKED));
      const shield = secure ? `${shieldIcon({ title: t("Secure.Line") })} ` : "";
      a.innerHTML = shield +
        (kind === "SMS"
          ? `<i class="fas ${msgIcon}"></i> ${who} → ${esc(to)}${attStr ? ' <i class="fas fa-paperclip"></i>' : ""} : « ${esc(text)} »`
          : `<i class="fas fa-phone-volume"></i> ${t("Link.Calls", { who, to: esc(to) })}`);
      return a;
    }
  });
}

/** secure: "1" for @SecureSMS / @SecureCall (a secure line); @SMS / @Call are always in clear. */
export async function runJournalLink({ kind, to, from, text, att, secure }) {
  const target = resolveTarget(to);
  if (!target) return ui.notifications.warn(`📱 ${t("Warn.RecipientNotFound", { to })}`);
  const sender = from || MASKED;
  const opts = { secure: !!secure };
  if (kind === "SMS") return sendSms(target, text, { sender, att: parseAtt(att), ...opts });
  return ring(target, { caller: sender, ...opts });
}

