import { attChipHtml, attFromDrop, pickImage } from "./attachments.js";
import { ApplicationV2, DialogV2, MASKED, MODES, MODULE_ID } from "./constants.js";
import { allPhones, anyMessaging, displayName, getLog, getPhoneData, holderName, isFixed, modelOf, patchLog, phoneLabel, sameConv, smsOn, unmarkPhone, unreadCount } from "./devices.js";
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

export class PhonePanel extends ApplicationV2 {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "spt-phone-panel",
    tag: "form",
    classes: ["spt-phone-panel"],
    window: { title: "Phone & Terminal", icon: "fas fa-mobile-screen", resizable: true },
    position: { width: 480, height: "auto" },
    form: { handler: () => {}, submitOnChange: false, closeOnSubmit: false },
    actions: {
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
        const select = this.element.querySelector("[name=target]");
        if (!select) return;
        select.value = `phone:${target.dataset.number}`;
        select.dispatchEvent(new Event("change")); // met à jour l'icône du destinataire
      },
      reply: async function (event, target) {
        const item = await fromUuid(target.dataset.uuid);
        const phone = getPhoneData(item);
        const key = target.dataset.key;
        this._readForm();
        this._state.target = `phone:${phone.number}`;
        this._state.sender = displayName(phone, key);
        this._skipRead = true;
        await this.render();
        this.element.querySelector("[name=text]")?.focus();
        await patchLog(item, (e) => e.dir === "out" && sameConv(phone, e.with, key), { seen: true });
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

  _state = { target: null, sender: t("Masked"), text: "", att: null };

  get title() {
    return t("Gm.PanelTitle");
  }

  _readForm() {
    const el = this.element;
    if (!el?.querySelector) return;
    this._state.target = el.querySelector("[name=target]")?.value ?? this._state.target;
    this._state.sender = el.querySelector("[name=sender]")?.value ?? this._state.sender;
    this._state.text = el.querySelector("[name=text]")?.value ?? this._state.text;
  }

  async render(...args) {
    // Conserve la saisie en cours avant tout re-rendu (les actions peuvent modifier _state ensuite).
    if (this.rendered && !this._skipRead) this._readForm();
    this._skipRead = false;
    return super.render(...args);
  }

  async _renderHTML() {
    const phones = allPhones().sort((a, b) => phoneLabel(a).localeCompare(phoneLabel(b)));
    const numbers = [...new Set(phones.map((p) => p.phone.number))];
    const countByNumber = phones.reduce((m, p) => m.set(norm(p.phone.number), (m.get(norm(p.phone.number)) ?? 0) + 1), new Map());
    const players = game.users.filter((u) => !u.isGM);

    const targets = [...numbers.map((n) => `phone:${n}`), ...players.map((u) => `user:${u.id}`)];
    if (!targets.includes(this._state.target)) this._state.target = targets[0] ?? "";

    const sel = (v) => (v === this._state.target ? "selected" : "");
    const phoneOpts = numbers
      .map((n) => {
        const ps = phones.filter((p) => p.phone.number === n);
        const label = ps.length > 1 ? `${n} — ${ps.map((p) => p.actor?.name ?? "?").join(" + ")} (${t("Gm.Cloned")})` : phoneLabel(ps[0]);
        return `<option value="phone:${esc(n)}" data-icon="${modelOf(ps[0].phone).icon}" ${sel(`phone:${n}`)}>${esc(label)}</option>`;
      })
      .join("");
    const userOpts = players
      .map((u) => `<option value="user:${u.id}" data-icon="fa-user" ${sel(`user:${u.id}`)}>${esc(`${u.name}${u.character ? ` — ${u.character.name}` : ""}${u.active ? "" : ` (${t("Gm.Offline")})`}`)}</option>`)
      .join("");

    const ringing = [...pendingCalls.values()].map((c) => esc(c.label)).join(", ");

    // Boîte de réception
    const inbox = gmInbox();
    const unread = inbox.filter((x) => x.e.seen === false).length;
    const inboxRows = inbox
      .slice(0, 8)
      .map(({ item, phone, actor, e }) => `<li class="spt-inbox-item ${e.seen === false ? "unread" : ""}">
          <div class="spt-inbox-head"><strong>${esc(holderName(item, phone))}</strong>${e.fwd ? ` ${t("Fwd.Verb")}` : ""} → ${esc(displayName(phone, e.with))}</div>
          <div class="spt-inbox-text">${e.att ? `<i class="fas fa-paperclip"></i> ${esc(e.att.type === "image" ? t("Image") : e.att.name)}<br>` : ""}${nl2br(e.text)}</div>
          <a data-action="reply" data-uuid="${item.uuid}" data-key="${esc(e.with)}"><i class="fas fa-reply"></i> ${t("Gm.Reply")}</a>
        </li>`)
      .join("");

    const rows = phones
      .map((p) => {
        const mode = MODES[p.phone.mode ?? "on"] ?? MODES.on;
        const clone = countByNumber.get(norm(p.phone.number)) > 1 ? `<i class="fas fa-clone spt-warn" title="${t("Gm.ClonedHint")}"></i>` : "";
        const fixed = isFixed(p.phone);
        const orphan = !p.actor && !fixed ? `<i class="fas fa-ghost spt-warn" title="${t("Gm.Orphan")}"></i>` : "";
        const model = modelOf(p.phone);
        const unread = unreadCount(p.phone);
        const unreadBadge = unread ? `<span class="spt-row-unread" title="${tn("Gm.UnreadByPlayer", unread)}"><i class="fas fa-envelope"></i> ${unread}</span>` : "";
        return `<li class="spt-phone-row-item">
            <a data-action="selectPhone" data-number="${esc(p.phone.number)}" title="${t("Gm.PickRecipient")}">
              <i class="fas ${model.icon}" title="${model.label}"></i>${fixed ? "" : ` <i class="fas ${mode.icon} spt-dim" title="${mode.label}"></i>`} ${esc(phoneLabel(p))} ${clone}${orphan} ${unreadBadge}
            </a>
            <span class="spt-row-controls">
              <a data-action="toggleLock" data-uuid="${p.item.uuid}" class="${p.phone.locked ? "spt-locked" : ""}" title="${p.phone.locked ? t("Gm.Locked") : t("Gm.Unlocked")}"><i class="fas ${p.phone.locked ? "fa-lock" : "fa-lock-open"}"></i></a>
              <a data-action="toggleSignal" data-uuid="${p.item.uuid}" class="${p.phone.noSignal ? "spt-nosignal" : ""}" title="${p.phone.noSignal ? t("Gm.NoSignal") : t("Gm.SignalOk")}"><i class="fas fa-signal"></i></a>
              <a data-action="openPhone" data-uuid="${p.item.uuid}" title="${t("Gm.OpenPrepare")}"><i class="fas fa-mobile-screen"></i></a>
              <a data-action="contacts" data-uuid="${p.item.uuid}" title="${t("Contacts.Title")}"><i class="fas fa-address-book"></i></a>
              ${fixed ? "" : `<a data-action="give" data-uuid="${p.item.uuid}" title="${t("Gm.GiveTo")}"><i class="fas fa-hand-holding"></i></a>`}
              <a data-action="editPhone" data-uuid="${p.item.uuid}" title="${t("Gm.Edit")}"><i class="fas fa-pen"></i></a>
              <a data-action="unmarkPhone" data-uuid="${p.item.uuid}" title="${t("Gm.Remove")}"><i class="fas fa-trash"></i></a>
            </span>
          </li>`;
      })
      .join("");

    const down = game.settings.get(MODULE_ID, "networkDown");
    const pendingCount = phones.reduce((n, p) => n + getLog(p.phone, { includePending: true }).filter((e) => e.pending).length, 0);

    return `
      <div class="spt-phone-body">
        <div class="spt-network ${down ? "down" : ""}">
          <span><i class="fas ${down ? "fa-ban" : "fa-signal"}"></i> ${down ? t("Net.DownAll") : t("Net.Ok")}${pendingCount ? ` · ${t("Net.Pending", { n: pendingCount })}` : ""}</span>
          <button type="button" data-action="toggleNetwork">${down ? t("Net.Restore") : t("Net.Cut")}</button>
        </div>
        ${inboxRows ? `<fieldset class="spt-inbox">
          <legend><i class="fas fa-inbox"></i> ${t("Gm.Inbox")} ${unread ? `<span class="spt-badge">${unread}</span>` : ""}</legend>
          <ul class="spt-inbox-list">${inboxRows}</ul>
          ${unread ? `<a class="spt-mark-all" data-action="markAllSeen">${t("Gm.MarkAllSeen")}</a>` : ""}
        </fieldset>` : ""}
        <div class="form-group">
          <label>${t("Gm.Recipient")}</label>
          <div class="spt-icon-select"><i class="fas fa-mobile-screen"></i>
          <select name="target" data-icon-select>
            ${phoneOpts ? `<optgroup label="${t("Devices")}">${phoneOpts}</optgroup>` : ""}
            <optgroup label="${t("Gm.PlayersDirect")}">${userOpts}</optgroup>
          </select></div>
        </div>
        <div class="form-group">
          <label>${t("Gm.Sender")}</label>
          <input type="text" name="sender" value="${esc(this._state.sender)}" placeholder="${t("Masked")}">
        </div>
        <fieldset>
          ${anyMessaging() ? `<legend><i class="fas fa-comment-sms"></i> ${smsOn() ? t("Gm.SmsMail") : t("Gm.Mail")}</legend>
          <div class="spt-drop" title="${t("DropHere")}">
            ${attChipHtml(this._state.att)}
            <textarea name="text" rows="3" placeholder="${t("Gm.MessagePlaceholder")}">${esc(this._state.text)}</textarea>
          </div>` : `<legend><i class="fas fa-phone"></i> ${t("Gm.Call")}</legend>`}
          <div class="spt-phone-row">
            ${anyMessaging() ? `<button type="button" data-action="attach" title="${t("AttachImage")}" class="spt-icon-btn"><i class="fas fa-paperclip"></i></button>
            <button type="button" data-action="sms"><i class="fas fa-paper-plane"></i> ${t("Send")}</button>` : ""}
            <button type="button" data-action="ring"><i class="fas fa-phone-volume"></i> ${t("Gm.Ring")}</button>
            <button type="button" data-action="hangup" ${pendingCalls.size ? "" : "disabled"} title="${t("Call.HangUp")}" class="spt-icon-btn"><i class="fas fa-phone-slash"></i></button>
            <button type="button" data-action="copyLink" title="${t("Gm.CopyLink")}" class="spt-icon-btn"><i class="fas fa-link"></i></button>
          </div>
          ${ringing ? `<p class="spt-phone-status">${t("Gm.RingingAt", { who: ringing })}</p>` : ""}
        </fieldset>
        <fieldset>
          <legend><i class="fas fa-mobile-screen"></i> ${t("Devices")}</legend>
          ${rows ? `<ul class="spt-phone-list">${rows}</ul>` : `<p class="spt-phone-status">${t("Gm.NoDevices")}</p>`}
          <div class="spt-phone-row">
            <button type="button" data-action="newPhone"><i class="fas fa-plus"></i> ${t("NewDevice")}</button>
            <button type="button" data-action="markItem"><i class="fas fa-tag"></i> ${t("Gm.MarkItem")}</button>
          </div>
        </fieldset>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    PhonePanel.instance = this;
    bindIconSelects(this.element);
    bindDrop(this.element.querySelector(".spt-drop"), (att) => {
      this._readForm();
      this._state.att = att;
      this._skipRead = true;
      this.render();
    });
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

