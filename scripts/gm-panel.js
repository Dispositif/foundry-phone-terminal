import { attChipHtml, attFromDrop, pickImage } from "./attachments.js";
import { ApplicationV2, DialogV2, HandlebarsApplicationMixin, MASKED, MODES, MODULE_ID } from "./constants.js";
import { allPhones, holders, sharedUsers, displayName, getLog, getPhoneData, hasSignal, holderName, inDeadZone, isFixed, keyFor, modelOf, msgOn, patchLog, phoneLabel, sameConv, unmarkPhone, unreadCount, modeOf, gmName, isUnknownNumber, npcDirectory, findNpc } from "./devices.js";
import { contactsDialog, directoryDialog, editPhoneDialog, giveDialog, newPhoneDialog } from "./dialogs.js";
import { copyJournalLink } from "./journal-links.js";
import { openPhone } from "./main.js";
import { sendSms } from "./messages.js";
import { hangUpAll, pendingCalls, ring } from "./ring.js";
import { esc, isMasked, nl2br, norm } from "./util.js";
import { t, tn } from "./i18n.js";
/* -------------------------------------------- */
/*  GM panel                                    */
/* -------------------------------------------- */


/** Drop zone for an attachment. */
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

/** Messages sent by players to NPCs (the GM's "inbox"). */
/** Bubbles shown per thread in the GM inbox. */
const INBOX_BUBBLES = 6;

/** Attachment in a GM inbox bubble: thumbnail or journal name. */
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

/** Device selector: model icon on the left, updated on change. */
export function deviceSelect(mine, p, labelFn) {
  if (mine.length <= 1) {
    return `<div class="spt-icon-select"><i class="fas ${modelOf(p.phone).icon}"></i> <strong>${esc(labelFn(p))}</strong></div>`;
  }
  const opts = mine
    .map((q) => `<option value="${q.item.uuid}" data-icon="${modelOf(q.phone).icon}" ${q.item.uuid === p.item.uuid ? "selected" : ""}>${esc(labelFn(q))}</option>`)
    .join("");
  return `<div class="spt-icon-select spt-phone-select"><i class="fas ${modelOf(p.phone).icon}"></i><select data-phone-select data-icon-select>${opts}</select></div>`;
}

/** Syncs the icon placed before each <select data-icon-select>. */
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

/** How precisely the network can place a device: carried, switched on, with signal. */
/** model -> [precision, how the network places it] */
const TRACK_LEVEL = { smartphone: ["high", "gps"], computer: ["high", "wifi"], mobile: ["medium", "gsm"], pager: ["low", "gsm"] };
const TRACK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

/**
 * One group per agent (player characters, and any player-owned actor carrying a device):
 * the devices the network can locate and the best precision.
 * An agent with nothing locatable is listed too: precision none, location unknown.
 */
function trackingRows(phones) {
  const agents = new Map();
  for (const u of game.users) if (!u.isGM && u.character) agents.set(u.character.id, u.character);
  for (const p of phones) if (p.actor?.hasPlayerOwner) agents.set(p.actor.id, p.actor);
  return [...agents.values()]
    .map((actor) => {
      const devices = phones
        .filter((p) => p.actor?.id === actor.id && TRACK_LEVEL[p.phone.model] && modeOf(p.phone) !== "off" && hasSignal(p.phone))
        .map((p) => {
          const [level, via] = TRACK_LEVEL[p.phone.model];
          return { icon: modelOf(p.phone).icon, modelLabel: modelOf(p.phone).label, label: p.phone.label, level, via, compromised: !!p.phone.compromised };
        })
        .sort((a, b) => TRACK_ORDER[a.level] - TRACK_ORDER[b.level]);
      for (const d of devices) d.levelLabel = `${t(`Track.${d.level}`)} (${t(`Track.Via.${d.via}`)})`;
      const level = devices[0]?.level ?? "none";
      return {
        agent: actor.name,
        img: actor.img,
        level,
        levelLabel: t(`Track.${level}`),
        location: level !== "none" ? "" : inDeadZone(actor) ? t("Track.DeadZone") : t("Track.Unknown"),
        devices
      };
    })
    .sort((a, b) => TRACK_ORDER[a.level] - TRACK_ORDER[b.level] || a.agent.localeCompare(b.agent));
}

