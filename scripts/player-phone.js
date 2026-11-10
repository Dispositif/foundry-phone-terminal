import { attChipHtml, attHtml, openAttachment, pickImage } from "./attachments.js";
import { openSystemSheet } from "./item-sheet.js";
import { ApplicationV2, MODES, MODULE_ID, SOCKET } from "./constants.js";
import { SKINS, addLog, allPhones, conversations, displayName, getLog, getPhoneData, hasSignal, holders, isComputer, isFixed, isLandline, keyFor, markRead, modelOf, msgOn, mutateLog, phoneLabel, sameConv, isUnread, skinOf, unreadCount } from "./devices.js";
import { contactsDialog } from "./dialogs.js";
import { loadLastDevice, myPhones, saveLastDevice } from "./fab.js";
import { bindDrop, bindIconSelects, deviceSelect } from "./gm-panel.js";
import { grantAttachments } from "./messages.js";
import { playerCall, playerSendSms } from "./player-calls.js";
import { attShowHtml, findEntry, forwardEntry, showScreen } from "./share.js";
import { esc, isMasked, nl2br } from "./util.js";
import { t, tn } from "./i18n.js";
/* -------------------------------------------- */
/*  Player window: My phone                      */
/* -------------------------------------------- */

export class PlayerPhone extends ApplicationV2 {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "spt-player-phone",
    classes: ["spt-player-phone"],
    window: { title: "Phone & Terminal", icon: "fas fa-mobile-screen", resizable: true },
    position: { width: 340, height: 520 },
    actions: {
      open: function (event, target) { this._go("conv", target.dataset.key); },
      back: function () { this._go("list"); },
      compose: function () { this._go("new"); },
      send: function () { this._send(); },
      call: function () { this._call(); },
      dial: function (event, target) { this._dial(target.dataset.digit); },
      dialBack: function () {
        const input = this.element.querySelector("[name=to]");
        if (input) this._state.to = input.value = input.value.slice(0, -1);
      },
      attach: async function () {
        const src = await pickImage();
        if (!src) return;
        this._readForm();
        this._state.att = { type: "image", src };
        this._rerender();
      },
      clearAtt: function () {
        this._readForm();
        this._state.att = null;
        this._rerender();
      },
      gmContacts: function () { const p = this._current(); if (p) contactsDialog(p.item); },
      gmItemSheet: function () { const p = this._current(); if (p) openSystemSheet(p.item); },
      showEntry: async function (event, target) {
        const p = this._current();
        const e = p && findEntry(p.phone, target.dataset.id);
        if (!e) return;
        const who = displayName(p.phone, e.with);
        const html = `${await attShowHtml(e.att)}${e.text ? `<div class="spt-thread"><div class="spt-bubble ${e.dir}">${nl2br(e.text)}</div></div>` : ""}`;
        showScreen(p, t(e.dir === "in" ? "Share.ReceivedFrom" : "Share.SentTo", { who }), html);
      },
      fwdEntry: function (event, target) {
        const p = this._current();
        const e = p && findEntry(p.phone, target.dataset.id);
        if (e) forwardEntry(p, e);
      },
      showConv: function () {
        const p = this._current();
        if (!p) return;
        const key = this._state.key;
        const lines = getLog(p.phone)
          .filter((e) => sameConv(p.phone, e.with, key))
          .reverse()
          .map((e) => {
            if (e.kind !== "sms") return `<div class="spt-call-line"><i class="fas fa-phone"></i> ${callLabel(e)}</div>`;
            const att = !e.att ? "" : e.att.type === "image" ? `<img class="spt-att-img" src="${esc(e.att.src)}">` : `<div><i class="fas fa-file-lines"></i> ${esc(e.att.name)}</div>`;
            return `<div class="spt-bubble ${e.dir}">${att}${e.text ? `<div>${nl2br(e.text)}</div>` : ""}</div>`;
          })
          .join("");
        showScreen(p, t("Share.ConversationWith", { who: displayName(p.phone, key) }), `<div class="spt-thread ${isComputer(p.phone) ? "mail" : ""}">${lines}</div>`);
      },
      gmDelete: async function (event, target) {
        const p = this._current();
        const { id, t: ts } = target.dataset;
        await mutateLog(p.item, (log) => log.filter((e) => !(e.id ? e.id === id : String(e.t) === ts)));
      }
    }
  };

  _state = { phoneUuid: null, view: "list", key: null, draft: "", to: "", entryType: "smsIn", att: null };

  get title() {
    if (!this.gm) return this._mine().some((p) => isComputer(p.phone)) ? t("MyDevices") : t("MyPhone");
    const p = this._current();
    return p ? `${t("Device")} — ${phoneLabel(p)}` : t("Devices");
  }

  /** The GM sees and prepares every device (including NPC and world ones). */
  get gm() {
    return game.user.isGM;
  }

  _mine() {
    if (this.gm) return allPhones().sort((a, b) => phoneLabel(a).localeCompare(phoneLabel(b)));
    // Same rules as for ringing: the player assigned to the character, otherwise its owners.
    // (Keeps a player from seeing another PC's devices they also own.)
    return myPhones();
  }

  _current() {
    const mine = this._mine();
    const want = this._state.phoneUuid ?? loadLastDevice();
    // Wanted device missing (terminal or landline out of reach): fall back to a personal device.
    return mine.find((p) => p.item.uuid === want) ?? mine.find((p) => !isFixed(p.phone)) ?? mine[0] ?? null;
  }

  _readForm() {
    const el = this.element;
    if (!el?.querySelector) return;
    this._state.draft = el.querySelector("[name=draft]")?.value ?? this._state.draft;
    this._state.to = el.querySelector("[name=to]")?.value ?? this._state.to;
    this._state.entryType = el.querySelector("[name=entryType]")?.value ?? this._state.entryType;
  }

  async render(...args) {
    // Keep the current input on automatic re-renders (message received, etc.).
    if (this.rendered && !this._skipRead) this._readForm();
    this._skipRead = false;
    return super.render(...args);
  }

  /** Re-render after a deliberate _state change (does not re-read the form). */
  _rerender() {
    this._skipRead = true;
    return this.render();
  }

  _go(view, key = null) {
    this._state.view = view;
    this._state.key = key;
    this._state.draft = "";
    if (view === "new") this._state.to = "";
    this._rerender();
  }

  async _send() {
    this._readForm();
    const p = this._current();
    if (!p) return;
    const to = this._state.view === "new" ? this._state.to : this._state.key;
    if (this.gm) {
      if (!(await this._gmAdd(p, to))) return;
    } else if (!playerSendSms(p.item, to, this._state.draft)) return;
    this._state.draft = "";
    if (this._state.view === "new") {
      this._state.view = "conv";
      this._state.key = keyFor(p.phone, to);
    }
    this._rerender();
  }

  /** GM: adds an entry to the history without sending anything (preparation). */
  async _gmAdd(p, to) {
    to = to?.trim();
    if (!to) return ui.notifications.warn(t("Warn.NoCorrespondent")), false;
    const key = keyFor(p.phone, to);
    const text = this._state.draft?.trim();
    const type = GM_ENTRY_TYPES[this._state.entryType] ?? GM_ENTRY_TYPES.smsIn;
    const att = type.kind === "sms" ? this._state.att : null;
    if (type.kind === "sms" && !text && !att) return ui.notifications.warn(t("Warn.Empty")), false;
    await addLog(p.item, { ...type.entry, with: key, ...(type.kind === "sms" ? { text } : {}), ...(att ? { att } : {}), read: true, prep: true });
    if (att) await grantAttachments([att], holders(p));
    this._state.att = null;
    return true;
  }

  _call() {
    this._readForm();
    const p = this._current();
    if (!p) return;
    const to = this._state.view === "new" ? this._state.to : this._state.key;
    if (!to?.trim()) return ui.notifications.warn(t("Warn.NameOrNumber"));
    playerCall(p.item, to);
  }

  /** Rotary dial: the digit is added to the number, the dial turns to the stop and back. */
  _dial(digit) {
    const input = this.element.querySelector("[name=to]");
    if (!input || digit === undefined) return;
    this._state.to = input.value += digit;
    if (!DIAL_DIGITS.includes(digit)) return;
    const angle = DIAL_ANGLE(digit) - DIAL_STOP;
    this.element.querySelector(".spt-rotor")?.animate(
      [{ transform: "rotate(0deg)" }, { transform: `rotate(${angle}deg)`, offset: 0.45 }, { transform: "rotate(0deg)" }],
      { duration: 250 + angle * 3, easing: "ease-in-out" }
    );
  }

  async _renderHTML() {
    const mine = this._mine();
    if (!mine.length) return `<p class="spt-phone-empty">${this.gm ? t("NoDevice") : t("NoPhone")}</p>`;
    const p = this._current();
    const prev = this._state.phoneUuid;
    if (prev && prev !== p.item.uuid) {
      // The displayed device is no longer reachable (the agent left the room, or it was removed).
      this._state.view = "list";
      this._state.key = null;
      const lost = fromUuidSync(prev);
      const lostPhone = getPhoneData(lost);
      if (!this.gm && lostPhone) ui.notifications.info(`📍 ${t("OutOfReach", { label: lostPhone.label })}`);
    }
    this._state.phoneUuid = p.item.uuid;

    if (!this.gm && p.phone.locked) return this._renderLocked(p, mine);
    if (!this.gm && isLandline(p.phone)) return this._renderDialer(p, mine);
    if (this._state.view === "conv") return this._renderConv(p);
    if (this._state.view === "new") return this._renderNew(p);
    return this._renderList(p, mine);
  }

  _renderLocked(p, mine) {
    const phoneSel = deviceSelect(mine, p, (q) => q.phone.label);
    const unread = unreadCount(p.phone);
    const federal = skinOf(p.phone) === "federal";
    return `<header class="spt-phone-top">${phoneSel}</header>
      <div class="spt-lockscreen">
        <i class="fas ${federal ? "fa-id-card" : "fa-lock"}"></i>
        <p>${federal ? t("Theme.IdRequired") : isComputer(p.phone) ? t("Lock.Session") : t("Warn.Locked")}</p>
        ${federal ? `<input type="text" class="spt-fake-login" placeholder="${t("Theme.AgentId")}" readonly><input type="password" class="spt-fake-login" placeholder="••••••••" readonly>` : ""}
        ${unread ? `<p class="spt-lock-notif">${tn("Unread", unread)}</p>` : ""}
      </div>`;
  }

  _renderHeader(p, mine) {
    const mode = p.phone.mode ?? "on";
    const phoneSel = deviceSelect(mine, p, (q) => (this.gm ? phoneLabel(q) : `${q.phone.label} · ${q.phone.number}`));
    const modeBtns = !this.gm && isFixed(p.phone) ? "" : Object.entries(MODES)
      .map(([k, m]) => `<button type="button" class="spt-mode ${k === mode ? "active" : ""}" data-mode="${k}" title="${m.label}"><i class="fas ${m.icon}"></i></button>`)
      .join("");
    const gmOffline = !this.gm && !game.users.activeGM;
    const signal = gmOffline
      ? `<span class="spt-signal off" title="${t("Net.GmAbsent")}">📵 <small>[${t("Net.GmAway")}]</small></span>`
      : hasSignal(p.phone)
        ? `<i class="fas fa-signal spt-signal" title="${t("Net.Signal")}"></i>`
        : `<span class="spt-signal off" title="${t("Net.NoSignalShort")}">📵</span>`;
    const gmTools = this.gm
      ? `<a data-action="gmContacts" title="${t("Contacts.Title")}" aria-label="${t("Contacts.Title")}"><i class="fas fa-address-book"></i></a><a data-action="gmItemSheet" title="${t("Sheet.ItemSheet")}" aria-label="${t("Sheet.ItemSheet")}"><i class="fas fa-file-lines"></i></a>`
      : "";
    return `<header class="spt-phone-top">${phoneSel}${signal}${gmTools}<div class="spt-modes">${modeBtns}</div></header>`;
  }

  _renderList(p, mine) {
    const convs = conversations(p.phone);
    const rows = convs
      .map((c) => {
        const last = c.entries[0];
        const preview = !last
          ? `<em>${t("NoMessage")}</em>`
          : last.kind === "sms"
            ? `${last.dir === "out" ? `${t("You")} : ` : ""}${last.att ? '<i class="fas fa-paperclip"></i> ' : ""}${esc(last.text || (last.att ? t("Attachment") : ""))}`
            : `<i class="fas fa-phone"></i> ${callLabel(last)}`;
        return `<li class="spt-conv ${c.unread ? "unread" : ""}" data-action="open" data-key="${esc(c.key)}">
            <div class="spt-conv-head"><strong>${esc(displayName(p.phone, c.key))}</strong></div>
            <div class="spt-conv-preview">${preview}</div>
            ${c.unread ? `<span class="spt-badge">${c.unread}</span>` : ""}
          </li>`;
      })
      .join("");
    return `${this._renderHeader(p, mine)}
      <ul class="spt-conv-list">${rows || `<li class="spt-phone-empty">${t("NoConversation")}</li>`}</ul>
      <footer class="spt-phone-foot"><button type="button" data-action="compose"><i class="fas fa-pen-to-square"></i> ${this.gm ? t("NewConversation") : isComputer(p.phone) ? t("NewMail") : msgOn(p.phone) ? t("NewMessage") : t("Dial")}</button></footer>`;
  }

  _renderConv(p) {
    const key = this._state.key;
    const entries = getLog(p.phone, { includePending: this.gm })
      .filter((e) => sameConv(p.phone, e.with, key))
      .reverse();
    const del = (e) => (this.gm ? `<a class="spt-del" data-action="gmDelete" data-id="${e.id ?? ""}" data-t="${e.t}" title="${t("Delete")}"><i class="fas fa-xmark"></i></a>` : "");
    // Player: show screen / forward, on each message.
    const share = (e) => {
      if (this.gm || e.pending) return "";
      const id = esc(e.id ?? String(e.t));
      return `<span class="spt-share"><a data-action="showEntry" data-id="${id}" title="${t("Share.ShowScreen")}"><i class="fas fa-eye"></i></a><a data-action="fwdEntry" data-id="${id}" title="${t("Fwd.Forward")}"><i class="fas fa-share"></i></a></span>`;
    };
    const fwdTag = (e) => (e.fwd ? `<span class="spt-fwd"><i class="fas fa-share"></i> ${t("Fwd.Forwarded")}</span>` : "");
    // Federal look: each email becomes a case file, with a stable reference and a stamp on received ones.
    const federal = skinOf(p.phone) === "federal";
    const fileTag = (e) => (federal ? `<span class="spt-ref">${t("Theme.Ref")} ${caseRef(e)}</span>${e.dir === "in" ? `<span class="spt-stamp">${t("Theme.Confidential")}</span>` : ""}` : "");
    const bubbles = entries
      .map((e) =>
        e.kind === "sms"
          ? `<div class="spt-bubble ${e.dir}">${fileTag(e)}${del(e)}${share(e)}${fwdTag(e)}${attHtml(e.att)}${e.text ? `<div>${nl2br(e.text)}</div>` : ""}${this.gm && e.dir === "in" && !e.prep ? `<span class="spt-read ${e.read === false ? "unread" : ""}">${e.pending ? t("Read.Pending") : e.read === false ? t("Read.Unread") : t("Read.Seen")}</span>` : ""}</div>`
          : `<div class="spt-call-line"><i class="fas ${e.result === "answer" ? "fa-phone" : "fa-phone-slash"}"></i> ${callLabel(e)} ${del(e)}</div>`
      )
      .join("");
    const masked = isMasked(key);
    const composer = this.gm
      ? this._gmComposer(2)
      : !msgOn(p.phone)
      ? ""
      : masked
      ? `<p class="spt-phone-empty">${t("Warn.CantReplyMasked")}</p>`
      : `<div class="spt-composer"><textarea name="draft" rows="2" placeholder="${t("MessagePlaceholder")}">${esc(this._state.draft)}</textarea>
           <button type="button" data-action="send" title="${t("Send")}"><i class="fas fa-paper-plane"></i></button></div>`;
    return `<header class="spt-phone-top conv">
        <a data-action="back" title="${t("Back")}"><i class="fas fa-chevron-left"></i></a>
        <strong>${esc(displayName(p.phone, key))}</strong>
        <span class="spt-top-actions">${this.gm || !entries.length ? "" : `<a data-action="showConv" title="${t("Share.ShowConversation")}"><i class="fas fa-eye"></i></a>`}${masked || this.gm || modelOf(p.phone).noCalls ? "" : `<a data-action="call" title="${t("Call.Call")}"><i class="fas fa-phone"></i></a>`}</span>
      </header>
      <div class="spt-thread ${isComputer(p.phone) ? "mail" : ""}">${bubbles || `<p class="spt-phone-empty">${t("NoMessage")}.</p>`}</div>
      ${composer}`;
  }

  /** Landline on the player side: a plain dial, no history or contacts. */
  _renderDialer(p, mine) {
    this._state.view = "new";
    return `${this._renderHeader(p, mine)}
      <div class="spt-new spt-dialer">
        ${skinOf(p.phone) === "modern" ? "" : rotaryDial(p.phone.number)}
        <div class="spt-dial-strip">
          <input type="text" name="to" value="${esc(this._state.to)}" placeholder="${t("Number")}" autocomplete="off">
          <button type="button" data-action="dialBack" title="${t("Delete")}"><i class="fas fa-delete-left"></i></button>
        </div>
        ${skinOf(p.phone) === "modern" ? keypad() : ""}
        <div class="spt-phone-row"><button type="button" data-action="call"><i class="fas fa-phone"></i> ${t("Call.Call")}</button></div>
      </div>`;
  }

  _renderNew(p) {
    const known = conversations(p.phone)
      .filter((c) => !isMasked(c.key))
      .map((c) => `<option value="${esc(displayName(p.phone, c.key))}">`)
      .join("");
    return `<header class="spt-phone-top conv">
        <a data-action="back" title="${t("Back")}"><i class="fas fa-chevron-left"></i></a>
        <strong>${this.gm ? t("NewConversation") : isComputer(p.phone) ? t("NewMail") : t("NewMessage")}</strong><span></span>
      </header>
      <div class="spt-new">
        <input type="text" name="to" list="spt-known" value="${esc(this._state.to)}" placeholder="${this.gm ? t("Gm.CorrespondentPlaceholder") : t("ToPlaceholder")}">
        <datalist id="spt-known">${known}</datalist>
        ${this.gm
          ? this._gmComposer(5)
          : `${msgOn(p.phone) ? `<textarea name="draft" rows="${isComputer(p.phone) ? 9 : 5}" placeholder="${isComputer(p.phone) ? t("MailPlaceholder") : t("MessagePlaceholder")}">${esc(this._state.draft)}</textarea>` : ""}
        <div class="spt-phone-row">
          ${msgOn(p.phone) ? `<button type="button" data-action="send"><i class="fas fa-paper-plane"></i> ${t("Send")}</button>` : ""}
          ${modelOf(p.phone).noCalls ? "" : `<button type="button" data-action="call"><i class="fas fa-phone"></i> ${t("Call.Call")}</button>`}
        </div>`}
      </div>`;
  }

  /** GM: writes into the history (nothing is sent, no notification). */
  _gmComposer(rows) {
    const cur = this._current()?.phone;
    const types = Object.entries(GM_ENTRY_TYPES).filter(([, ty]) => (ty.kind === "call" ? !modelOf(cur).noCalls : msgOn(cur)));
    if (!types.some(([k]) => k === this._state.entryType)) this._state.entryType = types[0][0];
    const opts = types
      .map(([k, ty]) => `<option value="${k}" ${k === this._state.entryType ? "selected" : ""}>${ty.label}</option>`)
      .join("");
    return `<div class="spt-gm-composer spt-drop" title="${t("DropHere")}">
        <select name="entryType">${opts}</select>
        ${attChipHtml(this._state.att)}
        <textarea name="draft" rows="${rows}" placeholder="${t("Prep.TextPlaceholder")}">${esc(this._state.draft)}</textarea>
        <div class="spt-phone-row">
          <button type="button" data-action="attach" title="${t("AttachImage")}" class="spt-icon-btn"><i class="fas fa-paperclip"></i></button>
          <button type="button" data-action="send"><i class="fas fa-plus"></i> ${t("Prep.Add")}</button>
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    PlayerPhone.instance = this;
    const cur = this._current();
    const skin = cur ? skinOf(cur.phone) : null;
    for (const k of SKINS) this.element.classList.toggle(`spt-skin-${k}`, k === skin);
    this.element.classList.toggle("spt-gm-view", this.gm);
    const el = this.element;
    // Banners: GM preparation, secure device.
    const content = el.querySelector(".window-content");
    const banner = { military: "Theme.Classified", federal: "Theme.GovSystem" }[skin];
    if (content && banner) content.insertAdjacentHTML("afterbegin", `<div class="spt-banner">${t(banner)}</div>`);
    if (content && this.gm && cur) content.insertAdjacentHTML("beforeend", `<div class="spt-gm-ribbon"><i class="fas fa-pen"></i> ${t("Theme.GmView")}</div>`);
    if (!this.gm && cur && isLandline(cur.phone)) {
      el.querySelector("[name=to]")?.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); this._call(); }
      });
    }
    const p = this._current();
    for (const a of el.querySelectorAll("[data-att-img], [data-att-doc]")) a.addEventListener("click", () => openAttachment(a, this._current()?.item));
    if (this.gm) {
      bindDrop(el.querySelector(".spt-drop"), (att) => {
        this._readForm();
        this._state.att = att;
        this._rerender();
      });
    }

    bindIconSelects(el);
    el.querySelector("[data-phone-select]")?.addEventListener("change", (ev) => {
      this._state.phoneUuid = ev.currentTarget.value;
      saveLastDevice(ev.currentTarget.value);
      this._go("list");
    });
    for (const btn of el.querySelectorAll("[data-mode]")) {
      btn.addEventListener("click", () => p?.item.update({ [`flags.${MODULE_ID}.phone.mode`]: btn.dataset.mode }));
    }
    // Enter = send, Shift+Enter = new line
    el.querySelector("[name=draft]")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        this._send();
      }
    });
    const thread = el.querySelector(".spt-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
    if (this._state.view === "new" && !this._state.to) el.querySelector("[name=to]")?.focus();
    else if (this._state.view !== "list") el.querySelector("[name=draft]")?.focus();

    // Opening a conversation marks it as read.
    if (p && !this.gm && this._state.view === "conv") {
      const key = this._state.key;
      const hasUnread = getLog(p.phone).some((e) => isUnread(e) && sameConv(p.phone, e.with, key));
      if (hasUnread) {
        // All history writes go through the GM's browser (no collision).
        if (game.users.activeGM) game.socket.emit(SOCKET, { type: "playerRead", itemUuid: p.item.uuid, key, userId: game.user.id });
        else if (p.item.isOwner) markRead(p.item, key);
      }
    }
  }
}

/* Rotary dial (landline): 1 at the top right, then counter-clockwise; finger stop between 0 and 1. */
const DIAL_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const DIAL_STOP = 15;
const DIAL_ANGLE = (d) => 60 + 30 * DIAL_DIGITS.indexOf(d);

/** Stable case reference, derived from the message id (e.g. 27-B-4417). */
function caseRef(e) {
  let h = 0;
  for (const c of String(e.id ?? e.t)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${10 + (h % 90)}-${"ABCDFGHKMNPRST"[(h >>> 7) % 14]}-${String((h >>> 11) % 10000).padStart(4, "0")}`;
}

