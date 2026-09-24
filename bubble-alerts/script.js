// Settings configuration
const urlParams = new URLSearchParams(window.location.search);
const font = urlParams.get("font");
const size = urlParams.get("size");
const duration = Number(urlParams.get("duration") ?? 3);
const alignRight = urlParams.get("alignRight") !== "false";
const appearance = urlParams.get("appearance") || "light";
const soundEnabled = urlParams.get("soundEnabled") !== "false";

const twitchFollow = urlParams.get("twitchFollow") !== "false";
const twitchSub = urlParams.get("twitchSub") !== "false";
const twitchBits = urlParams.get("twitchBits") !== "false";
const twitchRaid = urlParams.get("twitchRaid") !== "false";
const twitchWatchStreak = urlParams.get("twitchWatchStreak") !== "false";

const youtubeSub = urlParams.get("youtubeSub") !== "false";
const youtubeMembership = urlParams.get("youtubeMembership") !== "false";
const youtubeSuperChat = urlParams.get("youtubeSuperChat") !== "false";
const youtubeSuperSticker = urlParams.get("youtubeSuperSticker") !== "false";

const kickFollow = urlParams.get("kickFollow") !== "false";
const kickSub = urlParams.get("kickSub") !== "false";
const kickKicks = urlParams.get("kickKicks") !== "false";
const kickHost = urlParams.get("kickHost") !== "false";

const usingTikfinity = urlParams.get("usingTikfinity") !== "false";
const tiktokFollow = urlParams.get("tiktokFollow") !== "false";
const tiktokGift = urlParams.get("tiktokGift") !== "false";
const tiktokSuperFan = urlParams.get("tiktokSuperFan") !== "false";

const sbAddress = urlParams.get("address") || "127.0.0.1";
const sbPort = urlParams.get("port") || "8080";

if (font) document.body.style.fontFamily = font;
if (size) document.documentElement.style.setProperty("--alert-scale", `${size}px`);
if (appearance === "dark") document.body.classList.add("dark");

// Global Variables
const kickPusherWsUrl = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false';
let streamerbotConnected = false;
let tikfinityConnected = false;
let alertQueue = [];
let isAlertShowing = false;
const toastQueue = [];
let toastActive = false;
let socket;

// Disable animations while the OBS source/tab isn't visible so nothing
// pauses mid-flight and "chases" to completion once it becomes visible again.
function applyHiddenAnimState() {
  document.documentElement.classList.toggle("tab-hidden", document.hidden);
}
document.addEventListener("visibilitychange", applyHiddenAnimState);
applyHiddenAnimState();

// Runs `callback` once, after `el` finishes/cancels its CSS animation —
// or immediately if the document is (or becomes) hidden, since animations
// are disabled while hidden and won't fire animationend on their own.
function runAfterAnim(el, expectedMs, callback) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.removeEventListener("animationend", finish);
    el.removeEventListener("animationcancel", finish);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    callback();
  };

  function onVisibilityChange() {
    if (document.hidden) finish();
  }

  if (document.hidden) {
    finish();
    return;
  }

  el.addEventListener("animationend", finish, { once: true });
  el.addEventListener("animationcancel", finish, { once: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  setTimeout(finish, expectedMs);
}

// ==================
// BUILD MODE
// ==================
const BUILD_MODE = false;
const ENABLE_TEST_MODE_BUTTON = false;

const BUILD_MODE_ALERT = {
  avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/92a3c6c7-3b13-4563-9725-d56a3bc12c0d-profile_image-300x300.png",
  platform: "tiktok",
  username: "rexbordzgg",
  message: "sent Rose <strong>x1</strong>",
  bubbleImgUrl: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
};

// ==================
// SOUND ALERT HELPER
// ==================

const SOUND_ALERT = {
  src: "assets/audio/eureka.mp3",
  volume: 0.3, // default volume (0.0 - 1.0)
};

// Preload sound
const soundAlert = new Audio(SOUND_ALERT.src);
soundAlert.preload = "auto";
soundAlert.volume = SOUND_ALERT.volume;

function playSoundAlert(volume = SOUND_ALERT.volume) {
  if (!soundEnabled) return;

  try {
    soundAlert.pause();
    soundAlert.currentTime = 0;

    soundAlert.volume = Math.max(0, Math.min(1, volume));

    const playPromise = soundAlert.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.warn("Sound alert autoplay prevented:", err);
      });
    }
  } catch (err) {
    console.error("Sound alert failed:", err);
  }
}

