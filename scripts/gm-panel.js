import { attChipHtml, attFromDrop, pickImage } from "./attachments.js";
import { ApplicationV2, DialogV2, HandlebarsApplicationMixin, MASKED, MODES, MODULE_ID } from "./constants.js";
import { allPhones, anyMessaging, displayName, getLog, getPhoneData, holderName, isFixed, keyFor, modelOf, msgOn, patchLog, phoneLabel, sameConv, unmarkPhone, unreadCount } from "./devices.js";
import { contactsDialog, editPhoneDialog, giveDialog, markItemDialog, newPhoneDialog } from "./dialogs.js";
import { copyJournalLink } from "./journal-links.js";
import { openPhone } from "./main.js";
import { sendSms } from "./messages.js";
import { hangUpAll, pendingCalls, ring } from "./ring.js";
import { esc, isMasked, nl2br, norm } from "./util.js";
import { t, tn } from "./i18n.js";
/* -------------------------------------------- */
/*  Panneau MJ                                  */
/* -------------------------------------------- */


/** Zone de dépôt pour une pièce jointe. */
export function bindDrop(zone, onAtt) {
  if (!zone) return;
  zone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    zone.classList.add("spt-drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("spt-drag"));
  zone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    zone.classList.remove("spt-drag");
    const att = attFromDrop(ev);
    if (att) onAtt(att);
    else ui.notifications.warn(t("Warn.DropHint"));
  });
}

/** Messages envoyés par les joueurs à des PNJ (la « boîte de réception » du MJ). */
/** Bulles visibles par fil dans la boîte du MJ. */
const INBOX_BUBBLES = 6;

/** Pièce jointe dans une bulle de la boîte MJ : vignette ou nom du journal. */
function bubbleAtt(att) {
  if (!att) return "";
  if (att.type === "image") return `<img class="spt-bb-img" src="${esc(att.src)}" alt="">`;
  return `<span class="spt-bb-doc"><i class="fas fa-file-lines"></i> ${esc(att.name ?? "")}</span>`;
}

export function gmInbox() {
  const out = [];
  for (const p of allPhones()) {
    for (const e of getLog(p.phone)) {
      if (e.kind === "sms" && e.dir === "out" && !e.pj && !e.prep) out.push({ ...p, e });
    }
  }
  return out.sort((a, b) => b.e.t - a.e.t);
}

/** Sélecteur d'appareil : icône du modèle à gauche, mise à jour au changement. */
export function deviceSelect(mine, p, labelFn) {
  if (mine.length <= 1) {
    return `<div class="spt-icon-select"><i class="fas ${modelOf(p.phone).icon}"></i> <strong>${esc(labelFn(p))}</strong></div>`;
  }
  const opts = mine
    .map((q) => `<option value="${q.item.uuid}" data-icon="${modelOf(q.phone).icon}" ${q.item.uuid === p.item.uuid ? "selected" : ""}>${esc(labelFn(q))}</option>`)
    .join("");
  return `<div class="spt-icon-select spt-phone-select"><i class="fas ${modelOf(p.phone).icon}"></i><select data-phone-select data-icon-select>${opts}</select></div>`;
}

/** Synchronise l'icône placée avant chaque <select data-icon-select>. */
export function bindIconSelects(root) {
  for (const select of root.querySelectorAll("select[data-icon-select]")) {
    const icon = select.parentElement.querySelector(":scope > i");
    const sync = () => {
      const opt = select.selectedOptions[0];
      if (icon && opt?.dataset.icon) icon.className = `fas ${opt.dataset.icon}`;
    };
    select.addEventListener("change", sync);
    sync();
  }
}