/** Push-button keypad (modern landline, 1980-2020). */
export function keypad() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return `<div class="spt-keypad">${keys.map((k) => `<button type="button" data-action="dial" data-digit="${k}">${k}</button>`).join("")}</div>`;
}

export function rotaryDial(number) {
  const pos = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), -r * Math.sin((deg * Math.PI) / 180)].map((v) => v.toFixed(1));
  const holes = DIAL_DIGITS.map((d) => ({ d, xy: pos(DIAL_ANGLE(d), 68) }));
  const [s1, s2] = [pos(DIAL_STOP, 80), pos(DIAL_STOP, 99)];
  return `<svg class="spt-rotary" viewBox="-100 -100 200 200" aria-label="${t("Number")}">
      <defs><mask id="spt-holes"><rect x="-100" y="-100" width="200" height="200" fill="#fff"/>${holes.map((h) => `<circle cx="${h.xy[0]}" cy="${h.xy[1]}" r="14" fill="#000"/>`).join("")}<circle r="40" fill="#000"/></mask>
        <radialGradient id="spt-bakelite" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#4a4541"/><stop offset="0.55" stop-color="#1b1917"/><stop offset="1" stop-color="#0c0b0a"/></radialGradient></defs>
      <circle class="spt-dial-plate" r="96"/>
      ${holes.map((h) => `<text class="spt-dial-digit" x="${h.xy[0]}" y="${h.xy[1]}">${h.d}</text>`).join("")}
      <g class="spt-rotor"><circle r="92" fill="url(#spt-bakelite)" mask="url(#spt-holes)"/></g>
      <circle class="spt-dial-card" r="38"/>
      <text class="spt-dial-number" y="4">${esc(number ?? "")}</text>
      <line class="spt-dial-stop" x1="${s1[0]}" y1="${s1[1]}" x2="${s2[0]}" y2="${s2[1]}"/>
      ${holes.map((h) => `<circle class="spt-dial-hole" data-action="dial" data-digit="${h.d}" cx="${h.xy[0]}" cy="${h.xy[1]}" r="15"><title>${h.d}</title></circle>`).join("")}
    </svg>`;
}

/** Entry types the GM can write into a history (preparation). */
export const GM_ENTRY_TYPES = {
  smsIn: { get label() { return t("Prep.smsIn"); }, kind: "sms", entry: { kind: "sms", dir: "in" } },
  smsOut: { get label() { return t("Prep.smsOut"); }, kind: "sms", entry: { kind: "sms", dir: "out" } },
  callMissed: { get label() { return t("Prep.callMissed"); }, kind: "call", entry: { kind: "call", dir: "in", result: "missed" } },
  callIn: { get label() { return t("Prep.callIn"); }, kind: "call", entry: { kind: "call", dir: "in", result: "answer" } },
  callOut: { get label() { return t("Prep.callOut"); }, kind: "call", entry: { kind: "call", dir: "out", result: "answer" } }
};

export function callLabel(e) {
  if (e.dir === "out") {
    const out = ["answer", "voicemail", "unassigned", "unreachable", "cancelled"];
    return t(`CallLog.out.${out.includes(e.result) ? e.result : "noanswer"}`);
  }
  return t(`CallLog.in.${["answer", "decline"].includes(e.result) ? e.result : "missed"}`);
}