// ========================
// Connect to Streamer.bot
// ========================
const client = new StreamerbotClient({
  host: sbAddress,
  port: sbPort,

  onConnect: (data) => {
    if (!streamerbotConnected) {
      streamerbotConnected = true;
      console.log(`✅ Streamer.bot connected to ${sbAddress}:${sbPort}`)
      console.debug(data);
      showSuccess("streamerbot");
      updateStatus();
    }
    connectKickPusher();
  },

  onDisconnect: () => {
    if (streamerbotConnected) {
      streamerbotConnected = false;
      console.warn("❌ Streamer.bot disconnected");
      showDisconnect("streamerbot")
      updateStatus();
    }
  }
});

// ==========================
// Streamer.bot Event Handler
// ==========================

// Twitch Events Subscription
const twitchEvents = [
  'Twitch.Follow',
  'Twitch.Sub',
  'Twitch.ReSub',
  'Twitch.Cheer',
  'Twitch.GiftSub',
  'Twitch.GiftBomb',
  'Twitch.Raid',
  'Twitch.WatchStreak',
];
twitchEvents.forEach(event =>
  client.on(event, (response) => {
    console.debug('📢 New Twitch Event:', response);
    TwitchEvent(response.event.type, response.data);
  })
);

// YouTube Events Subscription
const youtubeEvents = [
  'YouTube.NewSubscriber',
  'YouTube.NewSponsor',
  'YouTube.GiftMembershipReceived',
  'YouTube.SuperChat',
  'YouTube.SuperSticker',
];
youtubeEvents.forEach(event =>
  client.on(event, (response) => {
    console.debug('📢 New YouTube Event:', response);
    YouTubeEvent(response.event.type, response.data);
  })
);

if (!usingTikfinity) {
  client.on("General.Custom", (response) => {
    const eventName = response.data.eventName;
    const data = response.data?.args ?? {};
    
    switch (eventName) {
      case "TikTokFollow":
        console.debug("📢 Tiktok Follow:", data);
        TiktokEvent(eventName, data);
        break;

      case "TikTokGift":
        console.debug("📢 Tiktok Gift:", data);
        TiktokEvent(eventName, data);
        break;

      case "TikTokSuperFan":
        console.debug("📢 Tiktok Super Fan:", data);
        TiktokEvent(eventName, data);
        break;
      
      case "TikTokSuperFanBox":
        console.debug("📢 Tiktok Super Fan Box:", data);
        TiktokEvent(eventName, data);
        break;

      default:
        break;
    }
  });
}


// Kick Events Subscription
const kickEvents = [
  'Kick.Follow',
  'Kick.Subscription',
  'Kick.Resubscription',
  'Kick.GiftSubscription',
  'Kick.MassGiftSubscription',
];
kickEvents.forEach(event =>
  client.on(event, (response) => {
    console.debug('📢 New Kick Event:', response);
    KickEvent(response.event.type, response.data);
  })
);

