// Presentation-only artwork catalogue. Historical emoji values remain unchanged
// in storage, crypto fingerprints, sync messages and backups.
const picture = (key, label) => ({ src: `/app/pictograms/${key}-v1.webp`, label });
const sticker = (id, label) => ({ src: `/app/stickers/${id}.webp`, label });
const sport = (id, label) => ({ src: `/app/sports/${id}-v2.webp`, label });
export const PICTOGRAMS = {
  breakfast: picture('breakfast', '早饭'), lunch: picture('lunch', '午饭'), dinner: picture('dinner', '晚饭'),
  snack: picture('snack', '加餐'), supper: picture('supper', '夜宵'), dish: picture('dish', '想吃的菜'),
  shop: picture('shop', '想去的店'), drink: picture('drink', '零食饮品'), dessert: picture('dessert', '甜品'),
  travel: picture('travel', '旅行'), birthday: picture('birthday', '生日'), graduation: picture('graduation', '毕业'),
  note: picture('note', '记事'), party: picture('party', '庆祝'), home: picture('home', '家'),
  paw: picture('paw', '小脚印'), star: picture('star', '星星'), calendar: picture('calendar', '日历'),
};
const clean = (s) => String(s || '').replace(/\ufe0f|\p{Emoji_Modifier}/gu, '');
const aliases = new Map();
const add = (values, art) => values.forEach((value) => aliases.set(clean(value), art));
add(['🌅','🌄','🥐','🥛'], PICTOGRAMS.breakfast);
add(['🍱','🍙','🍣'], PICTOGRAMS.lunch);
add(['🌙','🌛','🌜','🍚'], PICTOGRAMS.dinner);
add(['🍪','🍩','🍫','🍬','🍭'], PICTOGRAMS.snack);
add(['🌃','🌌'], PICTOGRAMS.supper);
add(['🍜','🍲','🍝','🥘','🍔','🍟','🍕','🌮','🥗','🍳'], PICTOGRAMS.dish);
add(['🏪','🏬','🏫','🏢','🏥'], PICTOGRAMS.shop);
add(['🧋','☕','🍵','🥤','🧃','🍹','🍺','🍷'], PICTOGRAMS.drink);
add(['🍰','🧁','🍓','🍒','🍎','🍊','🍋','🍉','🍇','🍑','🥝','🍍','🥥','🥑'], PICTOGRAMS.dessert);
add(['✈️','🛫','🛬','🧳','🚗','🚆','🚲','🚴','🚴‍♂️','🚴‍♀️'], PICTOGRAMS.travel);
add(['🎂'], PICTOGRAMS.birthday); add(['🎓'], PICTOGRAMS.graduation);
add(['📝','✏️','📚','📖','📓','📒','📔','📑'], PICTOGRAMS.note);
add(['🎉','🎊','🎈','🎁'], PICTOGRAMS.party); add(['🏠','🏡'], PICTOGRAMS.home);
add(['🐾','🐱','🐶','🦊','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐧','🐤','🦄','🐝','🦋','🐢','🐬','🐳','🦀','🐙','🦔'], PICTOGRAMS.paw);
add(['⭐','🌟','✨','💫','⚡','🔥','☀️','🌈','🌸','🌻','🌷','🍀','🍄','⛄','💧'], PICTOGRAMS.star);
add(['📅','🗓️','📆','⏰','⌚','⏱️'], PICTOGRAMS.calendar);
add(['🐰','🐇'], sticker('av-bunny', '小兔')); add(['🐻','🧸'], sticker('av-bear', '小熊'));
add(['😊','😀','😃','😄','😁','😆','😂','🤣','🥰','😍','🤗','🙌'], sticker('r-cheer', '开心'));
add(['😌','🙂','🙏','🤝'], sticker('b-thanks', '平静'));
add(['👍','👌','🤩','✅','✔️','☑️','💯'], sticker('r-ok', '棒'));
add(['😴','💤'], sticker('b-sleep', '晚安')); add(['🥱'], sticker('r-yawn', '好困'));
add(['😤','😠','😡','😾'], sticker('r-pout', '烦躁'));
add(['😢','😭','😿','💔'], sticker('b-cry', '难过'));
add(['🤒','🤕','😷','🥵','🤢','🤮'], sticker('r-sorry', '不舒服'));
add(['🤯','😵','😵‍💫','😱'], sticker('b-dizzy', '晕了'));
add(['😶','🤔','😕','😐','❓','❔'], sticker('r-what', '说不清'));
add(['🥺','👋'], sticker('r-hi', '嗨'));
add(['❤️','❤','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💕','💖','💗','💓','💘','💝','🫶'], sticker('r-pat', '回应'));
add(['💪','🏋️','🏋️‍♂️','🏋️‍♀️'], sport('bunny-gym', '健身'));
add(['🏃','🏃‍♂️','🏃‍♀️'], sport('bear-run', '跑步')); add(['🚶','🚶‍♂️','🚶‍♀️'], sport('bear-walk', '散步'));
add(['🥾','🧗'], sport('bear-hike', '爬山')); add(['🏊','🏊‍♂️','🏊‍♀️'], sport('bear-swim', '游泳'));
add(['🏸'], sport('bunny-badminton', '羽毛球')); add(['🥏'], sport('bunny-frisbee', '飞盘'));
add(['🧘','🧘‍♂️','🧘‍♀️','⚽','🏀','🎾','🏐','🏓'], sport('bunny-other', '运动'));
add(['🎬','🎥','📺'], sticker('d-movie', '观影'));
add(['📍','📌'], PICTOGRAMS.home);
// Preserve important message distinctions rather than turning a negative or
// completion marker into a cheerful generic star.
add(['🛑','⛔','🚫'], sticker('r-pout', '停止'));
add(['❌','❎','👎'], sticker('r-facepalm', '否定'));
add(['✅','✔️','☑️'], sticker('b-done', '完成'));
add(['👍'], sticker('r-ok', '赞同'));
add(['⚠️','❗','❕','‼️','⁉️'], sticker('b-what', '注意'));
export const symbolCode = (value) => Array.from(String(value)).map((c) => 'U+'+c.codePointAt(0).toString(16).toUpperCase()).join(' ');

