import { MODULE_ID, SMS_SRC, VIBRATE_SRC } from "./constants.js";
import { markEntryRead, markRead } from "./devices.js";
import { openPager } from "./pager.js";
import { onPlayerCall, onPlayerHangup, onPlayerSms, senderHolds } from "./gm-actions.js";
import { activeCall, endCall, onCallResult, receiveNearbyCall, receiveNearbyRing, receiveRing, stopNearbyRing } from "./player-calls.js";
import { onResponse } from "./ring.js";
import { closeDial, endLive, openDial, openLive, openRinging } from "./live-call.js";
import { receiveShow } from "./share.js";
import { onDocRequest, onFileContent, onFileRequest } from "./files.js";
import { onJamSound, onJammerRequest } from "./jammer.js";
import { isActiveGM, playLocal } from "./util.js";
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
      openRinging(data);
      break;
    case "callNearby":
      receiveNearbyCall(data);
      openDial(data);
      break;
    case "ringNearbyStop":
    case "nearbyStop":
      stopNearbyRing(data);
      closeDial(data.callId);
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
        // No notice: the player sees the signal and the new messages on the device itself.
        if (data.bip && data.sms) playLocal(data.notif ? `modules/${MODULE_ID}/sounds/${data.notif}` : SMS_SRC);
        if (data.open) openPager(data.open, { latest: true });
      }
      break;
    case "liveStart":
      openLive(data, { answered: true });
      break;
    case "liveEnd":
      endLive(data.callId, data.reason);
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
    case "show":
      if (data.targetUserIds?.includes(game.user.id)) receiveShow(data);
      break;
    case "playerRead":
      if (isActiveGM()) {
        const item = fromUuidSync(data.itemUuid);
        if (item && senderHolds(item, data.userId)) data.entryId ? markEntryRead(item, data.entryId) : markRead(item, data.key);
      }
      break;
    case "fileRequest":
      if (isActiveGM()) onFileRequest(data);
      break;
    case "docRequest":
      if (isActiveGM()) onDocRequest(data);
      break;
    case "fileContent":
      if (forMe) onFileContent(data);
      break;
    case "jamSound":
      onJamSound();
      break;
    case "jammer":
      if (isActiveGM()) onJammerRequest(data);
      break;
    case "playerHangup":
      if (isActiveGM()) onPlayerHangup(data);
      break;
  }
}