// ======================
// Connect to Kick Pusher
// ======================
async function connectKickPusher() {
  if (!streamerbotConnected) {
    console.log("Waiting for Streamer.bot before connecting Kick Pusher...");
    setTimeout(connectKickPusher, 2000);
    return;
  }

  try {
    // Get username from Streamer.bot
    const broadcasterInfo = await client.getBroadcaster();
    const kickPlatform = broadcasterInfo?.platforms?.kick;

    if (!kickPlatform?.broadcasterLogin) return;

    const kickUsername = kickPlatform.broadcasterLogin;
    const kickIds = await Kick.getChannelIds(kickUsername);
    const chatroomId = kickIds.chatroomId;
    const channelId = kickIds.channelId;


    const websocket = new WebSocket(kickPusherWsUrl);

    websocket.onclose = function () {
      console.log("❌ Disconnected from Kick Pusher");
      setTimeout(connectKickPusher, 5000);
    };

    websocket.onerror = function (error) {
      console.error("Kick Pusher websocket error:", error);
    };

    websocket.onopen = function () {
      console.log(`✅ Kick Pusher successfully connected to ${kickUsername}`);
    };

    websocket.onmessage = function (response) {
      try {
        const data = JSON.parse(response.data);

        console.debug(data);

        // When connection is established, subscribe to channels
        if (data.event === "pusher:connection_established") {
          const socketData = JSON.parse(data.data);
          console.log(`[Pusher] Socket established with ID: ${socketData.socket_id}`);

          websocket.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `chatroom_${chatroomId}` } }));
          websocket.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `chatrooms.${chatroomId}` } }));
          websocket.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `chatrooms.${chatroomId}.v2` } }));
          websocket.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `predictions-channel-${chatroomId}` } }));
          websocket.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `channel_${channelId}` } }));

          console.log(`[Pusher] Sent subscription request to channel: ${chatroomId}`);
          return;
        }

        if (!data.data) return;

        const args = JSON.parse(data.data);
        const event = data.event.split("\\").pop();

        // EVENT HANDLERS
        switch (event) {
          case "StreamHostEvent":
            console.debug("📢 Kick Host:", args);
            KickStreamHost(args);
            break;

          case "KicksGifted":
            console.debug("📢 Kick Kicks:", args);
            KickKicksGifted(args);
            break;
        }
      } catch (error) {
        console.error("Failed to process Kick pusher event:", error);
      }
    };
  } catch (error) {
    console.error("Kick Pusher failed to initialize:", error);
    setTimeout(connectKickPusher, 5000);
  }
}

// =====================
// Connect to TikFinity
// =====================
function connectTikfinity() {
  socket = new WebSocket("ws://localhost:21213");

  socket.onopen = () => {
    if (!tikfinityConnected) {
      tikfinityConnected = true;
      console.log("✅ Connected to TikFinity");
      showSuccess("tikfinity");
    }
  };

  socket.onclose = () => {
    if (tikfinityConnected) {
      tikfinityConnected = false;
      console.warn("❌ Disconnected from TikFinity");
      showDisconnect("tikfinity");
    }
    setTimeout(connectTikfinity, 3000);
  };

  socket.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);

      switch (response.event) {

        case "follow":
        case "superFan":
        case "subscribe":
          const data = response.data;
          console.debug("📢 Tiktok Event:", data);
          TiktokEvent(response.event, data);
          break;
        
        case "gift": {
          const data = response.data;
          if (data.giftType === 1 && !data.repeatEnd) return;
          console.debug("📢 Tiktok Gift:", data);
          TiktokEvent(response.event, data);
          break;
        }

        case "superFanBox": {
          const data = response.data;
          console.debug("📢 Tiktok Super Box:", data);
          TiktokEvent(response.event, data);
          break;
        }

        default:
          break;

      }
    } catch (err) {
      console.error("Failed to process TikFinity event:", err);
    }
  };
}

if (usingTikfinity) {
  document.addEventListener('DOMContentLoaded', connectTikfinity);
}