export class PhonePanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "spt-phone-panel",
    tag: "form",
    classes: ["spt-phone-panel"],
    window: { title: "Phones & Computers", icon: "fas fa-tower-cell", resizable: true },
    position: { width: 460, height: 620 },
    form: { handler: () => {}, submitOnChange: false, closeOnSubmit: false },
    actions: {
      switchTab: function (event, target) { this._focusSend = true; this._setState({ tab: target.dataset.tab }); },
      mode: function (event, target) { this._focusSend = true; this._setState({ mode: target.dataset.mode }); },
      ring: function () { this._doRing(); },
      hangup: function () { hangUpAll(); },
      sms: function () { this._doSms(); },
      newPhone: function () { newPhoneDialog(); },
      directory: function () { directoryDialog(); },
      editPhone: async function (event, target) { editPhoneDialog(await fromUuid(target.dataset.uuid)); },
      contacts: async function (event, target) { contactsDialog(await fromUuid(target.dataset.uuid)); },
      give: async function (event, target) { giveDialog(await fromUuid(target.dataset.uuid)); },
      openPhone: function (event, target) { openPhone(target.dataset.uuid); },
      unmarkPhone: async function (event, target) {
        // Removing the device deletes the item. "Keep the item" only removes the device function.
        const item = await fromUuid(target.dataset.uuid);
        const choice = await DialogV2.wait({
          window: { title: t("Unmark.Title"), icon: "fas fa-trash" },
          content: `<p>${t("Unmark.Confirm", { name: esc(item.name) })}</p>`,
          buttons: [
            { action: "delete", label: t("Unmark.Delete"), icon: "fas fa-trash", default: true },
            { action: "keep", label: t("Unmark.Keep"), icon: "fas fa-box" },
            { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark" }
          ],
          rejectClose: false
        });
        if (choice === "delete") await item.delete();
        else if (choice === "keep") await unmarkPhone(item);
      },
      selectPhone: function (event, target) {
        // Clicking a device makes it the recipient and opens the Send tab.
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
      toggleCompromised: async function (event, target) {
        const item = await fromUuid(target.dataset.uuid);
        await item.update({ [`flags.${MODULE_ID}.phone.compromised`]: !getPhoneData(item)?.compromised });
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

  static recentSenders = [];

  _state = { target: null, sender: "", text: "", att: null, tab: "send", mode: "message", drafts: {} };

  /** Changes the state (tab, mode, recipient…) while keeping the current input. */
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
    // Keep the current input before any re-render (actions may change _state afterwards).
    if (this.rendered && !this._skipRead) this._readForm();
    this._skipRead = false;
    return super.render(...args);
  }

  /** Template data: everything is computed here, the template only displays. */
  async _prepareContext() {
    const phones = allPhones().sort((a, b) => phoneLabel(a).localeCompare(phoneLabel(b)));
    const players = game.users.filter((u) => !u.isGM);
    const countByNumber = phones.reduce((m, p) => m.set(norm(p.phone.number), (m.get(norm(p.phone.number)) ?? 0) + 1), new Map());

    // Recipients: one line per number, however it is written (555-133 = 555133).
    // Order: agents' devices first, then other carried devices, then fixed ones (by label within each group).
    const rank = (p) => (isFixed(p.phone) ? 2 : p.actor?.hasPlayerOwner ? 0 : 1);
    const byRank = [...phones].sort((a, b) => rank(a) - rank(b));
    const numbers = [...new Map(byRank.map((p) => [norm(p.phone.number), p.phone.number])).values()];
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

    // Agents' messages: one thread per device and NPC correspondent, most recent first.
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
        to: gmName(th.phone, th.key),
        unknown: isUnknownNumber(th.phone, th.key),
        compromised: !!th.phone.compromised,
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

    // Devices grouped: by holder, then by place, then "held by nobody".
    const groups = new Map();
    const groupOf = (p) => {
      if (isFixed(p.phone)) {
        const scene = game.scenes.get(p.phone.sceneId);
        return { key: `s:${p.phone.sceneId}`, order: 1, name: scene?.name ?? t("NoPlace"), img: scene?.thumb ?? null, icon: "fa-location-dot" };
      }
      if (p.actor) return { key: `a:${p.actor.id}`, order: 0, name: p.actor.name, img: p.actor.img, icon: "fa-user" };
      const shared = sharedUsers(p.item);
      if (shared.length) return { key: "shared", order: 2, name: t("Gm.Shared"), img: null, icon: "fa-users" };
      return { key: "none", order: 3, name: t("Gm.Nobody"), img: null, icon: "fa-ghost" };
    };
    for (const p of phones) {
      const g = groupOf(p);
      if (!groups.has(g.key)) groups.set(g.key, { ...g, devices: [] });
      const model = modelOf(p.phone);
      const mode = MODES[modeOf(p.phone)] ?? MODES.on;
      const fixed = isFixed(p.phone);
      const unread = unreadCount(p.phone);
      groups.get(g.key).devices.push({
        uuid: p.item.uuid,
        number: p.phone.number,
        label: p.phone.label,
        icon: model.icon,
        modelLabel: model.label,
        modeIcon: fixed || modeOf(p.phone) === "on" ? null : mode.icon,
        modeLabel: mode.label,
        fixed,
        locked: !!p.phone.locked,
        compromised: !!p.phone.compromised,
        noSignal: !fixed && !!p.phone.noSignal,
        cloned: countByNumber.get(norm(p.phone.number)) > 1,
        unread,
        unreadTitle: unread ? tn("Gm.UnreadByPlayer", unread) : ""
      });
    }
    const sortedGroups = [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    // What the chosen recipient accepts: only the possible forms are shown.
    const [kind, id] = (this._state.target ?? "").split(/:(.*)/s);
    const tp = kind === "phone" ? phones.filter((p) => norm(p.phone.number) === norm(id)) : [];
    const canMessage = kind === "phone" ? tp.some((p) => msgOn(p.phone)) : kind === "user";
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
      senderOptions: this._senderOptions(phones, kind, id),
      text: this._state.text,
      attChip: attChipHtml(this._state.att),
      inbox,
      inboxUnread: inboxAll.filter((x) => x.e.seen === false).length,
      groups: sortedGroups,
      deviceCount: phones.length,
      tracking: this._state.tab === "tracking" ? trackingRows(phones) : []
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

  /** Inline reply in a thread: sent as the NPC, and the thread is marked read. */
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
    this._rememberSender();
    ring(this._state.target, { caller: this._normSender() });
  }

  /**
   * Sender suggestions: hidden number, the recipient's contacts, recent senders, other devices.
   * The field stays free text; a contact name is turned into its number on the recipient's side.
   */
  _senderOptions(phones, kind, id) {
    const recipient = kind === "phone"
      ? phones.filter((p) => norm(p.phone.number) === norm(id))
      : phones.filter((p) => !isFixed(p.phone) && holders(p).some((u) => u.id === id));
    const opts = new Map();
    const add = (value, label = "") => {
      if (value && !opts.has(norm(value))) opts.set(norm(value), { value, label });
    };
    add(t("Masked"));
    // NPC directory first: the value is the number, so a secret NPC shows as a number on the agent's side.
    for (const e of npcDirectory()) add(e.number || e.name, e.number ? `${e.name} · ${t("Directory.Title")}` : t("Directory.Title"));
    for (const p of recipient) for (const c of p.phone.contacts ?? []) add(c.name, c.number ? `${c.number} · ${t("Gm.InContacts")}` : t("Gm.InContacts"));
    for (const s of PhonePanel.recentSenders) add(s, t("Gm.Recent"));
    const mine = new Set(recipient.map((p) => p.item.uuid));
    for (const p of phones) if (!mine.has(p.item.uuid)) add(p.phone.number, phoneLabel(p));
    return [...opts.values()];
  }

  /** Remembers the last senders used (this session only). */
  _rememberSender() {
    const s = this._state.sender.trim();
    if (!s || isMasked(s)) return;
    PhonePanel.recentSenders = [s, ...PhonePanel.recentSenders.filter((x) => norm(x) !== norm(s))].slice(0, 5);
  }

  /** Typed sender; "Hidden number" (in any language) is stored in its internal form. */
  _normSender() {
    const s = this._state.sender.trim();
    if (!s || isMasked(s)) return MASKED;
    // A directory NPC typed by name is sent from its number (the agent sees the number unless they know it).
    const npc = findNpc(s, { all: true });
    return npc?.number || s;
  }

  async _doSms() {
    this._readForm();
    if (!this._state.target) return ui.notifications.warn(t("Warn.NoRecipient"));
    this._rememberSender();
    await sendSms(this._state.target, this._state.text, { sender: this._normSender(), att: this._state.att });
    this._state.text = "";
    this._state.att = null;
    this._skipRead = true;
    this.render();
  }
}