// One complete displayed symbol (including flags, modifiers, keycaps and ZWJ
// sequences) becomes one picture, not a trail of broken component glyphs.
export const EMOJI_PATTERN = /(?:\p{Regional_Indicator}{2}|[#*0-9]\ufe0f?\u20e3|(?![©®™](?!\ufe0f))\p{Extended_Pictographic}(?:\ufe0f|\p{Emoji_Modifier})*(?:\u200d\p{Extended_Pictographic}(?:\ufe0f|\p{Emoji_Modifier})*)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/gu;
export function emojiParts(text) {
  const parts = []; let start = 0;
  for (const m of String(text).matchAll(EMOJI_PATTERN)) {
    if (m.index > start) parts.push(text.slice(start, m.index));
    parts.push({ value: m[0], art: pictogramOf(m[0]) });
    start = m.index + m[0].length;
  }
  if (!parts.length) return null;
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}
export function pictogramOf(value, fallback = 'star') {
  const own = (key) => Object.prototype.hasOwnProperty.call(PICTOGRAMS, key) ? PICTOGRAMS[key] : null;
  const known = own(value) || aliases.get(clean(value));
  if (known) return known;
  if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(String(value))) {
    return { ...sticker('r-what', '表情'), label: '表情 '+symbolCode(value) };
  }
  return own(fallback) || PICTOGRAMS.star;
}
// Native tooltips, select options and OS notifications cannot embed images.
// Give those surfaces readable semantic text rather than system emoji glyphs.
export function emojiText(text) {
  const parts = emojiParts(String(text || ''));
  return parts ? parts.map((part) => typeof part === 'string' ? part : `[${part.art.label}]`).join('') : text;
}