async function TwitchEvent(event, data) {
  let username;
  let message;
  
  switch (event) {
    case "Follow":
      if (!twitchFollow) return;
      username = data.targetUser.name;
      message = "Just followed!";
      break;

    case "Sub": {
      if (!twitchSub) return;
      username = data.user.name;
      const tier = data.subTier?.charAt(0) ?? data.sub_tier?.charAt(0);
      const isPrime = data.isPrime ?? data.is_prime;

      if (!isPrime) {
        message = `Subscribed with <strong>Tier ${tier}</strong>!`;
      } else {
        message = "Subscribed with <strong>Prime</strong>!";
      }
      break;
    }

    case "ReSub": {
      if (!twitchSub) return;
      username = data.user.name;
      const tier = data.subTier.charAt(0);
      const isPrime = data.isPrime;
      const cumulativeMonths = data.cumulativeMonths;
      const monthLabel = cumulativeMonths == 1 ? "month" : "months";

      if (!isPrime) {
        message = `Resubscribed with <strong>Tier ${tier}</strong>! (${cumulativeMonths} ${monthLabel})`;
      } else {
        message = `Resubscribed with <strong>Prime</strong>! (${cumulativeMonths} ${monthLabel})`;
      }

      break;
    }

    case "GiftSub": {
      if (!twitchSub) return;
      if (data.fromCommunitySubGift)
        return;

      username = data.user.name;
      const tier = data.subTier.charAt(0);
      const recipient = data.recipient.name;
      const cumlativeTotal = data.cumlativeTotal;

      message = `Gifted a Tier ${tier} sub to ${recipient}! (${cumlativeTotal} total)`;
      break;
    }

    case "GiftBomb": {
      if (!twitchSub) return;
      username = data.user.name;
      const gifts = data.recipients.length;
      const totalGifts = data.cumulativeTotal ?? data.cumulative_total;
      const tier = data.subTier?.charAt(0) ?? data.sub_tier?.charAt(0);

      message = `Gifted <strong>${gifts} Tier ${tier}</strong> subs! (${totalGifts} total)`;
      break;
    }

    case "Cheer":
      if (!twitchBits) return;
      username = data.user.name;
      const rawMessage = data.parts;
      message = Twitch.buildMessageHtml(rawMessage);
      break;

    case "Raid":
      if (!twitchRaid) return;
      username = data.raider.name ??  data.from_broadcaster_user_login;
      message = `Raiding with a party of <strong>${data.viewers}</strong>!`;
      break;

    case "WatchStreak":
      if (!twitchWatchStreak) return;
      username = data.displayName;
      message = `Currently on a <strong>${data.streakCount ?? data.watch_count ?? data.streak_count}</strong> watch-streak!`;
      break;

    default:
      return; // ignore unsupported events
  }

  const avatarUrl = await Twitch.getAvatar(username);

  enqueueAlert(avatarUrl, "twitch", username, message);
}

function YouTubeEvent(event, data) {
  let username;
  let message;
  let avatarUrl;
  let bubbleImgUrl = "";

  switch (event) {
    case "NewSubscriber":
      if (!youtubeSub) return;
      username = data.name ?? data.username;
      avatarUrl = data.profileImageUrl ?? data.avatar;
      message = "Just subscribed!";
      break;

    case "NewSponsor":
      if (!youtubeMembership) return;
      username = data.user.name;
      avatarUrl = data.user.profileImageUrl;
      message = `Joined <strong>${data.levelName}</strong>!`;
      break;

    case "GiftMembershipReceived":
      if (!youtubeMembership) return;
      username = data.gifter.name;
      avatarUrl = data.gifter.profileImageUrl;
      message = `Gifted a <strong>${data.tier}</strong> membership to <strong>${data.user.name}</strong>!`;
      break;

    case "SuperChat":
      if (!youtubeSuperChat) return;
      username = data.user.name
      avatarUrl = data.user.profileImageUrl;
      message = `Sent a Super Chat (${data.amount})`;
      break;
    
    case "SuperSticker":
      if (!youtubeSuperSticker) return;
      username = data.user.name
      avatarUrl = data.user.profileImageUrl;
      message = `Sent a Super Sticker (${data.amount})`;
      bubbleImgUrl = YouTube.getStickerImageUrl(data);
      break;
    
    default:
      break;
  }

  enqueueAlert(avatarUrl, "youtube", username, message, bubbleImgUrl);
}

