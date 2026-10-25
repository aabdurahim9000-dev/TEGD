/* Чистая логика Джарвиса (без DOM): разбор времени, расписания, калькулятор. */
(function (root) {
  "use strict";
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const RU_NUM = {
    "ноль": 0, "один": 1, "одну": 1, "одна": 1, "два": 2, "две": 2, "три": 3, "четыре": 4,
    "пять": 5, "шесть": 6, "семь": 7, "восемь": 8, "девять": 9, "десять": 10,
    "одиннадцать": 11, "двенадцать": 12, "тринадцать": 13, "четырнадцать": 14,
    "пятнадцать": 15, "шестнадцать": 16, "семнадцать": 17, "восемнадцать": 18,
    "девятнадцать": 19, "двадцать": 20, "тридцать": 30, "сорок": 40, "пятьдесят": 50,
    "шестьдесят": 60, "семьдесят": 70, "восемьдесят": 80, "девяносто": 90,
    "сто": 100, "двести": 200, "триста": 300, "четыреста": 400, "пятьсот": 500,
    "шестьсот": 600, "семьсот": 700, "восемьсот": 800, "девятьсот": 900,
  };
  const GEN = {
    "двух": 2, "трёх": 3, "трех": 3, "четырёх": 4, "четырех": 4, "пяти": 5, "шести": 6, "семи": 7,
    "восьми": 8, "девяти": 9, "десяти": 10, "пятнадцати": 15, "двадцати": 20, "тридцати": 30,
  };
  const FILLER = new Set(["потом", "затем", "далее", "и", "а", "после", "этого", "ещё", "еще", "также",
    "тоже", "такое", "такой", "следующее", "вот", "значит"]);
  const SKIP_HEAD = new Set([...FILLER, "на", "сегодня", "завтра", "послезавтра", "день", "будет",
    "таким", "мне", "у", "меня"]);
  const PERIODS = { "утра": "am", "утром": "am", "дня": "pm", "днём": "pm", "днем": "pm",
    "вечера": "pm", "вечером": "pm", "ночи": "night", "ночью": "night" };
  const CALC_OPS = { "плюс": "+", "минус": "-", "умножить": "*", "умножь": "*", "помножить": "*",
    "разделить": "/", "раздели": "/", "делить": "/", "+": "+", "-": "-", "*": "*", "/": "/", "х": "*", "x": "*" };

  function plural(n, one, few, many) {
    n = Math.abs(Math.trunc(n));
    const a = n % 100, b = n % 10;
    if (a >= 11 && a <= 14) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  function fmtDuration(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = [];
    if (h) p.push(h + " " + plural(h, "час", "часа", "часов"));
    if (m) p.push(m + " " + plural(m, "минуту", "минуты", "минут"));
    if (s && !h) p.push(s + " " + plural(s, "секунду", "секунды", "секунд"));
    return p.join(" ") || "0 секунд";
  }

  function numVal(w) {
    if (/^\d+$/.test(w)) return parseInt(w, 10);
    if (own(RU_NUM, w)) return RU_NUM[w];
    if (own(GEN, w)) return GEN[w];
    return null;
  }

  function wordsNum(words) {
    let total = 0, found = false, end = 0;
    for (let i = 0; i < words.length; i++) {
      const v = numVal(words[i]);
      if (v === null) { if (found) break; continue; }
      total += v; found = true; end = i + 1;
    }
    return found ? [total, end] : [null, 0];
  }

  function parseDuration(words) {
    let total = 0, cur = null, half = false, end = 0, found = false;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (/^\d+$/.test(w)) { cur = (cur || 0) + parseInt(w, 10); continue; }
      if (own(RU_NUM, w)) { cur = (cur || 0) + RU_NUM[w]; continue; }
      if (w === "полтора" || w === "полторы") { cur = (cur || 0) + 1.5; continue; }
      if (w === "пол") { half = true; continue; }
      if (w === "полчаса" || w === "полминуты") {
        total += w === "полчаса" ? 1800 : 30; found = true; end = i + 1; cur = null; continue;
      }
      const mult = w.startsWith("час") ? 3600 : w.startsWith("минут") ? 60 : w.startsWith("секунд") ? 1 : null;
      if (mult) {
        const val = half ? 0.5 : (cur === null ? 1 : cur);
        total += val * mult; found = true; end = i + 1; cur = null; half = false; continue;
      }
      if (found) break;
      cur = null; half = false;
    }
    return found ? [Math.trunc(total), end] : [0, 0];
  }

  const pad = n => String(n).padStart(2, "0");
  function clockWords(hhmm) {
    const h = parseInt(hhmm.slice(0, 2), 10), m = parseInt(hhmm.slice(3), 10);
    return m === 0 ? h + " " + plural(h, "час", "часа", "часов") : h + " " + pad(m);
  }

  function parseClock(words) {
    if (!words.length) return null;
    const w0 = words[0];
    let i = 1, h, mi = 0;
    const mt = w0.match(/^(\d{1,2})[:.](\d{2})$/);
    if (mt) { h = +mt[1]; mi = +mt[2]; }
    else if (w0 === "полдень" || w0 === "полдня") h = 12;
    else if (w0 === "полночь") h = 0;
    else if (w0 === "час") h = 1;
    else {
      const v = numVal(w0);
      if (v === null || v > 23) return null;
      h = v;
      if (v === 20 && words.length > 1) {
        const u = numVal(words[1]);
        if (u !== null && u >= 1 && u <= 3) { h = 20 + u; i = 2; }
      }
      if (i < words.length && words[i].startsWith("час")) i++;
      if (i < words.length) {
        const w = words[i];
        const nxt = i + 1 < words.length ? numVal(words[i + 1]) : null;
        if (w === "ноль" && nxt !== null && nxt < 10) { mi = nxt; i += 2; }
        else if (w === "ровно") i++;
        else {
          const v2 = numVal(w);
          if (v2 !== null && v2 >= 10 && v2 <= 59) {
            mi = v2; i++;
            if ([20, 30, 40, 50].includes(v2) && i < words.length) {
              const u = numVal(words[i]);
              if (u !== null && u >= 1 && u <= 9) { mi += u; i++; }
            }
            if (i < words.length && words[i].startsWith("минут")) i++;
          }
        }
      }
    }
    let period = null;
    if (i < words.length && own(PERIODS, words[i])) { period = PERIODS[words[i]]; i++; }
    if (period === "pm" && h < 12) h += 12;
    else if (period === "night" && h === 12) h = 0;
    else if (period === null && h >= 1 && h <= 6) h += 12;   // «в пять» без уточнения = 17:00
    if (h > 23 || mi > 59) return null;
    return [h, mi, i];
  }

  function parseSchedule(words) {
    const marks = [];
    let i = 0;
    while (i < words.length) {
      if ((words[i] === "в" || words[i] === "во" || words[i] === "к") && i + 1 < words.length) {
        const r = parseClock(words.slice(i + 1));
        if (r) { marks.push([i, i + 1 + r[2], r[0], r[1]]); i += 1 + r[2]; continue; }
      }
      i++;
    }
    const items = [];
    marks.forEach(([s, e, h, mi], n) => {
      const end = n + 1 < marks.length ? marks[n + 1][0] : words.length;
      let seg = words.slice(e, end);
      if (n === 0) {
        const before = words.slice(0, s);
        while (before.length && SKIP_HEAD.has(before[0])) before.shift();
        seg = before.concat(seg);
      }
      while (seg.length && FILLER.has(seg[0])) seg.shift();
      while (seg.length && FILLER.has(seg[seg.length - 1])) seg.pop();
      if (seg.length) items.push([h, mi, seg.join(" ")]);
    });
    return items;
  }

  function calcWords(words) {
    const toks = [];
    let cur = null;
    for (const w of words) {
      if (/^\d+([.,]\d+)?$/.test(w)) cur = (cur || 0) + parseFloat(w.replace(",", "."));
      else if (own(RU_NUM, w)) cur = (cur || 0) + RU_NUM[w];
      else if (w.startsWith("тысяч")) cur = (cur || 1) * 1000;
      else if (own(CALC_OPS, w)) {
        if (cur === null) return null;
        toks.push(String(cur), CALC_OPS[w]); cur = null;
      }
    }
    if (cur === null || toks.length < 2) return null;
    toks.push(String(cur));
    const expr = toks.join("");
    if (!/^[\d.+\-*/]+$/.test(expr)) return null;
    let res;
    try { res = Function('"use strict";return (' + expr + ")")(); } catch (e) { return null; }
    if (!isFinite(res)) return "На ноль делить нельзя";
    res = Number.isInteger(res) ? res : String(Math.round(res * 10000) / 10000).replace(".", ",");
    return "Получится " + res;
  }

  const has = (cmd, ...ws) => ws.some(w => cmd.includes(w));
  function after(cmd, ...markers) {
    for (const m of markers) if (cmd.includes(m)) return cmd.split(m).slice(1).join(m).trim();
    return "";
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function kw(key, text) {
    return new RegExp("(?<![\\p{L}\\d])" + esc(key) + "[\\p{L}\\d]{0,2}(?![\\p{L}\\d])", "u").test(text);
  }
  function ratio(a, b) {           // похожесть слов 0..1 (Левенштейн)
    if (!a.length || !b.length) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  }

  const RU_DAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
    "сентября", "октября", "ноября", "декабря"];
  const ruDate = d => `${RU_DAYS[d.getDay()]}, ${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  root.JL = { RU_NUM, plural, fmtDuration, numVal, wordsNum, parseDuration, clockWords, parseClock,
    parseSchedule, calcWords, has, after, kw, ratio, ruDate, isoDate, pad, SKIP_HEAD, DATA: {"JOKES": ["Почему программисты путают Хэллоуин и Рождество? Потому что тридцать первое октября равно двадцать пятому декабря.", "Я бы рассказал вам шутку про UDP, но не уверен, что она до вас дойдёт.", "Жена просит программиста: сходи в магазин, купи батон, а если будут яйца — возьми десяток. Он вернулся с десятью батонами.", "Оптимист говорит: стакан наполовину полон. Пессимист: наполовину пуст. Инженер: стакан в два раза больше, чем нужно.", "Почему у программистов в офисе всегда прохладно? Потому что у них открыты окна. Много окон.", "— Как дела? — Работает. — А что именно? — Не трогай, пока работает.", "Искусственный интеллект не заменит людей. Кто же тогда будет ему говорить «спасибо» и «пожалуйста»?", "Компьютер как кошка: делает что хочет и смотрит с презрением, когда вы ругаетесь.", "Заходит как-то программист в лифт, а выйти не может: там нет кнопки отмены.", "Самая надёжная программа — та, которую ещё не запускали.", "Я не ленивый, я просто в режиме энергосбережения.", "Пароль должен быть как нижнее бельё: менять регулярно и никому не показывать."], "FACTS": ["Мёд почти не портится. Съедобный мёд находили даже в древнеегипетских гробницах.", "У осьминога три сердца.", "Сутки на Венере длиннее, чем её год.", "Бананы слегка радиоактивны из-за калия, но совершенно безопасны.", "Акулы появились раньше деревьев.", "Сердце у креветки находится в голове.", "Вомбаты делают кубические какашки. Это единственные такие животные.", "Свет от Солнца добирается до Земли примерно за восемь минут.", "Эйфелева башня летом становится выше на несколько сантиметров из-за теплового расширения металла.", "Кошки спят больше половины жизни.", "Молния нагревает воздух сильнее, чем температура поверхности Солнца.", "Улитки умеют спать до трёх лет подряд."], "MOTIVATION": ["Вы справитесь. Вы уже справлялись с вещами и посложнее.", "Маленький шаг сегодня лучше, чем великий план завтра.", "Даже самый длинный список дел заканчивается. Начните с первого пункта.", "Отдых — тоже часть работы. Но сначала закончите хотя бы одно дело.", "Каждый эксперт когда-то был новичком. Продолжайте.", "Не надо быть идеальным. Достаточно просто начать."], "COMPLIMENTS": ["Вы сегодня особенно хороши. Впрочем, как и всегда.", "У вас отличный вкус: вы выбрали меня.", "Редко встречаю человека, который так умеет ставить задачи.", "Вы — лучший пользователь из всех, что у меня были. Правда, других не было.", "Ваша продуктивность впечатляет даже мои процессоры."], "BALL": ["Бесспорно", "Определённо да", "Скорее да", "Знаки говорят «да»", "Пока не ясно, спросите позже", "Лучше не рассказывать сейчас", "Не рассчитывайте на это", "Мой ответ — нет", "Весьма сомнительно", "Звёзды говорят «нет»", "Шансы хорошие", "Спросите ещё раз"], "TWISTERS": ["Карл у Клары украл кораллы, а Клара у Карла украла кларнет.", "На дворе трава, на траве дрова. Не руби дрова на траве двора.", "Тридцать три корабля лавировали, лавировали, да не вылавировали.", "Шла Саша по шоссе и сосала сушку.", "Ехал Грека через реку, видит Грека — в реке рак."], "RIDDLES": [["Зимой и летом одним цветом.", ["ёлк", "елк", "ель", "сосн"], "ёлка"], ["Не лает, не кусает, а в дом не пускает.", ["зам"], "замок"], ["Без окон, без дверей, полна горница людей.", ["огур"], "огурец"], ["Сто одёжек, и все без застёжек.", ["капуст"], "капуста"], ["Висит груша, нельзя скушать.", ["лампочк", "лампа"], "лампочка"], ["Что можно увидеть с закрытыми глазами?", ["сон", "сны"], "сон"], ["Чем больше из неё берёшь, тем больше она становится.", ["яма", "ям", "дыр"], "яма"]]} };
  if (typeof module !== "undefined") module.exports = root.JL;
})(typeof window !== "undefined" ? window : globalThis);
