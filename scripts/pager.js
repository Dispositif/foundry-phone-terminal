import { ApplicationV2, MODES, MODULE_ID, SOCKET } from "./constants.js";
import { getLog, getPhoneData, hasSignal, isUnread, markEntryRead, modeOf } from "./devices.js";
import { esc } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Pager (player side): its own small window   */
/* -------------------------------------------- */

const MODE_CYCLE = { on: "silent", silent: "off", off: "on" };

/** Received pages, newest first. */
function pages(phone) {
  return getLog(phone).filter((e) => e.kind === "sms" && e.dir === "in");
}

/**
 * One window per pager, next to the phone window: a one-line screen,
 * ◀ ▶ to browse the history, a red light while a page is unread.
 */
export class PagerWindow extends ApplicationV2 {
  static windows = new Map(); // item uuid -> window

  static DEFAULT_OPTIONS = {
    classes: ["spt-player-phone", "spt-pager-window", "spt-skin-pager", "spt-framed", "spt-frame-pager"],
    window: { title: "Pager", icon: "fas fa-pager", resizable: false },
    position: { width: 250, height: 168 },
    actions: {
      newer: function () { this._move(-1); },
      older: function () { this._move(1); },
      read: function () { this._markShown(); },
      mode: function () {
        const item = this.item;
        const phone = getPhoneData(item);
        if (phone) item.update({ [`flags.${MODULE_ID}.phone.mode`]: MODE_CYCLE[modeOf(phone)] ?? "on" });
      }
    }
  };

  constructor(uuid, options = {}) {
    super({ ...options, id: `spt-pager-${uuid.replace(/[^\w-]/g, "-")}` });
    this.uuid = uuid;
    this.idx = 0;
  }

  get item() {
    return fromUuidSync(this.uuid);
  }

  get title() {
    return getPhoneData(this.item)?.label ?? t("Model.pager");
  }

  /** Any key press (or a click on the screen) acknowledges the page on screen: the red light goes off. */
  _move(step) {
    this._markShown();
    const n = pages(getPhoneData(this.item)).length;
    this.idx = Math.max(0, Math.min(n - 1, this.idx + step));
    this._markShown();
    this.render();
  }

  _markShown() {
    const phone = getPhoneData(this.item);
    if (!phone || modeOf(phone) === "off") return;
    const e = pages(phone)[this.idx];
    if (!e || !isUnread(e)) return;
    // History writes go through the GM's browser.
    if (game.users.activeGM) game.socket.emit(SOCKET, { type: "playerRead", itemUuid: this.uuid, entryId: e.id, userId: game.user.id });
    else if (this.item?.isOwner) markEntryRead(this.item, e.id);
  }

  async _renderHTML() {
    const phone = getPhoneData(this.item);
    if (!phone) return `<div class="spt-pager-lcd off"></div>`;
    const mode = modeOf(phone);
    const list = pages(phone);
    this.idx = Math.max(0, Math.min(list.length - 1, this.idx));
    const e = list[this.idx];
    const off = mode === "off";
    const unread = list.some(isUnread);
    const net = hasSignal(phone) && game.users.activeGM ? "" : `<i class="fas fa-signal spt-signal off" title="${t("Net.NoSignalShort")}"></i>`;
    const line = off ? "" : e ? e.text : t("Pager.Empty");
    return `<div class="spt-pager-lcd ${off ? "off" : ""}">
        <div class="spt-pager-status">
          <a data-action="mode" title="${MODES[mode].label}"><i class="fas ${MODES[mode].icon}"></i></a>
          ${net}
          <span>${!off && unread ? `<i class="fas fa-envelope"></i>` : ""}</span>
          <span class="spt-pager-pos">${!off && list.length ? `${this.idx + 1}/${list.length}` : ""}</span>
        </div>
        <div class="spt-pager-line ${e || off ? "" : "empty"}" data-action="read">${esc(line)}</div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    const content = el.querySelector(".window-content");
    if (content && !el.querySelector(".spt-frame-deco")) {
      content.insertAdjacentHTML("beforebegin", `<span class="spt-frame-deco spt-pager-clip"></span>`);
      content.insertAdjacentHTML(
        "afterend",
        `<div class="spt-frame-deco spt-pager-keys">
          <button type="button" data-action="newer" title="${t("Pager.Newer")}"><i class="fas fa-caret-left"></i></button>
          <button type="button" data-action="older" title="${t("Pager.Older")}"><i class="fas fa-caret-right"></i></button>
          <span class="spt-pager-led"></span>
        </div>`
      );
    }
    const phone = getPhoneData(this.item);
    const list = phone ? pages(phone) : [];
    const off = !phone || modeOf(phone) === "off";
    el.querySelector(".spt-pager-led")?.classList.toggle("on", !off && list.some(isUnread));
  }

  _onClose(options) {
    super._onClose?.(options);
    PagerWindow.windows.delete(this.uuid);
  }
}

/** Opens (or brings forward) a pager's window; latest = back to the newest page. */
export function openPager(uuid, { latest = false } = {}) {
  if (!uuid || !getPhoneData(fromUuidSync(uuid))) return null;
  let w = PagerWindow.windows.get(uuid);
  if (!w) {
    w = new PagerWindow(uuid);
    PagerWindow.windows.set(uuid, w);
  }
  if (latest) w.idx = 0;
  w.render({ force: true });
  if (w.rendered) w.bringToFront?.();
  return w;
}

export function rerenderPagers() {
  for (const w of PagerWindow.windows.values()) if (w.rendered) w.render();
}