async function KickEvent(event, data) {
  let avatarUrl = await Kick.getAvatar(data.user.login);
  let username;
  let message;
  let bubbleImgUrl = "";

  switch (event) {
    case "Follow":
      if (!kickFollow) return;
      username = data.user.name;
      message = "Just followed!";
      break;

    case "Subscription":
      if (!kickSub) return;
      username = data.user.name;
      message = "Subscribed to the channel!";
      break;
    
    case "Resubscription":
      if (!kickSub) return;
      username = data.user.name;
      message = `Just resubscribed! (${data.duration} months)`;
      break;

    case "GiftSubscription": {
      if (!kickSub) return;
      const isAnonymous = data.isAnonymous;
      if (isAnonymous) { avatarUrl = Kick.DEFAULT_AVATAR; }
      username = !isAnonymous ? data.user.name : "Anonymous";
      message = `Gifted a sub to ${data.recipient.name}!`;
      break;
    }
  
    case "MassGiftSubscription": {
      if (!kickSub) return;
      const isAnonymous = data.isAnonymous;
      if (isAnonymous) { avatarUrl = Kick.DEFAULT_AVATAR; }
      username = !isAnonymous ? data.user.name : "Anonymous";
      const numGifts = data.recipients.length;
      message = `Gifted ${numGifts} subs to the channel!`;
      break;
    }
    
    // case "sGifted":
    //   break;

    default:
      break;
  }

  enqueueAlert(avatarUrl, "kick", username, message, bubbleImgUrl);
}

async function KickKicksGifted(data) {
  if (!kickKicks) return;

  const username = data.sender.username;
  const avatarUrl = await Kick.getAvatar(username);
  const message = `sent ${data.gift.name} <strong>x${data.gift.amount}</strong>`
  const bubbleImgUrl = `https://files.kick.com/kicks/gifts/${data.gift.gift_id.replace('_', '-')}.webp`;	

  enqueueAlert(avatarUrl, "kick", username, message, bubbleImgUrl);
}

async function KickStreamHost(data) {
  if (!kickHost) return;

  const username = data.host_username;
  const avatarUrl = await Kick.getAvatar(username);
  const message = `Hosting with <strong>${data.number_viewers} viewers</strong>!`

  enqueueAlert(avatarUrl, "kick", username, message);
}

function TiktokEvent(event, data) {
  let message;
  let bubbleImgUrl = "";

  switch (event) {
    case "TikTokFollow":
    case "follow":
      if (!tiktokFollow) return;
      message = "Just followed!";
      break;

    case "TikTokGift":
    case "gift":
      if (!tiktokGift) return;
      message = `Sent ${data.giftName} <strong>x${data.repeatCount}</strong>`;

      if (usingTikfinity) {
        bubbleImgUrl = data.giftPictureUrl || "";
      } else {
        bubbleImgUrl = data.giftImageUrl || "";
      }

      break;

    case "TikTokSuperFan":
    case "superFan":
    case "subscribe":
      if (!tiktokSuperFan) return;
      message = "Just became a super fan!";
      break;

    case "TikTokSuperFanBox":
      if (!tiktokSuperFan) return;
      message = `Dropped a super fan box <strong>x${data.peopleCount} people</strong> can open!`;
      break;

    default:
      return;
  }

  const username = data.nickname;
  const avatarUrl = data.profilePictureUrl;

  enqueueAlert(avatarUrl, "tiktok", username, message, bubbleImgUrl);
}

