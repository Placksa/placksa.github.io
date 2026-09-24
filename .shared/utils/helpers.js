/* =============================================================== Helpers ====
 * Everything the Streamer.bot-backed platforms need to paint chat, split into
 * one namespace per platform plus the `Utils` base they share.
 *
 * Twitch, Kick and YouTube live in the same file because Streamer.bot carries
 * all three — a widget that connects to one is almost always connecting to the
 * others, and they render their emotes through the same Utils._emoteImg.
 * TikTok is the exception: Streamer.bot does not carry it, so it ships as its
 * own dependency-free tiktok.js and a widget can take it without taking this.
 * ============================================================================ */

/* ================================================================= Utils ====
 * The platform-agnostic pieces. Nothing here knows which service a message
 * came from; the namespaces below are the ones that do.
 * ============================================================================ */

const Utils = {

  // Escapes text before it goes into innerHTML
  escapeHtml(value) {
    const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, (char) => chars[char]);
  },

  // The one shape every inline emote in this file renders as. `label` is both
  // the alt text and the tooltip, so a dropped image still reads as its name.
  _emoteImg(url, label) {
    const safeLabel = Utils.escapeHtml(label ?? '');
    return `<img src="${Utils.escapeHtml(url)}" alt="${safeLabel}" title="${safeLabel}" class="emote">`;
  },

  buildEmoteMessageHtml(originalMessage, emotes) {
    const text = String(originalMessage ?? '');
    if (!emotes || emotes.length === 0) return Utils.escapeHtml(text);

    // Copied before sorting — the caller's array is theirs, and Streamer.bot
    // hands the same objects to every subscriber.
    const sorted = [...emotes].filter(Boolean).sort((a, b) => a.startIndex - b.startIndex);

    let html = '';
    let cursor = 0;

    sorted.forEach((emote) => {
      // A span that starts inside the one before it would double-render the
      // overlap, so skip it rather than trust the indices.
      if (emote.startIndex < cursor) return;

      html += Utils.escapeHtml(text.slice(cursor, emote.startIndex));
      html += Utils._emoteImg(emote.imageUrl, emote.name);
      cursor = emote.endIndex + 1;
    });

    return html + Utils.escapeHtml(text.slice(cursor));
  },

  buildEmoteMessageFromCSharp(originalMessage, emotes, cheerEmotes) {
    const text = String(originalMessage ?? '');

    const spans = [...(emotes || []), ...(cheerEmotes || [])]
      .filter(Boolean)
      .sort((a, b) => a.StartIndex - b.StartIndex);

    if (!spans.length) return Utils.escapeHtml(text);

    let html = '';
    let cursor = 0;

    spans.forEach((span) => {
      if (span.StartIndex < cursor) return; // same overlap guard as buildEmoteMessageHtml

      html += Utils.escapeHtml(text.slice(cursor, span.StartIndex));

      // Twemoji spans are plain unicode dressed as an emote -- Name IS the
      // character itself here, and an image would only make it bigger.
      if (span.Type === 'Twemoji') {
        html += Utils.escapeHtml(span.Name);
      } else {
        const sizePair = Twitch._emoteSizes[span.Type];
        const url = sizePair ? span.ImageUrl.replace(sizePair[0], sizePair[1]) : span.ImageUrl;
        html += Utils._emoteImg(url, span.Name);
      }

      // Only CheerEmote spans carry Bits.
      if (span.Bits !== undefined && span.Bits !== null) {
        const safeColor = /^#[0-9a-f]{3,8}$/i.test(span.Color || '') ? span.Color : null;
        const style = safeColor ? ` style="color:${safeColor}"` : '';
        html += `<span class="bits"${style}>${Utils.escapeHtml(span.Bits)}</span>`;
      }

      cursor = span.EndIndex + 1;
    });

    return html + Utils.escapeHtml(text.slice(cursor));
  },
  
};

/* ================================================================ Twitch ====
 * Avatars, and the renderer for Twitch's structured message parts.
 * ============================================================================ */