export class PhonePanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "spt-phone-panel",
    tag: "form",
    classes: ["spt-phone-panel"],
    window: { title: "Phone & Terminal", icon: "fas fa-tower-cell", resizable: true },
    position: { width: 460, height: 620 },
    form: { handler: () => {}, submitOnChange: false, closeOnSubmit: false },
    actions: {
      switchTab: function (event, target) { this._focusSend = true; this._setState({ tab: target.dataset.tab }); },
      mode: function (event, target) { this._focusSend = true; this._setState({ mode: target.dataset.mode }); },
      ring: function () { this._doRing(); },
      hangup: function () { hangUpAll(); },
      sms: function () { this._doSms(); },
      newPhone: function () { newPhoneDialog(); },
      markItem: function () { markItemDialog(); },
      editPhone: async function (event, target) { editPhoneDialog(await fromUuid(target.dataset.uuid)); },
      contacts: async function (event, target) { contactsDialog(await fromUuid(target.dataset.uuid)); },
      give: async function (event, target) { giveDialog(await fromUuid(target.dataset.uuid)); },
      openPhone: function (event, target) { openPhone(target.dataset.uuid); },
      unmarkPhone: async function (event, target) {
        const item = await fromUuid(target.dataset.uuid);
        const ok = await DialogV2.confirm({
          window: { title: t("Unmark.Title") },
          content: `<p>${t("Unmark.Confirm", { name: esc(item.name) })}</p>`
        });
        if (ok) unmarkPhone(item);
      },
      selectPhone: function (event, target) {
        // Un clic sur un appareil le choisit comme destinataire et ouvre l'onglet Envoyer.
        this._focusSend = true;
        this._setState({ target: `phone:${target.dataset.number}`, tab: "send" });
      },
      sendReply: function (event, target) { this._sendReply(target.closest("[data-thread]")); },
      callBack: async function (event, target) {
        const th = target.closest("[data-thread]");
        const item = await fromUuid(th.dataset.uuid);
        const phone = getPhoneData(item);
        ring(`phone:${phone.number}`, { caller: displayName(phone, th.dataset.key) });
      },
      toggleNetwork: async function () {
        await game.settings.set(MODULE_ID, "networkDown", !game.settings.get(MODULE_ID, "networkDown"));
      },
      copyLink: function () {
        this._readForm();
        copyJournalLink(this._state);
      },
      attach: async function () {
        const src = await pickImage();
        if (!src) return;
        this._readForm();
        this._state.att = { type: "image", src };
        this._skipRead = true;
        this.render();
      },
      clearAtt: function () {
        this._readForm();
        this._state.att = null;
        this._skipRead = true;
        this.render();
      },
      toggleLock: async function (event, target) {
        const item = await fromUuid(target.dataset.uuid);
        await item.update({ [`flags.${MODULE_ID}.phone.locked`]: !getPhoneData(item)?.locked });
      },
      toggleSignal: async function (event, target) {
        const item = await fromUuid(target.dataset.uuid);
        await item.update({ [`flags.${MODULE_ID}.phone.noSignal`]: !getPhoneData(item)?.noSignal });
      },
      markAllSeen: async function () {
        for (const p of allPhones()) await patchLog(p.item, (e) => e.dir === "out" && e.seen === false, { seen: true });
      }
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/gm-panel.hbs`, scrollable: [".spt-tab-body"] }
  };

  _state = { target: null, sender: t("Masked"), text: "", att: null, tab: "send", mode: "message", drafts: {} };

  /** Change l'état (onglet, mode, destinataire…) en gardant la saisie en cours. */
  _setState(patch) {
    this._readForm();
    Object.assign(this._state, patch);
    this._skipRead = true;
    return this.render();
  }

  get title() {
    return t("Gm.PanelTitle");
  }

  _readForm() {
    const el = this.element;
    if (!el?.querySelector) return;
    this._state.target = el.querySelector("[name=target]")?.value ?? this._state.target;
    this._state.sender = el.querySelector("[name=sender]")?.value ?? this._state.sender;
    this._state.text = el.querySelector("[name=text]")?.value ?? this._state.text;
    for (const input of el.querySelectorAll("[data-draft]")) this._state.drafts[input.dataset.draft] = input.value;
  }

  async render(...args) {
    // Conserve la saisie en cours avant tout re-rendu (les actions peuvent modifier _state ensuite).
    if (this.rendered && !this._skipRead) this._readForm();
    this._skipRead = false;
    return super.render(...args);
  }

  /** Données du template : tout est calculé ici, le template ne fait qu'afficher. */
  async _prepareContext() {
    const phones = allPhones().sort((a, b) => phoneLabel(a).localeCompare(phoneLabel(b)));
    const players = game.users.filter((u) => !u.isGM);
    const countByNumber = phones.reduce((m, p) => m.set(norm(p.phone.number), (m.get(norm(p.phone.number)) ?? 0) + 1), new Map());

    // Destinataires : un numéro par ligne, quelle que soit son écriture (555-133 = 555133).
    const numbers = [...new Map(phones.map((p) => [norm(p.phone.number), p.phone.number])).values()];
    const targets = [...numbers.map((n) => `phone:${n}`), ...players.map((u) => `user:${u.id}`)];
    if (!targets.includes(this._state.target)) this._state.target = targets[0] ?? "";
    const targetDevices = numbers.map((n) => {
      const ps = phones.filter((p) => norm(p.phone.number) === norm(n));
      const label = ps.length > 1 ? `${n} — ${ps.map((p) => p.actor?.name ?? "?").join(" + ")} (${t("Gm.Cloned")})` : phoneLabel(ps[0]);
      return { value: `phone:${n}`, label, icon: modelOf(ps[0].phone).icon, selected: this._state.target === `phone:${n}` };
    });
    const targetPlayers = players.map((u) => ({
      value: `user:${u.id}`,
      label: `${u.name}${u.character ? ` — ${u.character.name}` : ""}${u.active ? "" : ` (${t("Gm.Offline")})`}`,
      selected: this._state.target === `user:${u.id}`
    }));

    // Messages des agents : un fil par appareil et par correspondant PNJ, le plus récent en haut.
    const inboxAll = gmInbox();
    const threads = new Map();
    for (const { item, phone, e } of inboxAll) {
      const id = `${item.uuid}|${norm(keyFor(phone, e.with))}`;
      if (!threads.has(id)) threads.set(id, { id, item, phone, key: e.with, unread: 0 });
      if (e.seen === false) threads.get(id).unread++;
    }
    const inbox = [...threads.values()].slice(0, 12).map((th) => {
      const conv = getLog(th.phone, { includePending: true }).filter((e) => e.kind === "sms" && sameConv(th.phone, e.with, th.key));
      return {
        id: th.id,
        uuid: th.item.uuid,
        key: th.key,
        who: holderName(th.item, th.phone),
        to: displayName(th.phone, th.key),
        unread: th.unread,
        canCall: !modelOf(th.phone).noCalls,
        draft: this._state.drafts[th.id] ?? "",
        bubbles: conv.slice(-INBOX_BUBBLES).map((e) => ({
          dir: e.dir,
          fwd: !!e.fwd,
          pending: !!e.pending,
          att: bubbleAtt(e.att),
          text: e.text ? nl2br(e.text) : ""
        })),
        more: Math.max(0, conv.length - INBOX_BUBBLES)
      };
    });

    // Appareils groupés : par porteur, puis par lieu, puis « sans porteur ».
    const groups = new Map();
    const groupOf = (p) => {
      if (isFixed(p.phone)) {
        const scene = game.scenes.get(p.phone.sceneId);
        return { key: `s:${p.phone.sceneId}`, order: 1, name: scene?.name ?? t("NoPlace"), img: scene?.thumb ?? null, icon: "fa-location-dot" };
      }
      if (p.actor) return { key: `a:${p.actor.id}`, order: 0, name: p.actor.name, img: p.actor.img, icon: "fa-user" };
      return { key: "none", order: 2, name: t("Gm.Nobody"), img: null, icon: "fa-ghost" };
    };
    for (const p of phones) {
      const g = groupOf(p);
      if (!groups.has(g.key)) groups.set(g.key, { ...g, devices: [] });
      const model = modelOf(p.phone);
      const mode = MODES[p.phone.mode ?? "on"] ?? MODES.on;
      const fixed = isFixed(p.phone);
      const unread = unreadCount(p.phone);
      groups.get(g.key).devices.push({
        uuid: p.item.uuid,
        number: p.phone.number,
        label: p.phone.label,
        icon: model.icon,
        modelLabel: model.label,
        modeIcon: fixed || (p.phone.mode ?? "on") === "on" ? null : mode.icon,
        modeLabel: mode.label,
        fixed,
        locked: !!p.phone.locked,
        noSignal: !!p.phone.noSignal,
        cloned: countByNumber.get(norm(p.phone.number)) > 1,
        unread,
        unreadTitle: unread ? tn("Gm.UnreadByPlayer", unread) : ""
      });
    }
    const sortedGroups = [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    // Ce que le destinataire choisi accepte : on ne montre que les formulaires possibles.
    const [kind, id] = (this._state.target ?? "").split(/:(.*)/s);
    const tp = kind === "phone" ? phones.filter((p) => norm(p.phone.number) === norm(id)) : [];
    const canMessage = kind === "phone" ? tp.some((p) => msgOn(p.phone)) : kind === "user" && anyMessaging();
    const canCall = kind === "phone" ? tp.some((p) => !modelOf(p.phone).noCalls) : kind === "user";
    if (!canMessage && canCall) this._state.mode = "call";
    if (!canCall && canMessage) this._state.mode = "message";
    const messaging = canMessage && canCall;
    return {
      tab: this._state.tab,
      mode: this._state.mode,
      messaging,
      down: game.settings.get(MODULE_ID, "networkDown"),
      pending: phones.reduce((n, p) => n + getLog(p.phone, { includePending: true }).filter((e) => e.pending).length, 0),
      ringing: [...pendingCalls.values()].map((c) => c.label).join(", "),
      targetDevices,
      targetPlayers,
      sender: this._state.sender,
      text: this._state.text,
      attChip: attChipHtml(this._state.att),
      inbox,
      inboxUnread: inboxAll.filter((x) => x.e.seen === false).length,
      groups: sortedGroups,
      deviceCount: phones.length
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    PhonePanel.instance = this;
    bindIconSelects(this.element);
    this.element.querySelector("select[name=target]")?.addEventListener("change", (ev) => {
      this._focusSend = true;
      this._setState({ target: ev.target.value });
    });
    if (this._focusSend) {
      this._focusSend = false;
      this.element.querySelector(".spt-gm-send textarea[name=text], .spt-gm-send [data-action=ring]")?.focus();
    }
    for (const input of this.element.querySelectorAll("[data-draft]")) {
      input.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" || ev.shiftKey) return;
        ev.preventDefault();
        this._sendReply(input.closest("[data-thread]"));
      });
    }
    bindDrop(this.element.querySelector(".spt-drop"), (att) => {
      this._readForm();
      this._state.att = att;
      this._skipRead = true;
      this.render();
    });
  }

  /** Réponse en ligne dans un fil : envoyée sous l'identité du PNJ, le fil passe en lu. */
  async _sendReply(th) {
    const input = th?.querySelector("[data-draft]");
    const text = input?.value.trim();
    if (!text) return;
    const item = await fromUuid(th.dataset.uuid);
    const phone = getPhoneData(item);
    const key = th.dataset.key;
    input.value = "";
    delete this._state.drafts[th.dataset.thread];
    await patchLog(item, (e) => e.dir === "out" && sameConv(phone, e.with, key), { seen: true });
    await sendSms(`phone:${phone.number}`, text, { sender: displayName(phone, key) });
  }

  _doRing() {
    this._readForm();
    if (!this._state.target) return ui.notifications.warn(t("Warn.NoRecipient"));
    ring(this._state.target, { caller: this._normSender() });
  }

  /** Expéditeur saisi ; « Numéro masqué » (dans toute langue) est stocké sous sa forme interne. */
  _normSender() {
    const s = this._state.sender.trim();
    return !s || isMasked(s) ? MASKED : s;
  }

  async _doSms() {
    this._readForm();
    if (!this._state.target) return ui.notifications.warn(t("Warn.NoRecipient"));
    await sendSms(this._state.target, this._state.text, { sender: this._normSender(), att: this._state.att });
    this._state.text = "";
    this._state.att = null;
    this._skipRead = true;
    this.render();
  }
}