// ===============================
// UI: Main Bubble Alerts Function
// ===============================
function runBubbleAlerts(avatarUrl, platform, usernameText = "", message = "", bubbleImgUrl = "") {
  const container = document.getElementById("alert-container");
  const messageBubble = container.querySelector(".message-bubble");

  // Clean up any leftover slide-out animations from previous alerts
  container.classList.remove("slide-out-left", "slide-out-right");

  // Configurable timings
  const speechPopDelay = 0;
  const speechHoldTime = duration * 1000;
  const speechAnimDuration = 460;

  // Set layout class
  container.classList.remove("layout-left", "layout-right");
  container.classList.add(alignRight ? "layout-right" : "layout-left");

  // Fill existing elements
  container.querySelector(".avatar-image").src = avatarUrl;
  container.querySelector(".platform-logo").src =
    {
      twitch: "assets/images/twitch-logo.png",
      youtube: "assets/images/youtube-logo.svg",
      kick: "assets/images/kick-logo.png",
      tiktok: "assets/images/tiktok-logo.png",
    }[platform] || "assets/default.png";

  container.querySelector(".bubble-username").textContent = usernameText;
  container.querySelector(".bubble-message").innerHTML = message;

  // Process bubble image if there's one
  const bubbleImg = container.querySelector(".bubble-img");

  if (bubbleImgUrl) {
    bubbleImg.src = bubbleImgUrl;
    bubbleImg.style.display = "";
    messageBubble.classList.add("has-bubble-img");
  } else {
    bubbleImg.src = "";
    bubbleImg.style.display = "none";
    messageBubble.classList.remove("has-bubble-img");
  }

  // Show the alert container
  container.classList.remove("hidden");

  // reset first, with transitions disabled
  messageBubble.className = `message-bubble platform-${platform} no-transition${bubbleImgUrl ? " has-bubble-img" : ""}`;
  messageBubble.style.removeProperty("--bubble-open-width");

  // measure ideal open width
  messageBubble.classList.add("is-measuring");

  const containerFontSize = parseFloat(getComputedStyle(container).fontSize);
  const maxBubbleWidth = Math.min(window.innerWidth * 0.8, containerFontSize * 30);
  const measuredWidth = Math.min(messageBubble.scrollWidth, maxBubbleWidth);

  messageBubble.style.setProperty("--bubble-open-width", `${Math.ceil(measuredWidth)}px`);

  // reset back to hidden base state, still with transitions disabled
  messageBubble.className = `message-bubble platform-${platform} no-transition${bubbleImgUrl ? " has-bubble-img" : ""}`;
  messageBubble.offsetWidth;

  // re-enable transitions, but DO NOT show collapsed yet
  messageBubble.classList.remove("no-transition");
  messageBubble.offsetWidth;

  // Animate avatar-wrapper first, but only after image is loaded
  const avatarWrapper = container.querySelector(".avatar-wrapper");
  const avatarImage = container.querySelector(".avatar-image");

  // Don't hide immediately — keep whatever is there until the new one is ready
  avatarWrapper.classList.remove("avatar-in");

  let avatarSequenceStarted = false;
  const startAvatarSequence = (resolvedAvatarUrl) => {
    if (avatarSequenceStarted) return;
    avatarSequenceStarted = true;

    avatarImage.src = resolvedAvatarUrl;

    const applyAvatarIn = () => {
      avatarWrapper.classList.add("avatar-in");
      messageBubble.classList.add("is-collapsed");
      runAfterAnim(avatarWrapper, 300, onAvatarPopInComplete);
    };

    if (document.hidden) {
      // rAF is paused while hidden — apply the end state directly instead
      // of waiting on frames that won't be delivered.
      applyAvatarIn();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(applyAvatarIn));
    }
  };

  const tempImg = new Image();
  tempImg.onload = () => startAvatarSequence(avatarUrl);
  tempImg.onerror = () => {
    console.warn("Avatar image failed to load, continuing without it:", avatarUrl);
    startAvatarSequence(avatarUrl);
  };

  // Failsafe: never let a stalled/hidden-tab image load hang the whole queue
  setTimeout(() => startAvatarSequence(avatarUrl), 2000);

  if (avatarUrl) {
    tempImg.src = avatarUrl;
  } else {
    startAvatarSequence(avatarUrl);
  }

  // When avatar-wrapper pop-in ends (or is skipped while hidden), trigger message bubble morph
  function onAvatarPopInComplete() {
    playSoundAlert();

    setTimeout(() => {
      messageBubble.classList.remove("is-collapsed", "is-closing");
      messageBubble.classList.add("is-open");
    }, speechPopDelay);

    setTimeout(() => {
      messageBubble.classList.remove("is-open");
      messageBubble.classList.add("is-closing");

      setTimeout(() => {
        const slideOutClass = alignRight ? "slide-out-right" : "slide-out-left";
        container.classList.add(slideOutClass);

        runAfterAnim(container, 300, () => {
          container.classList.remove(slideOutClass);
          container.classList.add("hidden");
          messageBubble.className = "message-bubble";
          messageBubble.style.removeProperty("--bubble-open-width");

          setTimeout(() => {
            playNextAlert();
          }, 500);
        });
      }, speechAnimDuration);
    }, speechPopDelay + speechHoldTime);
  }
}