const Twitch = {

  /* -------------------------------------------------------------- avatars -- */

  // decapi replies in plain text, and it answers 200 to a bad login too — the
  // body is just "User not found.". Unchecked, that string became the avatar
  // url and reached a css url(), which paints nothing and never errors. Only a
  // real url is returned; anything else is null, which the widget draws as the
  // chatter's initial instead.
  //
  // The promise is cached rather than its result, so a chatter's burst of
  // messages costs one request instead of one each. Failures drop out of the
  // cache so the next message retries.
  _avatars: new Map(),

  getAvatar(username) {
    if (!username) return Promise.resolve(null);

    const key = String(username).toLowerCase();
    if (Twitch._avatars.has(key)) return Twitch._avatars.get(key);

    // Runs up to the fetch before the set below, so a failure can never delete
    // the entry it is about to be stored under.
    const request = (async () => {
      try {
        const response = await fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(username)}`);
        if (!response.ok) throw new Error(`decapi responded ${response.status}`);

        const body = (await response.text()).trim();
        if (!/^https?:\/\//i.test(body)) throw new Error(body || "empty response");
        return body;

      } catch (err) {
        console.error(`[Twitch.getAvatar] Error fetching avatar for "${username}": ${err.message}`);
        Twitch._avatars.delete(key);
        return null;
      }
    })();

    Twitch._avatars.set(key, request);
    return request;
  },

  /* ------------------------------------------------------------- messages -- */

  // Third-party emote hosts serve one url per size and Streamer.bot asks each
  // for its largest. A chat line renders at ~1em, so every one of those is a
  // hundred-odd kilobytes to paint twenty pixels: rewrite the size segment down
  // to the smallest each host offers. Keyed by Streamer.bot's `part.source`;
  // a source that isn't here keeps whatever url it arrived with.
  _emoteSizes: {
    '7TVChannel':   ['/4x', '/1x'],
    'FrankerFaceZ': ['/4',  '/1' ],
    'BetterTTV':    ['/3x', '/1x']
  },

  // Builds an HTML string from Twitch's structured `data.parts`. Prefer this
  // over regex-replacing `data.text` — Twitch has already told us exactly where
  // each emote/cheer sits, so there's nothing to pattern-match and no risk of a
  // replacement landing inside a URL of a previously-inserted tag.
  buildMessageHtml(parts, data = null) {
    if (!Array.isArray(parts)) return '';

    return parts.map((part) => {
      if (!part) return '';

      switch (part.type) {
        case 'emote': {
          // Twemoji parts are plain unicode dressed as an emote; the character
          // itself renders, and the image would only make it bigger.
          if (part.source === 'Twemoji' || !part.imageUrl) return Utils.escapeHtml(part.text);

          const size = Twitch._emoteSizes[part.source];
          const url = size ? part.imageUrl.replace(size[0], size[1]) : part.imageUrl;

          return Utils._emoteImg(url, part.text);
        }

        // Cheers were previously dropped (returned ''), which is why a cheer-only
        // message rendered as nothing but the spaces between the cheermotes.
        case 'cheer': {
          if (!part.imageUrl) return Utils.escapeHtml(part.text);

          const image = Utils._emoteImg(part.imageUrl, part.text);
          if (part.bits === undefined || part.bits === null) return image;

          // Only trust a plain hex colour — this value lands in a style attribute.
          const safeColor = /^#[0-9a-f]{3,8}$/i.test(part.color || '') ? part.color : null;
          const style = safeColor ? ` style="color:${safeColor}"` : '';

          return `${image}<span class="bits"${style}>${Utils.escapeHtml(part.bits)}</span>`;
        }

        case 'gif': {
          const url = part.url || part.imageUrl;
          if (!url) return Utils.escapeHtml(part.text);

          // `data` is optional, so fall back to the part's own text rather than
          // throwing when it isn't passed.
          const description = Utils.escapeHtml(String(data?.text ?? part.text ?? '').replace(/[\[\]]/g, ''));
          return `<img class="embedded twitch-giphy-integration" src="${Utils.escapeHtml(url)}" alt="${description}" title="${description}">`;
        }

        default:
          return Utils.escapeHtml(part.text);
      }

    }).join('');
  }
};

/* ================================================================== Kick ====
 * The one channel document every lookup here reads from, the badge set, and
 * the message renderer with its 7TV emote map.
 * ============================================================================ */

const Kick = {

  /* -------------------------------------------------------------- channel -- */

  // One channel document backs the ids, the sub badge tiers and the avatar, and
  // every widget wants at least two of the three — so fetch it once and cache
  // the in-flight promise, the same way Twitch._avatars does. Callers below
  // read fields off it instead of each making the same request.
  _channels: new Map(),

  _channel(username) {
    if (!username) return Promise.resolve(null);

    const key = String(username).toLowerCase();
    if (Kick._channels.has(key)) return Kick._channels.get(key);

    const request = (async () => {
      // Kick's url slug turns an underscore into a dash, but the name arrives
      // either way depending on which event carried it, so try what we were
      // given and then the slug spelling before giving up.
      const spellings = [username, username.replace(/_/g, '-')]
        .filter((name, index, all) => all.indexOf(name) === index);

      try {
        for (const name of spellings) {
          const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(name)}`);
          if (response.ok) return await response.json();
        }
        throw new Error(`no channel for "${username}"`);

      } catch (err) {
        console.error(`[Kick] Channel lookup failed for "${username}": ${err.message}`);
        Kick._channels.delete(key);
        return null;
      }
    })();

    Kick._channels.set(key, request);
    return request;
  },

  async getChannelIds(username) {
    const data = await Kick._channel(username);
    if (!data?.chatroom?.id) return null;

    // `userId` is what 7TV keys a Kick channel on — not the channel or
    // chatroom id. See Kick.get7TVEmotes.
    return {
      chatroomId: data.chatroom.id,
      channelId: data.chatroom.channel_id,
      userId: data.user_id
    };
  },

  /* --------------------------------------------------------------- avatar -- */

  // Kick's channel endpoint is the only source of a user's avatar, and chat
  // handlers ask for one per message — _channel does the caching, so a busy
  // chat costs one request per chatter no matter how much they talk, and shares
  // that request with the id and sub badge lookups.
  DEFAULT_AVATAR: "https://files.kick.com/images/user/4545493/profile_image/conversion/default1-medium.webp",

  async getAvatar(username) {
    const data = await Kick._channel(username);

    // Kick serves the picture at several sizes off one path; 'medium' is the
    // largest a chat avatar can actually show.
    return (data?.user?.profile_pic || Kick.DEFAULT_AVATAR).replace("fullsize", "medium");
  },

  /* --------------------------------------------------------------- badges -- */

  async getSubBadges(username) {
    const data = await Kick._channel(username);
    return data?.subscriber_badges || [];
  },

  // Kick's `badge.type` on the left, the SVG shipped in each widget's
  // assets/images/kick folder on the right. The files keep Kick's own asset
  // names, which do not match the api's type values — `broadcaster` is filed
  // as HostBadge — so the mapping has to be written out rather than derived.
  //
  // A type that isn't here has no file on disk, so it resolves to no icon and the
  // renderer draws nothing at all — a badge is its art or it is absent. Kick adds
  // badge types faster than we add files, so expect this to happen.
  // `sub_gifter` is absent on purpose: it is tiered, see _gifterTiers.
  _badgeFiles: {
    bot:         'BotBadge.svg',
    broadcaster: 'HostBadge.svg',
    founder:     'FounderBadge.svg',
    moderator:   'ModeratorBadge.svg',
    og:          'OGBadge.svg',
    sidekick:    'SidekickBadge.svg',
    subscriber:  'SubscriberBadge.svg',
    verified:    'VerifiedBadge.svg',
    vip:         'VIPBadge.svg'
  },

  // Gift badges are tiered by how many subs the user has gifted. Only these two
  // are confirmed against Kick, so the lookup clamps at both ends rather than
  // guessing: below 5 shows the 5 badge, 10 and above shows the 10 badge. Kick
  // does run the set further (25, 50, 100, 200) — each is the same artwork in a
  // different colour, so adding one is a single line here plus its file.
  _gifterTiers: [
    { min: 5,  icon: 'Gift5.svg'  },
    { min: 10, icon: 'Gift10.svg' }
  ],

  // Highest tier whose threshold `value` clears, or null when it clears none.
  // Tiers may arrive in any order — Kick's subscriber list is not sorted — so
  // sort before picking rather than trusting the input.
  //
  // `clamp` returns the lowest tier instead of null when nothing is cleared.
  // That is right for the gift badges, whose table starts above the count at
  // which Kick first awards one, and wrong for subscribers, where clearing no
  // tier is a real answer the caller handles with its own generic icon.
  _highestTier(tiers, value, { key = 'min', clamp = false } = {}) {
    const sorted = [...(tiers || [])].filter(Boolean).sort((a, b) => a[key] - b[key]);
    if (!sorted.length) return null;

    const earned = sorted.filter((tier) => (value ?? 0) >= tier[key]);
    return earned.length ? earned[earned.length - 1] : (clamp ? sorted[0] : null);
  },

  // Kick splits a user's badges across two arrays: `badges` holds the role
  // badges (moderator, subscriber, …) and carries no image at all, while
  // `badges_v2` holds global ones like the level badge and does carry a CDN
  // url. Both sides carry Kick's own `sort_order`, so pool them and sort on it
  // instead of guessing at an order.
  //
  // Returns the { icon, label } descriptors the overlay's badge renderer takes,
  // not HTML — the renderer draws icons as CSS background images.
  getBadges(identity, { subBadges = [], iconBase = 'assets/images/kick/' } = {}) {
    const items = [];

    // `selected` is the user's own choice of which global badge to display, so
    // honour it — Kick's chat hides the unselected ones too.
    (identity?.badges_v2 || []).forEach((badge) => {
      if (!badge || badge.badge_type !== 'global' || badge.selected !== true || !badge.image_url) return;

      const level = badge.metadata?.level;
      const label = badge.name === 'level' && level != null ? `level ${level}` : (badge.name || '');
      items.push({ sort: badge.sort_order, icon: badge.image_url, label });
    });

    (identity?.badges || []).forEach((badge) => {
      if (!badge || !badge.type) return;

      let icon = null;
      let fallbackIcon = null;
      if (badge.type === 'subscriber') {
        // Highest tier the user has actually earned, by months subscribed. A
        // channel may define no tiers at all, in which case the generic icon
        // stands in. Tier art is served from files.kick.com, which throttles —
        // keep the bundled icon as a fallback the renderer can swap in when a
        // request is dropped.
        const tier = Kick._highestTier(subBadges, badge.count, { key: 'months' });
        fallbackIcon = `${iconBase}${Kick._badgeFiles.subscriber}`;
        icon = tier?.badge_image?.src || fallbackIcon;
      } else if (badge.type === 'sub_gifter') {
        // Clamped, so a gifter always resolves to a file and is never dropped for
        // want of an icon, however few they have gifted.
        const tier = Kick._highestTier(Kick._gifterTiers, badge.count, { clamp: true });
        icon = `${iconBase}${tier.icon}`;
      } else if (Kick._badgeFiles[badge.type]) {
        icon = `${iconBase}${Kick._badgeFiles[badge.type]}`;
      }

      items.push({ sort: badge.sort_order, icon, fallbackIcon, label: badge.text || badge.type });
    });

    // A missing sort_order sorts last. The sort is stable, so ties keep the
    // badges_v2 entries ahead of the role badges.
    const order = (value) => (typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER);

    return items
      .sort((a, b) => order(a.sort) - order(b.sort))
      .map(({ icon, fallbackIcon, label }) => {
        const entry = { label: String(label ?? '') };
        if (icon) entry.icon = icon;
        if (fallbackIcon && fallbackIcon !== icon) entry.fallbackIcon = fallbackIcon;
        return entry;
      });
  },

  /* ------------------------------------------------------------- messages -- */

  // Kick sends raw message text with its own emotes inlined as `[emote:id:name]`
  // markers and 7TV emotes left as bare words. Tokenise once and escape each
  // literal run as we go — regex-replacing the whole string and then
  // word-matching the result would run the second pass over the HTML the first
  // pass just inserted.
  buildMessageHtml(content, emoteMap = null) {
    const text = String(content ?? '');
    const pattern = /\[emote:(\d+):([^\]]*)\]/g;

    let html = '';
    let cursor = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      html += Kick._buildTextHtml(text.slice(cursor, match.index), emoteMap);

      // The id is digits-only by the pattern, so it is safe in the url.
      html += Utils._emoteImg(`https://files.kick.com/emotes/${match[1]}/fullsize`, match[2]);
      cursor = pattern.lastIndex;
    }

    return html + Kick._buildTextHtml(text.slice(cursor), emoteMap);
  },

  // Escapes a run of plain message text, swapping in any word that names a 7TV
  // emote. Splitting on a capturing group keeps the separators, so runs of
  // spaces and newlines survive instead of collapsing to one space.
  _buildTextHtml(text, emoteMap = null) {
    if (!text) return '';
    if (!emoteMap || !emoteMap.size) return Utils.escapeHtml(text);

    return text.split(/(\s+)/).map((token) => {
      const url = emoteMap.get(token);
      return url ? Utils._emoteImg(url, token) : Utils.escapeHtml(token);
    }).join('');
  },

  // Builds a name -> url map of every 7TV emote usable in a Kick channel.
  // Resolves against Kick's numeric user id (from Kick.getChannelIds), not the
  // channel or chatroom id. Any failure degrades to whatever loaded, so a 7TV
  // outage costs you 7TV emotes rather than the whole chat.
  async get7TVEmotes(kickUserId) {
    const emotes = new Map();

    const load = async (url, label) => {
      try {
        const response = await fetch(url);

        // A channel with no linked 7TV account 404s here — that's expected.
        if (!response.ok) {
          console.debug(`[Kick.get7TVEmotes] No ${label} emote set (HTTP ${response.status})`);
          return;
        }

        const data = await response.json();
        const list = data?.emote_set?.emotes || data?.emotes || [];

        list.forEach((emote) => {
          if (emote?.name && emote?.id) {
            emotes.set(emote.name, `https://cdn.7tv.app/emote/${emote.id}/1x.webp`);
          }
        });

      } catch (err) {
        console.error(`[Kick.get7TVEmotes] Failed to load the ${label} emote set:`, err.message);
      }
    };

    // Globals first, so the channel's own set wins a name collision.
    await load('https://7tv.io/v3/emote-sets/global', 'global');
    if (kickUserId) await load(`https://7tv.io/v3/users/kick/${encodeURIComponent(kickUserId)}`, 'channel');

    return emotes;
  }
};

