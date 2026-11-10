import { onPlayerAccess } from "./attachments.js";
import { MODULE_ID, SMS_SRC, VIBRATE_SRC } from "./constants.js";
import { markEntryRead, markRead } from "./devices.js";
import { openPager } from "./pager.js";
import { onPlayerCall, onPlayerHangup, onPlayerSms, senderHolds } from "./gm-actions.js";
import { activeCall, endCall, onCallResult, receiveNearbyCall, receiveNearbyRing, receiveRing, stopNearbyRing } from "./player-calls.js";
import { onResponse } from "./ring.js";
import { receiveShow } from "./share.js";
import { isActiveGM, playLocal } from "./util.js";
import { t, tn } from "./i18n.js";
/* -------------------------------------------- */
/*  Socket                                      */
/* -------------------------------------------- */

export function onSocket(data) {
  const forMe = data.targetUserId === game.user.id;
  switch (data.type) {
    case "ring":
      if (forMe) receiveRing(data);
      break;
    case "ringNearby":
      receiveNearbyRing(data);
      break;
    case "callNearby":
      receiveNearbyCall(data);
      break;
    case "ringNearbyStop":
    case "nearbyStop":
      stopNearbyRing(data);
      break;
    case "cancel":
      if (forMe && activeCall?.callId === data.callId) endCall("cancelled");
      break;
    case "sms":
      if (forMe) {
        playLocal(data.silent ? VIBRATE_SRC : data.notif ? `modules/${MODULE_ID}/sounds/${data.notif}` : SMS_SRC);
        if (data.open) openPager(data.open, { latest: true });
      }
      break;
    case "callResult":
      if (forMe) onCallResult(data);
      break;
    case "signalBack":
      if (forMe) {
        const parts = [];
        if (data.sms) parts.push(tn("Net.NewMessages", data.sms));
        if (data.calls) parts.push(tn("Net.MissedCalls", data.calls));
        ui.notifications.info(`📶 ${data.label} : ${t("Net.Back")} — ${parts.join(", ")}.`);
        if (data.bip && data.sms) playLocal(data.notif ? `modules/${MODULE_ID}/sounds/${data.notif}` : SMS_SRC);
        if (data.open) openPager(data.open, { latest: true });
      }
      break;
    case "response":
      if (game.user.isGM) onResponse(data);
      break;
    case "playerSms":
      if (isActiveGM()) onPlayerSms(data);
      break;
    case "playerCall":
      if (isActiveGM()) onPlayerCall(data);
      break;
    case "playerAccess":
      if (isActiveGM()) onPlayerAccess(data);
      break;
    case "show":
      if (data.targetUserIds?.includes(game.user.id)) receiveShow(data);
      break;
    case "playerRead":
      if (isActiveGM()) {
        const item = fromUuidSync(data.itemUuid);
        if (item && senderHolds(item, data.userId)) data.entryId ? markEntryRead(item, data.entryId) : markRead(item, data.key);
      }
      break;
    case "playerHangup":
      if (isActiveGM()) onPlayerHangup(data);
      break;
  }
}