// ===============
// QUEUEING SYSTEM
// ===============
function enqueueAlert(avatarUrl, platform, usernameText, message, bubbleImgUrl = "") {
  alertQueue.push({ avatarUrl, platform, usernameText, message, bubbleImgUrl });
  if (!isAlertShowing) {
    playNextAlert();
  }
}

function playNextAlert() {
  if (alertQueue.length === 0) {
    isAlertShowing = false;
    return;
  }

  isAlertShowing = true;
  const { avatarUrl, platform, usernameText, message, bubbleImgUrl } = alertQueue.shift();
  runBubbleAlerts(avatarUrl, platform, usernameText, message, bubbleImgUrl);
}

function queueToast(elementId) {
  toastQueue.push(elementId);
  if (!toastActive) {
    showNextToast();
  }
}

function showNextToast() {
  if (toastQueue.length === 0) {
    toastActive = false;
    return;
  }

  toastActive = true;
  const id = toastQueue.shift();
  const el = document.getElementById(id);
  if (!el) {
    showNextToast();
    return;
  }

  el.classList.remove("hidden", "fade-out");

  // Show for 1 second, fade out, then wait a bit before showing the next one
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      el.classList.add("hidden");
      showNextToast();
    }, 500); // wait for fade animation to finish
  }, 1000);
}

// ======================
// UI: Update Wait Status
// ======================
function updateStatus() {
  const waitingEl = document.getElementById("waiting-status");

  if (streamerbotConnected || tikfinityConnected) {
    waitingEl.classList.add("fade-out");
    setTimeout(() => waitingEl.classList.add("hidden"), 1000); // hide after fade
  } else {
    waitingEl.classList.remove("hidden", "fade-out");
  }
}


function showSuccess(source) {
  queueToast(`${source}-status`);
}

function showDisconnect(source) {
  queueToast(`${source}-disconnect-status`);
}

// ==========
// TEST DATA 
// ==========
const testData = [
  {
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/92a3c6c7-3b13-4563-9725-d56a3bc12c0d-profile_image-300x300.png",
    platform: "twitch",
    username: "CoolStreamer",
    message: "Thanks for the awesome stream!",
  },
  {
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/0824d209-43be-4faa-9fbf-f66c63e84cb9-profile_image-300x300.png",
    platform: "youtube",
    username: "KingJAMES 🐐",
    message: "This is a really long message to see if the ellipsis kicks in properly...",
  },
  {
    avatarUrl: "https://files.kick.com/images/user/4377088/profile_image/conversion/dae5ceec-5b25-4f26-82c2-e2fdc98ae958-fullsize.webp",
    platform: "kick",
    username: "KickUser",
    message: "Hi!",
  },
  {
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/469c5f1d-8177-4767-8bbc-73ef81818f38-profile_image-70x70.png",
    platform: "tiktok",
    username: "TheLastRealCHAMP",
    message: "Loving the vibes in here 😎🔥",
  }
];