/* =============================================================== YouTube ====
 * YouTube chat renders through Utils.buildEmoteMessageHtml — Streamer.bot hands
 * its emotes over in the flat-span shape that helper takes. What is left here
 * is the super sticker, whose art the event does not put at a fixed path.
 * ============================================================================ */

const YouTube = {

  // A YouTube super sticker's art is the only `imageUrl` anywhere in the event,
  // but its depth moves between payload shapes, so search for the key rather
  // than reaching for a path that will not hold.
  //
  // Iterative and visited-guarded: these payloads are deserialized json today,
  // but a cyclic object would hang a naive recursive walk, and the stack is the
  // same amount of code as the recursion it replaces.
  getStickerImageUrl(payload) {
    if (typeof payload !== 'object' || payload === null) return null;

    const stack = [payload];
    const seen = new Set();

    while (stack.length) {
      const node = stack.pop();
      if (typeof node !== 'object' || node === null || seen.has(node)) continue;
      seen.add(node);

      if (!Array.isArray(node) && typeof node.imageUrl === 'string') return node.imageUrl;

      // Reversed so siblings pop in source order — the first url in the payload
      // is the sticker itself, and anything after it is decoration.
      const children = Array.isArray(node) ? node : Object.values(node);
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }

    return null;
  }
};