let testIndex = 0;

// Sequential test loop
function startTestLoop() {
  setInterval(() => {
    const data = testData[testIndex];
    enqueueAlert(
      data.avatarUrl,
      data.platform,
      data.username,
      data.message,
    );

    testIndex = (testIndex + 1) % testData.length; // cycle through
  }, 3000); // cycle duration
}

function showBuildModeAlert({ avatarUrl, platform, username, message, bubbleImgUrl = "" }) {
  const container = document.getElementById("alert-container");
  const avatarWrapper = container.querySelector(".avatar-wrapper");
  const avatarImage = container.querySelector(".avatar-image");
  const platformLogo = container.querySelector(".platform-logo");
  const messageBubble = container.querySelector(".message-bubble");
  const usernameEl = container.querySelector(".bubble-username");
  const messageEl = container.querySelector(".bubble-message");
  const bubbleImg = container.querySelector(".bubble-img");

  container.classList.remove("hidden", "slide-out-left", "slide-out-right");
  container.classList.remove("layout-left", "layout-right");
  container.classList.add(alignRight ? "layout-right" : "layout-left");

  avatarImage.src = avatarUrl;
  platformLogo.src =
    {
      twitch: "assets/images/twitch-logo.png",
      youtube: "assets/images/youtube-logo.svg",
      kick: "assets/images/kick-logo.png",
      tiktok: "assets/images/tiktok-logo.png",
    }[platform] || "assets/default.png";

  usernameEl.textContent = username;
  messageEl.innerHTML = message;

  if (bubbleImgUrl) {
    bubbleImg.src = bubbleImgUrl;
    messageBubble.classList.add("has-bubble-img");
  } else {
    bubbleImg.src = "";
    messageBubble.classList.remove("has-bubble-img");
  }

  avatarWrapper.classList.remove("avatar-in");
  void avatarWrapper.offsetWidth;
  avatarWrapper.classList.add("avatar-in");

  messageBubble.className = `message-bubble platform-${platform} is-open no-transition${bubbleImgUrl ? " has-bubble-img" : ""}`;

  // Measure final open width
  messageBubble.style.removeProperty("--bubble-open-width");
  messageBubble.classList.add("is-measuring");

  const containerFontSize = parseFloat(getComputedStyle(container).fontSize);
  const maxBubbleWidth = Math.min(window.innerWidth * 0.8, containerFontSize * 30);
  const measuredWidth = Math.min(messageBubble.scrollWidth, maxBubbleWidth);

  messageBubble.classList.remove("is-measuring");
  messageBubble.style.setProperty("--bubble-open-width", `${Math.ceil(measuredWidth)}px`);
  messageBubble.className = `message-bubble platform-${platform} is-open no-transition${bubbleImgUrl ? " has-bubble-img" : ""}`;
}

if (BUILD_MODE) {
  showBuildModeAlert(BUILD_MODE_ALERT);
}

if (ENABLE_TEST_MODE_BUTTON) {
  createTestModeButton();
}

function createTestModeButton() {
  const button = document.createElement("button");
  button.textContent = "Test Alert";

  Object.assign(button.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: "9999",
    padding: "8px 12px",
    cursor: "pointer"
  });

  button.addEventListener("click", () => {
    enqueueAlert(
      BUILD_MODE_ALERT.avatarUrl,
      BUILD_MODE_ALERT.platform,
      BUILD_MODE_ALERT.username,
      BUILD_MODE_ALERT.message,
      BUILD_MODE_ALERT.bubbleImgUrl
    );
  });

  document.body.appendChild(button);
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "testAlert") return;

  const data = event.data.data;
  if (!data) return;

  enqueueAlert(
    data.avatarUrl,
    data.platform,
    data.username,
    data.message,
    data.bubbleImgUrl || ""
  );
});

// Start test loop instead of one-time call
// startTestLoop();



