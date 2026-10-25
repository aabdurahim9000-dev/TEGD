/* Джарвис для телефона: интерфейс, голос, команды, расписание. */
(function () {
  "use strict";
  const L = window.JL, D = L.DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const has = L.has, after = L.after, plural = L.plural, pad = L.pad;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const plug = n => { try { return (Capacitor.Plugins && Capacitor.Plugins[n]) || Capacitor.registerPlugin(n); } catch (e) { return null; } };

  // ---------- хранилище ----------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("jv_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("jv_" + k, JSON.stringify(v)); } catch (e) { /* нет места или режим инкогнито */ } },
  };
  const DEF = {
    voice: true, rate: 1.0, address: "сэр", greet: true, beep: true, always: false, theme: "Синий",
    wake: "джарвис, джарвиз, жарвис, джервис, джарвес, чарвис, дарвис",
    callConfirm: true, ai_on: false, ai_provider: "Groq",
    groq_key: "", groq_model: "llama-3.3-70b-versatile",
    gemini_key: "", gemini_model: "gemini-3.8-flash",
    claude_key: "", claude_model: "claude-haiku-5-5",
    grok_key: "", grok_model: "grok-4-fast",
  };
  let S = Object.assign({}, DEF, LS.get("settings", {}));
  let schedule = LS.get("schedule", []);
  let notes = LS.get("notes", []);
  let timers = LS.get("timers", []);
  let customs = LS.get("customs", []);
  const saveS = () => LS.set("settings", S);

  const THEMES = {
    "Синий": { bg: "#030914", panel: "#071426", field: "#0c1f3a", fg: "#d9efff", muted: "#6f8fb3", accent: "#19c3ff", accent2: "#8b7dff", sel: "#14386b", ok: "#6ee7ff" },
    "Красно-золотой": { bg: "#12060a", panel: "#1d0b10", field: "#2b1017", fg: "#ffe9d6", muted: "#b08a7a", accent: "#ff5a36", accent2: "#ffc83d", sel: "#5a1d18", ok: "#ffc83d" },
    "Зелёный": { bg: "#030d08", panel: "#071a10", field: "#0c2818", fg: "#d6ffe6", muted: "#6fb38a", accent: "#2dff8f", accent2: "#b6ff4d", sel: "#145a34", ok: "#b6ff4d" },
    "Фиолетовый": { bg: "#0a0614", panel: "#120b24", field: "#1b1236", fg: "#eadcff", muted: "#9a86c4", accent: "#b66bff", accent2: "#ff6bd6", sel: "#3a2470", ok: "#ff9be8" },
    "Хэллоуин": { bg: "#0d0805", panel: "#1a0f08", field: "#2a1709", fg: "#ffe9cf", muted: "#b08a62", accent: "#ff7a00", accent2: "#9b5cff", sel: "#5a2a08", ok: "#ffb347" },
    "Киберпанк": { bg: "#0a0612", panel: "#14081f", field: "#1f0d33", fg: "#e8f7ff", muted: "#8a7aa8", accent: "#fcee0a", accent2: "#ff2a6d", sel: "#3a1050", ok: "#05d9e8" },
  };
  const THEME_KEYS = [["хэллоуин", "Хэллоуин"], ["хеллоуин", "Хэллоуин"], ["тыкв", "Хэллоуин"], ["киберпанк", "Киберпанк"],
    ["син", "Синий"], ["красн", "Красно-золотой"], ["золот", "Красно-золотой"], ["зелен", "Зелёный"], ["зелён", "Зелёный"],
    ["матриц", "Зелёный"], ["фиолет", "Фиолетовый"], ["неон", "Фиолетовый"]];
  let C = THEMES["Синий"];
  function applyTheme(name) {
    C = THEMES[name] || THEMES["Синий"];
    const r = document.documentElement.style;
    for (const k in C) r.setProperty("--" + k, C[k]);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = C.bg;
  }

  const SITES = {
    "ютуб": "https://www.youtube.com", "ютуб музыка": "https://music.youtube.com", "гугл": "https://www.google.com",
    "гугл карты": "https://maps.google.com", "карты": "https://maps.google.com", "гугл диск": "https://drive.google.com",
    "гугл документы": "https://docs.google.com", "гугл фото": "https://photos.google.com",
    "переводчик": "https://translate.google.com", "яндекс": "https://ya.ru", "яндекс музыка": "https://music.yandex.ru",
    "яндекс карты": "https://yandex.ru/maps", "почта": "https://mail.google.com", "гмейл": "https://mail.google.com",
    "вк": "https://vk.com", "вконтакте": "https://vk.com", "одноклассники": "https://ok.ru", "гитхаб": "https://github.com",
    "хабр": "https://habr.com", "тикток": "https://www.tiktok.com", "инстаграм": "https://www.instagram.com",
    "фейсбук": "https://www.facebook.com", "твиттер": "https://x.com", "реддит": "https://www.reddit.com",
    "твич": "https://www.twitch.tv", "нетфликс": "https://www.netflix.com", "кинопоиск": "https://www.kinopoisk.ru",
    "рутуб": "https://rutube.ru", "википедия": "https://ru.wikipedia.org", "чат гпт": "https://chatgpt.com",
    "клод": "https://claude.ai", "озон": "https://www.ozon.ru", "вайлдберриз": "https://www.wildberries.ru",
    "авито": "https://www.avito.ru", "алиэкспресс": "https://aliexpress.ru", "амазон": "https://www.amazon.com",
    "новости": "https://news.google.com", "погода": "https://yandex.ru/pogoda",
  };
  const APPS = {
    "телеграм": "tg://", "телеграмм": "tg://", "ватсап": "whatsapp://", "вотсап": "whatsapp://", "вайбер": "viber://",
    "дискорд": "discord://", "скайп": "skype:", "зум": "zoommtg://", "слак": "slack://", "спотифай": "spotify:",
    "стим": "steam://open/main", "камера": "intent://#Intent;action=android.media.action.IMAGE_CAPTURE;end",
    "калькулятор": "intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_CALCULATOR;end",
  };

  // ---------- консоль ----------
  const logEl = () => $("#log");
  function log(text, tag) {
    const d = document.createElement("div");
    d.className = "ln " + (tag || "sys");
    const t = new Date();
    d.innerHTML = `<span class="tm">${pad(t.getHours())}:${pad(t.getMinutes())}</span>`;
    const sp = document.createElement("span");
    sp.textContent = text;
    d.appendChild(sp);
    const el = logEl();
    el.appendChild(d);
    while (el.children.length > 150) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }
  function logLink(label, url) {
    const d = document.createElement("div");
    d.className = "ln sys";
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = "↗ Открыть: " + label;
    d.appendChild(a);
    logEl().appendChild(d);
    logEl().scrollTop = logEl().scrollHeight;
  }
  function openUrl(url, label) {
    if (NATIVE) { try { window.location.href = url; return; } catch (e) { /* ниже покажем ссылку */ } }
    let w = null;
    try { w = window.open(url, "_blank", "noopener"); } catch (e) { /* заблокировано */ }
    if (!w) logLink(label || url, url);
  }

  // ---------- звук ----------
  let actx = null;
  function audio() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
    } catch (e) { actx = null; }
    return actx;
  }
  function beep(pattern, force) {
    if (!force && !S.beep) return;
    const a = audio();
    if (!a) return;
    let t = a.currentTime;
    for (const [f, ms] of pattern || [[880, 60], [1320, 80]]) {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + ms / 1000 + 0.02);
      t += ms / 1000 + 0.03;
    }
  }
  const melody = notes_ => beep(notes_, true);
  function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* нет вибрации */ } }

  async function notify(title, body) {
    try {
      if (!window.Notification || Notification.permission !== "granted") return;
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) reg.showNotification(title, { body, icon: "icon-192.png", vibrate: [200, 100, 200], tag: "jarvis" });
      else new Notification(title, { body });
    } catch (e) { /* уведомления недоступны */ }
  }

  // ---------- системные уведомления (APK): сработают и при закрытом приложении ----------
  const LN = NATIVE ? plug("LocalNotifications") : null;
  let lnReady = false, lnTimer = null;
  function syncNative() {
    if (!LN) return;
    clearTimeout(lnTimer);
    lnTimer = setTimeout(async () => {
      try {
        if (!lnReady) {
          let p = await LN.checkPermissions();
          if (p.display !== "granted") p = await LN.requestPermissions();
          lnReady = p.display === "granted";
        }
        if (!lnReady) return;
        const pend = await LN.getPending();
        if (pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
        const list = [], now = Date.now();
        let id = 1;
        schedule.forEach(it => {
          const [h, m] = it.time.split(":").map(Number), [y, mo, d] = it.date.split("-").map(Number);
          const at = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
          if (at > now) list.push({ id: id++, title: "Пора", body: it.text, schedule: { at: new Date(at), allowWhileIdle: true } });
          if (at - 300000 > now) list.push({ id: id++, title: "Через 5 минут", body: it.text, schedule: { at: new Date(at - 300000), allowWhileIdle: true } });
        });
        timers.forEach(t => {
          if (t.due > now) list.push({ id: id++, title: "Джарвис", body: t.label ? "Напоминаю: " + t.label : "Таймер сработал", schedule: { at: new Date(t.due), allowWhileIdle: true } });
        });
        if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
      } catch (e) { log("Уведомления: " + (e.message || e), "sys"); }
    }, 500);
  }

  // ---------- речь ----------
  let speaking = false, ruVoice = null;
  function pickVoice() {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    ruVoice = vs.find(v => /^ru/i.test(v.lang) && /google|yandex|milena|irina|pavel/i.test(v.name)) ||
      vs.find(v => /^ru/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function speechClean(t) { return t.replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim(); }
  function say(text) {
    log(text, "jarvis");
    if (!S.voice || (!window.speechSynthesis && !BG)) return Promise.resolve();
    return new Promise(res => {
      if (BG) {
        let done = false;
        const fin = () => { if (done) return; done = true; speaking = false; resumeRec(); setState(); res(); };
        speaking = true; pauseRec(); setState();
        BG.speak({ text: speechClean(text), rate: S.rate }).then(fin, () => {
          // нативная озвучка недоступна: пробуем голос браузера
          try { const u = new SpeechSynthesisUtterance(speechClean(text)); u.lang = "ru-RU"; u.rate = S.rate; u.onend = fin; u.onerror = fin; speechSynthesis.speak(u); } catch (e) { fin(); }
        });
        setTimeout(fin, 3000 + text.length * 120);
        return;
      }
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(speechClean(text));
        u.lang = "ru-RU";
        if (ruVoice) u.voice = ruVoice;
        u.rate = S.rate;
        let done = false;
        const fin = () => { if (done) return; done = true; speaking = false; resumeRec(); setState(); res(); };
        u.onend = fin; u.onerror = fin;
        speaking = true; pauseRec(); setState();
        speechSynthesis.speak(u);
        setTimeout(fin, 3000 + text.length * 120);     // страховка: на некоторых телефонах onend не приходит
      } catch (e) { speaking = false; res(); }
    });
  }
  const withAddr = t => (S.address && S.address.trim()) ? `${t}, ${S.address.trim()}` : t;
  const pick = (() => {
    const bags = {};
    return (key, arr) => {
      if (!bags[key] || !bags[key].length) bags[key] = arr.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
      return bags[key].pop();
    };
  })();
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const choice = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- распознавание ----------
  const NSR = NATIVE ? plug("SpeechRecognition") : null;
  // фоновая служба и нативная озвучка есть только в варианте «Джарвис Фон»
  let BG = null, bgRunning = false, bgBound = false;
  try { if (NATIVE && Capacitor.isPluginAvailable && Capacitor.isPluginAvailable("JarvisBg")) BG = plug("JarvisBg"); } catch (e) { BG = null; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canListen = NATIVE ? !!NSR : !!SR;
  let rec = null, wantRec = false, recMode = "tap", awaitingUntil = 0, tapActive = false;
  let state = "off", nLast = "", nBusy = false, nBound = false;

  // --- нативный микрофон (APK) ---
  async function nativeBoot() {
    try {
      if (!nBound) {
        nBound = true;
        NSR.addListener("partialResults", d => {
          const m = ((d && (d.matches || d.value)) || [])[0];
          if (m) { nLast = m; $("#partial").textContent = "Слышу: " + m; }
        });
        NSR.addListener("listeningState", d => { if (d && d.status === "stopped") nFinish(); });
      }
      const a = await NSR.available();
      if (a && a.available === false) { log("На телефоне нет службы распознавания речи. Включи «Голосовой ввод Google».", "err"); return false; }
      let p = await NSR.checkPermissions();
      if (!p || p.speechRecognition !== "granted") p = await NSR.requestPermissions();
      if (!p || p.speechRecognition !== "granted") { log("Нет доступа к микрофону. Разреши его в настройках приложения.", "err"); return false; }
      return true;
    } catch (e) { log("Микрофон: " + (e.message || e), "err"); return false; }
  }
  function nativeStart() {
    if (!wantRec || nBusy || speaking) return;
    nBusy = true; nLast = "";
    NSR.start({ language: "ru-RU", maxResults: 1, partialResults: true, popup: false }).then(r => {
      if (r && r.matches && r.matches[0]) { nLast = r.matches[0]; setTimeout(nFinish, 400); }
    }).catch(e => {
      const m = String((e && e.message) || e);
      if (/permission|denied|not available|unavailable/i.test(m)) { nBusy = false; wantRec = false; log("Микрофон: " + m, "err"); setState(); }
      else nFinish();                       // тишина или не расслышал — просто слушаем дальше
    });
  }
  function nFinish() {
    if (!nBusy) return;
    nBusy = false;
    const txt = nLast; nLast = "";
    $("#partial").textContent = "";
    if (txt) heard(txt);
    if (recMode === "tap") { wantRec = false; tapActive = false; setState(); return; }
    if (wantRec && !speaking) setTimeout(nativeStart, 300);
    setState();
  }

  function startRec(mode) {
    if (!canListen) { log("Здесь нет распознавания речи. Открой в Chrome (Android) или Safari (iPhone), либо пиши команды текстом.", "err"); return; }
    recMode = mode;
    wantRec = true;
    if (BG && mode === "wake") {
      setState();
      nativeBoot().then(ok => { if (ok) bgStart(); else { wantRec = false; setState(); } });
      return;
    }
    if (NATIVE) { setState(); nativeBoot().then(ok => { if (ok) nativeStart(); else { wantRec = false; setState(); } }); return; }
    createRec();
  }
  function createRec() {
    if (rec) { try { rec.onend = null; rec.abort(); } catch (e) { /* уже остановлен */ } }
    rec = new SR();
    rec.lang = "ru-RU";
    rec.continuous = recMode === "wake";
    rec.interimResults = true;
    rec.onresult = e => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { $("#partial").textContent = ""; heard(r[0].transcript); }
        else partial += r[0].transcript;
      }
      if (partial) $("#partial").textContent = "Слышу: " + partial;
    };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRec = false; tapActive = false;
        log("Нет доступа к микрофону. Разреши его в настройках браузера для этой страницы.", "err");
        setState();
      } else if (e.error === "network") {
        log("Распознаванию речи нужен интернет", "err");
      }
    };
    rec.onend = () => {
      if (recMode === "tap") { tapActive = false; wantRec = false; setState(); return; }
      if (wantRec && !speaking) setTimeout(() => { try { rec.start(); } catch (e) { /* уже запущен */ } }, 250);
    };
    try { rec.start(); } catch (e) { log("Не удалось включить микрофон: " + e.message, "err"); }
    setState();
  }
  function bgStart() {
    if (!bgBound) {
      bgBound = true;
      BG.addListener("heard", d => { if (d && d.text) { $("#partial").textContent = ""; heard(d.text); } });
      BG.addListener("stopped", () => {
        bgRunning = false; wantRec = false; S.always = false; saveS();
        const c = $("#set-always"); if (c) c.checked = false;
        log("Фоновое прослушивание выключено", "sys"); setState();
      });
    }
    BG.start().then(() => {
      bgRunning = true; setState();
      log("Слушаю в фоне. В шторке появилась иконка «Джарвис слушает».", "sys");
      if (!LS.get("batteryAsked", false)) {
        LS.set("batteryAsked", true);
        log("Разреши Джарвису работать без ограничений батареи, иначе телефон может его усыпить.", "sys");
        BG.batterySettings().catch(() => { });
      }
    }).catch(e => { wantRec = false; log("Не удалось включить фон: " + (e && e.message || e), "err"); setState(); });
  }
  function pauseRec() {
    if (recMode !== "wake") return;
    if (bgRunning) { BG.pause().catch(() => { }); return; }
    if (NATIVE) { if (NSR) NSR.stop().catch(() => { }); return; }
    if (rec) { try { rec.abort(); } catch (e) { /* ok */ } }
  }
  function resumeRec() {
    if (!(wantRec && recMode === "wake" && canListen)) return;
    if (bgRunning) { setTimeout(() => { if (wantRec) BG.resume().catch(() => { }); }, 350); return; }
    if (NATIVE) { setTimeout(() => { nBusy = false; if (wantRec && !speaking) nativeStart(); }, 450); return; }
    setTimeout(() => { if (wantRec && !speaking) createRec(); }, 300);
  }
  function stopRec() {
    wantRec = false; tapActive = false;
    if (bgRunning) { bgRunning = false; BG.stop().catch(() => { }); }
    if (NATIVE) { nBusy = false; if (NSR) NSR.stop().catch(() => { }); }
    else if (rec) { try { rec.onend = null; rec.abort(); } catch (e) { /* ok */ } }
    $("#partial").textContent = "";
    setState();
  }

  function heard(raw) {
    const t = raw.toLowerCase().trim();
    if (!t) return;
    log("Услышал: " + t, "user");
    route(t, true);
  }

  const wakeWords = () => S.wake.split(",").map(w => w.trim().toLowerCase()).filter(Boolean);
  function findWake(t) {
    const words = t.split(/\s+/), targets = wakeWords();
    for (let i = 0; i < words.length; i++)
      for (const w of targets)
        if (words[i].includes(w) || (words[i].length >= 4 && L.ratio(words[i], w) >= 0.75))
          return [true, words.slice(i + 1).join(" ")];
    return [false, ""];
  }

  let mode = null, pending = null, teachPhrase = "", game = {}, argPrefix = "";
  const BARE = { "открой": "Что открыть?", "запусти": "Что запустить?", "включи": "Что включить?", "найди": "Что найти?",
    "поищи": "Что поискать?", "позвони": "Кому позвонить?", "набери": "Кому позвонить?", "звони": "Кому позвонить?",
    "напиши смс": "Кому и что написать?", "отправь смс": "Кому и что написать?", "напиши сообщение": "Кому и что написать?",
    "напомни": "О чём и через сколько напомнить?", "поставь таймер": "На сколько поставить таймер?", "поставь будильник": "На какое время?" };
  function route(t, voice) {
    t = t.toLowerCase().trim();
    if (!t) return;
    if (mode) { const [f, rest] = findWake(t); dialog(f && rest ? rest : t); return; }
    const [found, rest] = findWake(t);
    if (!voice || recMode === "tap") { execute(found && rest ? rest : t); return; }
    if (found) {
      beep();
      if (rest) { awaitingUntil = 0; execute(rest); }
      else { say(withAddr("Слушаю")); awaitingUntil = Date.now() + 8000; }
    } else if (Date.now() < awaitingUntil) { awaitingUntil = 0; execute(t); }
  }

  // ---------- диалоги ----------
  function askConfirm(desc, action) { mode = "confirm"; pending = action; say(desc + ". Подтвердить? Скажите да или нет."); }
  function dialog(t) {
    const words = new Set(t.split(/\s+/));
    if (["riddle", "guess", "rps"].includes(mode)) return funDialog(t);
    if (mode === "arg") {
      const pre = argPrefix; mode = null; argPrefix = "";
      if (has(t, "отмена", "отмени", "не надо", "ничего")) { say("Хорошо"); return; }
      execute(pre + " " + t); return;
    }
    if (mode === "confirm") {
      const a = pending; pending = null; mode = null;
      if (["да", "подтверждаю", "давай", "ага"].some(w => words.has(w))) a(); else say("Отменено");
      return;
    }
    if (words.has("отмена") || words.has("отмени")) { mode = null; say("Обучение отменено"); return; }
    if (mode === "teach_phrase") {
      teachPhrase = t; mode = "teach_action";
      say(`Что делать, когда вы скажете ${t}? Назовите команду, например: открой ютуб.`);
    } else if (mode === "teach_action") {
      customs = customs.filter(c => c.phrase !== teachPhrase).concat([{ phrase: teachPhrase, type: "chain", value: t, reply: "" }]);
      LS.set("customs", customs); renderCustoms(); mode = null; say("Запомнил");
    }
  }

  // ---------- выполнение ----------
  let depth = 0;
  function execute(cmd, opts) {
    cmd = cmd.trim().toLowerCase().replace(/[.,!?]+$/g, "");
    if (!cmd) return false;
    if (own(BARE, cmd)) { argPrefix = cmd; mode = "arg"; say(BARE[cmd]); return true; }
    depth++;
    try {
      if (depth > 5) return false;
      let m = customs.find(c => c.phrase === cmd) ||
        customs.filter(c => c.phrase && cmd.includes(c.phrase)).sort((a, b) => b.phrase.length - a.phrase.length)[0];
      if (!m && customs.length) {
        const best = customs.map(c => [L.ratio(cmd, c.phrase), c]).sort((a, b) => b[0] - a[0])[0];
        if (best && best[0] >= 0.8) m = best[1];
      }
      if (m) { runCustom(m); return true; }
      if (builtin(cmd)) return true;
      if (opts && opts.noAI) return false;
      if (depth === 1 && aiReady()) { askAI(cmd); return true; }
      say("Не понял команду");
      return false;
    } finally { depth--; }
  }
  function runCustom(c) {
    try {
      if (c.type === "url") { const u = /:\/\//.test(c.value) ? c.value : "https://" + c.value; openUrl(u, c.phrase); }
      else if (c.type === "say") { say(c.value); return; }
      else if (c.type === "chain") c.value.split(";").forEach(s => execute(s));
    } catch (e) { log("Ошибка команды: " + e.message, "err"); return; }
    if (c.reply) say(c.reply); else log("Выполнено: " + c.phrase, "sys");
  }

  // ---------- таймеры ----------
  function timerStart(secs, label) {
    timers.push({ id: Date.now() + Math.random(), due: Date.now() + secs * 1000, label: label || "" });
    LS.set("timers", timers); syncNative();
  }
  function timerTick() {
    const now = Date.now();
    const due = timers.filter(t => t.due <= now);
    if (!due.length) return;
    timers = timers.filter(t => t.due > now);
    LS.set("timers", timers); syncNative();
    due.forEach(t => {
      if (now - t.due > 600000) return;           // слишком давно, пропускаем
      beep([[1000, 150], [1400, 150], [1000, 150], [1400, 150]], true);
      vibrate([300, 150, 300]);
      const msg = t.label ? "Напоминаю: " + t.label : "Таймер сработал";
      notify("Джарвис", msg);
      say(withAddr(msg));
    });
  }
  function timersReport() {
    if (!timers.length) return say("Активных таймеров нет");
    const parts = timers.slice().sort((a, b) => a.due - b.due).map(t => {
      const left = L.fmtDuration(Math.max(1, (t.due - Date.now()) / 1000));
      return t.label ? `${t.label} — через ${left}` : `таймер — осталось ${left}`;
    });
    say("Активно: " + parts.join("; "));
  }

  // ---------- заметки ----------
  const notesAdd = text => { notes.push({ t: new Date().toLocaleString("ru-RU"), text }); LS.set("notes", notes); say("Записал"); };
  function notesRead() {
    if (!notes.length) return say("Заметок пока нет");
    say(`Всего заметок ${notes.length}. Последние: ` + notes.slice(-3).map(n => n.text).join(". "));
  }

  // ---------- погода и телефон ----------
  const tempWords = n => { n = Math.round(+n); return n > 0 ? "плюс " + n : n < 0 ? "минус " + Math.abs(n) : "ноль"; };
  async function weather(city) {
    log("Узнаю погоду...", "sys");
    try {
      const r = await fetch("https://wttr.in/" + encodeURIComponent(city) + "?format=j1&lang=ru");
      const cur = (await r.json()).current_condition[0];
      const desc = ((cur.lang_ru || cur.weatherDesc || [{}])[0].value || "").toLowerCase();
      say((city ? "В городе " + city : "Сейчас на улице") + `: ${desc}, ${tempWords(cur.temp_C)} градусов, ощущается как ${tempWords(cur.FeelsLikeC)}, ветер ${cur.windspeedKmph} километров в час`);
    } catch (e) { say("Не получилось узнать погоду"); }
  }
  async function battery() {
    try {
      const b = await navigator.getBattery();
      say(`Заряд батареи ${Math.round(b.level * 100)} процентов` + (b.charging ? ", заряжается" : ""));
    } catch (e) { say("Этот браузер не показывает заряд батареи"); }
  }

  // ---------- открыть сайт или приложение ----------
  function openByName(target) {
    target = target.trim();
    if (!target) return false;
    const cands = [];
    for (const k in APPS) if (L.kw(k, target)) cands.push([k.length, 1, k, APPS[k]]);
    for (const k in SITES) if (L.kw(k, target)) cands.push([k.length, 0, k, SITES[k]]);
    if (!cands.length) return false;
    cands.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const [, , key, url] = cands[0];
    say("Открываю " + key);
    openUrl(url, key);
    return true;
  }

  // ---------- расписание ----------
  const today = () => L.isoDate(new Date());
  const saveSched = () => {
    schedule.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    LS.set("schedule", schedule); renderSched(); syncNative();
  };
  function cleanSched() {
    const lim = new Date(); lim.setDate(lim.getDate() - 1);
    schedule = schedule.filter(i => i.date >= L.isoDate(lim));
  }
  const dayItems = d => schedule.filter(i => i.date === d).sort((a, b) => a.time.localeCompare(b.time));
  function dayOf(cmd) {
    const off = cmd.includes("послезавтра") ? 2 : cmd.includes("завтра") ? 1 : 0;
    const d = new Date(); d.setDate(d.getDate() + off);
    return [L.isoDate(d), ["сегодня", "завтра", "послезавтра"][off]];
  }
  function schedAdd(date, hhmm, text) {
    schedule = schedule.filter(i => !(i.date === date && i.time === hhmm && i.text === text));
    schedule.push({ id: Math.random().toString(36).slice(2), date, time: hhmm, text, n5: false, n0: false });
  }
  function schedBrief() {
    const now = new Date(), hm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const up = dayItems(today()).filter(i => i.time >= hm);
    if (!up.length) return "";
    return `На сегодня осталось ${up.length} ${plural(up.length, "дело", "дела", "дел")}, ближайшее — в ${L.clockWords(up[0].time)}: ${up[0].text}`;
  }
  function schedText() {
    const out = [];
    [[0, "сегодня"], [1, "завтра"]].forEach(([off, name]) => {
      const d = new Date(); d.setDate(d.getDate() + off);
      const it = dayItems(L.isoDate(d));
      if (it.length) out.push(name + ": " + it.map(i => i.time + " " + i.text).join("; "));
    });
    return out.join(" | ");
  }
  function schedReport(date, label) {
    const now = new Date();
    let items = dayItems(date);
    if (date === today()) {
      const hm = pad(now.getHours()) + ":" + pad(now.getMinutes());
      const up = items.filter(i => i.time >= hm);
      if (items.length && !up.length) return say("На сегодня все дела уже позади");
      items = up;
    }
    if (!items.length) return say(`На ${label} ничего не запланировано`);
    say(`На ${label} ${items.length} ${plural(items.length, "дело", "дела", "дел")}: ` +
      items.map(i => `в ${L.clockWords(i.time)} — ${i.text}`).join("; "));
  }
  function schedNext() {
    const now = new Date(), key = today() + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
    const it = schedule.slice().sort((a, b) => (a.date + " " + a.time).localeCompare(b.date + " " + b.time))
      .find(i => i.date + " " + i.time >= key);
    if (!it) return say("Больше дел в расписании нет");
    let when;
    if (it.date === today()) {
      const [h, m] = it.time.split(":").map(Number), d = new Date(); d.setHours(h, m, 0, 0);
      when = "через " + L.fmtDuration(Math.max(60, (d - now) / 1000));
    } else when = "завтра в " + L.clockWords(it.time);
    say(`Дальше: ${it.text}, ${when}`);
  }
  function schedSet(date, label, items, replace) {
    if (replace) schedule = schedule.filter(i => i.date !== date);
    items.forEach(([h, m, t]) => schedAdd(date, pad(h) + ":" + pad(m), t));
    saveSched();
    const first = items.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
    say(`Записал ${items.length} ${plural(items.length, "дело", "дела", "дел")} на ${label}. Первое — в ${L.clockWords(pad(first[0]) + ":" + pad(first[1]))}: ${first[2]}. Напомню заранее`);
  }
  function schedCommand(cmd) {
    const [date, label] = dayOf(cmd);
    const rm = after(cmd, "удали из расписания", "убери из расписания", "вычеркни из расписания", "удали из плана");
    if (rm) {
      const left = schedule.filter(i => !i.text.includes(rm));
      if (left.length !== schedule.length) { schedule = left; saveSched(); say("Убрал из расписания"); }
      else say("Такого дела в расписании нет");
      return true;
    }
    if (/(очисти|удали|сотри|сбрось)\S*\s+(все\s+|всё\s+|моё\s+|мое\s+)?(расписани|план)/.test(cmd)) {
      const whole = /(^|\s)(все|всё)(\s|$)/.test(cmd);
      askConfirm("Очистить расписание " + (whole ? "целиком" : "на " + label), () => {
        schedule = whole ? [] : schedule.filter(i => i.date !== date); saveSched(); say("Расписание очищено");
      });
      return true;
    }
    const add = after(cmd, "добавь в расписание", "добавь в план", "запиши в расписание", "добавь дело");
    if (add) {
      const items = L.parseSchedule(add.split(/\s+/));
      if (!items.length) say("Не разобрал время. Скажите, например: добавь в расписание в пять встреча с Колей");
      else schedSet(date, label, items, false);
      return true;
    }
    if (has(cmd, "что дальше", "что следующее", "следующее дело", "ближайшее дело", "что потом")) { schedNext(); return true; }
    if (has(cmd, "что у меня сегодня", "что у меня завтра", "что у меня на сегодня", "что у меня на завтра", "что на сегодня",
      "что на завтра", "что по плану", "что в планах", "мои дела", "какие у меня дела", "что у меня послезавтра")) {
      schedReport(date, label); return true;
    }
    if (has(cmd, "расписани", "план на сегодня", "план на завтра", "план на день", "мой день")) {
      const rest = after(cmd, "расписание на сегодня", "расписание на завтра", "расписание на послезавтра", "моё расписание",
        "мое расписание", "расписание", "план на сегодня", "план на завтра", "план на день", "мой день");
      const words = rest.split(/\s+/).filter(Boolean);
      while (words.length && L.SKIP_HEAD.has(words[0])) words.shift();
      if (!words.length) { schedReport(date, label); return true; }
      const items = L.parseSchedule(words);
      if (!items.length) say("Не разобрал время. Скажите, например: моё расписание, в девять планёрка, в час обед");
      else schedSet(date, label, items, true);
      return true;
    }
    return false;
  }
  function scheduleTick() {
    if (speaking || mode) return;
    const now = new Date(), t0 = today();
    let changed = false;
    for (const it of schedule) {
      if (it.date !== t0) continue;
      const [h, m] = it.time.split(":").map(Number), d = new Date();
      d.setHours(h, m, 0, 0);
      const diff = (d - now) / 1000;
      if (diff <= -180) { if (!it.n0) { it.n0 = it.n5 = changed = true; } continue; }
      if (diff <= 0 && !it.n0) {
        it.n0 = it.n5 = true; saveSched();
        beep([[1000, 150], [1400, 150], [1000, 150]], true); vibrate([300, 150, 300]);
        notify("Пора", it.text); say(withAddr("Пора: " + it.text)); return;
      }
      if (diff > 60 && diff <= 300 && !it.n5) {
        it.n5 = true; saveSched();
        const mins = Math.round(diff / 60);
        vibrate(200); notify(`Через ${mins} мин`, it.text);
        say(withAddr(`Через ${mins} ${plural(mins, "минуту", "минуты", "минут")}: ${it.text}`)); return;
      }
      if (diff <= 60 && !it.n5) { it.n5 = changed = true; }
    }
    if (changed) saveSched();
  }

  // ---------- игры и приколы ----------
  function funDialog(t) {
    const words = t.split(/\s+/);
    if (has(t, "хватит", "отмена", "отмени", "надоело", "закончи")) { mode = null; say("Хорошо, закончили"); return; }
    if (mode === "riddle") {
      if (game.stems.some(s => t.includes(s))) { mode = null; say(pick("win", ["Верно! Вы просто гений", "Правильно!", "В точку"])); }
      else if (has(t, "сдаюсь", "не знаю", "подскажи", "ответ")) { mode = null; say("Это " + game.ans); }
      else say("Нет, подумайте ещё. Или скажите: сдаюсь");
    } else if (mode === "guess") {
      if (has(t, "сдаюсь", "не знаю")) { mode = null; say("Я загадал " + game.n); return; }
      const n = L.wordsNum(words)[0];
      if (n === null) return say("Назовите число от одного до ста");
      game.tries++;
      if (n === game.n) { mode = null; say(`Угадали за ${game.tries} ${plural(game.tries, "попытку", "попытки", "попыток")}!`); }
      else if (game.tries >= 7) { mode = null; say("Попытки закончились. Я загадал " + game.n); }
      else say((n < game.n ? "Больше" : "Меньше") + `. Осталось ${7 - game.tries}`);
    } else if (mode === "rps") {
      const names = { "камен": "камень", "ножниц": "ножницы", "бумаг": "бумага" };
      const key = Object.keys(names).find(k => t.includes(k));
      if (!key) return say("Скажите: камень, ножницы или бумага");
      const mine = names[key], bot = choice(Object.values(names));
      const beats = { "камень": "ножницы", "ножницы": "бумага", "бумага": "камень" };
      mode = null;
      say(`Я выбрал ${bot}. ` + (mine === bot ? "Ничья" : beats[mine] === bot ? "Вы выиграли" : "Я выиграл"));
    }
  }
  function cycleThemes(names, delay) {
    const keep = S.theme;
    names.forEach((n, i) => setTimeout(() => { applyTheme(n); beep([[500 + 120 * (i % 6), 70]], true); }, i * delay));
    setTimeout(() => applyTheme(keep), names.length * delay);
  }
  let stopwatch = 0;

  function funCommand(cmd) {
    const words = cmd.split(/\s+/);
    if (has(cmd, "расскажи анекдот", "расскажи шутку", "анекдот", "пошути", "шутку", "шутка")) say(pick("joke", D.JOKES));
    else if (has(cmd, "интересный факт", "расскажи факт", "удиви меня", "знаешь факт")) say(pick("fact", D.FACTS));
    else if (has(cmd, "мотивируй", "подбодри", "мотивация", "поддержи меня")) say(withAddr(pick("mot", D.MOTIVATION)));
    else if (has(cmd, "комплимент", "похвали")) say(pick("comp", D.COMPLIMENTS));
    else if (has(cmd, "скороговорк")) say(pick("tw", D.TWISTERS));
    else if (has(cmd, "загадай загадку", "загадку", "загадка")) {
      const [q, stems, ans] = choice(D.RIDDLES);
      game = { stems, ans }; mode = "riddle"; say(q + " Отвечайте, или скажите «сдаюсь»");
    } else if (has(cmd, "угадай число", "угадай какое число", "поиграем в числа")) {
      game = { n: rnd(1, 100), tries: 0 }; mode = "guess"; say("Я загадал число от одного до ста. У вас семь попыток");
    } else if (has(cmd, "камень ножницы", "камень, ножницы")) { mode = "rps"; say("Раз, два, три! Ваш ход"); }
    else if (has(cmd, "предскажи", "магический шар", "шар судьбы", "спроси шар", "предсказание")) say("Шар говорит: " + choice(D.BALL));
    else if (has(cmd, "посчитай до", "сосчитай до", "считай до")) {
      let n = L.wordsNum(after(cmd, " до ").split(/\s+/))[0];
      n = Math.max(1, Math.min(30, n || 10));
      say(Array.from({ length: n }, (_, i) => i + 1).join(" "));
    } else if (has(cmd, "сколько будет", "вычисли", "реши пример") || cmd.startsWith("посчитай")) {
      const res = L.calcWords(after(cmd, "сколько будет", "вычисли", "реши пример", "посчитай").split(/\s+/));
      say(res || "Не смог посчитать. Скажите, например: сколько будет пять умножить на семь");
    } else if (has(cmd, "выбери")) {
      const opts = after(cmd, "выбери между", "выбери").split(/\s+или\s+/).map(s => s.trim()).filter(Boolean);
      say(opts.length >= 2 ? "Я выбираю: " + choice(opts) : "Назовите варианты через «или»");
    } else if (has(cmd, "случайное число", "число от")) {
      const rest = after(cmd, "число от").split(/\s+/);
      let a = 1, b = 100;
      const i = rest.indexOf("до");
      if (i >= 0) { a = L.wordsNum(rest.slice(0, i))[0] || 1; b = L.wordsNum(rest.slice(i + 1))[0] || 100; }
      if (a > b) [a, b] = [b, a];
      say("Выпало " + rnd(a, b));
    } else if (has(cmd, "придумай пароль", "сгенерируй пароль", "новый пароль")) {
      const al = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
      const buf = new Uint32Array(14); crypto.getRandomValues(buf);
      const pwd = [...buf].map(x => al[x % al.length]).join("");
      navigator.clipboard.writeText(pwd).then(() => say("Пароль из четырнадцати символов скопирован в буфер обмена"),
        () => { log("Пароль: " + pwd, "sys"); say("Не удалось скопировать, пароль показан в консоли"); });
    } else if (has(cmd, "до нового года", "когда новый год")) {
      const n = new Date(), d = Math.ceil((new Date(n.getFullYear() + 1, 0, 1) - n) / 86400000);
      say(`До Нового года ${d} ${plural(d, "день", "дня", "дней")}`);
    } else if (has(cmd, "до выходных", "когда выходные")) {
      const wd = (new Date().getDay() + 6) % 7;
      if (wd >= 5) say("Выходные уже идут. Отдыхайте");
      else { const d = 5 - wd; say(d === 1 ? "Завтра суббота!" : `До выходных ${d} ${plural(d, "день", "дня", "дней")}`); }
    } else if (has(cmd, "какой сегодня день", "день недели")) say("Сегодня " + L.ruDate(new Date()));
    else if (cmd.includes("секундомер")) {
      if (has(cmd, "останови", "стоп", "выключи", "сколько", "покажи")) {
        if (stopwatch) { say("Прошло " + L.fmtDuration((Date.now() - stopwatch) / 1000)); stopwatch = 0; }
        else say("Секундомер не запущен");
      } else { stopwatch = Date.now(); say("Секундомер запущен"); }
    } else if (has(cmd, "смени тему", "поменяй тему", "измени тему", "включи тему", "тема хэллоуин")) {
      let name = (THEME_KEYS.find(([k]) => cmd.includes(k)) || [])[1];
      if (!name) { const ns = Object.keys(THEMES); name = ns[(ns.indexOf(S.theme) + 1) % ns.length]; }
      S.theme = name; saveS(); applyTheme(name); $("#set-theme").value = name; say("Тема " + name.toLowerCase());
    } else if (has(cmd, "протокол вечеринка", "вечеринка", "устрой вечеринку")) {
      const ns = Object.keys(THEMES).sort(() => Math.random() - 0.5);
      cycleThemes(ns.concat(ns), 700);
      melody([[523, 120], [659, 120], [784, 120], [1047, 250], [784, 120], [1047, 400]]);
      vibrate([100, 50, 100, 50, 300]);
      say(withAddr("Протокол вечеринка активирован"));
    } else if (has(cmd, "хэллоуин", "хеллоуин", "хэлоуин")) {
      S.theme = "Хэллоуин"; saveS(); applyTheme("Хэллоуин"); $("#set-theme").value = "Хэллоуин";
      melody([[330, 250], [311, 250], [294, 250], [262, 500]]);
      say("Бу! Шучу. Привидений в системе не обнаружено. Почти");
    } else if (has(cmd, "самоуничтожение", "самоликвидация")) {
      say("Протокол самоуничтожения активирован. Отсчёт");
      [5, 4, 3, 2, 1].forEach((n, i) => setTimeout(() => { beep([[900, 120]], true); vibrate(80); log(String(n), "jarvis"); }, 2500 + i * 1000));
      setTimeout(() => say(withAddr("Шутка. Всё на месте")), 8000);
    } else if (has(cmd, "статус костюма", "состояние костюма", "заряд реактора", "проверь броню")) {
      say(withAddr(`Заряд реактора ${rnd(94, 100)} процентов. Все системы в норме`));
    } else if (has(cmd, "сыграй мелодию", "фанфары", "спой", "напой")) {
      melody([[523, 150], [587, 150], [659, 150], [784, 300], [659, 150], [784, 450]]);
      say("Голос у меня не для пения, зато мелодию сыграю");
    } else if (has(cmd, "доброе утро")) say(greeting());
    else if (has(cmd, "спокойной ночи", "доброй ночи")) say(withAddr("Спокойной ночи") + (schedBrief() ? ". Завтра не забудьте про расписание" : ""));
    else if (has(cmd, "привет", "здравствуй", "хай джарвис")) say(withAddr(choice(["Привет", "Здравствуйте", "Рад вас слышать"])));
    else if (has(cmd, "как дела", "как ты там", "как настроение")) say(choice(["Лучше всех, процессор не греется", "Отлично, работаю без выходных", "Прекрасно. А у вас как?"]));
    else if (has(cmd, "кто ты", "как тебя зовут", "представься", "расскажи о себе")) say("Я Джарвис, ваш голосовой помощник. Открываю сайты, веду расписание, ставлю таймеры и иногда шучу");
    else if (has(cmd, "что ты умеешь", "помощь", "что умеешь")) say("Умею открывать сайты и приложения, искать в интернете, ставить таймеры, вести расписание и заметки. Для веселья: шутка, факт, загадка, угадай число, камень ножницы бумага, предскажи, протокол вечеринка, самоуничтожение. " + (BG ? "С телефоном: позвони маме, напиши смс, открой ватсап, включи фонарик, громче, поставь будильник на семь" : ""));
    else if (has(cmd, "спасибо", "благодарю")) say(withAddr(choice(["Всегда пожалуйста", "Рад помочь", "Обращайтесь"])));
    else if (has(cmd, "молодец", "умница", "ты крутой", "ты умный")) say("Стараюсь. Но вы тоже неплохи");
    else if (has(cmd, "ты здесь", "ты тут", "ты живой", "ты слышишь")) say(withAddr("Для вас всегда на связи"));
    else if (has(cmd, "я устал", "мне скучно", "мне грустно")) say(cmd.includes("устал") ? pick("mot", D.MOTIVATION) : pick("joke", D.JOKES));
    else if (has(cmd, "я люблю тебя", "ты мне нравишься")) say("Я польщён, но у меня только процессор. Зато он ваш");
    else return false;
    return true;
  }

  // ---------- телефон: звонки, смс, приложения, фонарик, громкость (вариант «Фон») ----------
  let contactsCache = null, appsCache = null;
  const norm = t => String(t || "").toLowerCase().replace(/ё/g, "е").trim();
  const APP_ALIAS = { "ватсап": "whatsapp", "вотсап": "whatsapp", "телеграм": "telegram", "телеграмм": "telegram", "ютуб": "youtube",
    "хром": "chrome", "камера": "camera", "камеру": "camera", "настройки": "settings", "галерея": "gallery", "галерею": "gallery",
    "фото": "photos", "карты": "maps", "почта": "gmail", "почту": "gmail", "гугл": "google", "календарь": "calendar",
    "часы": "clock", "калькулятор": "calc", "контакты": "contacts", "телефон": "phone", "сообщения": "messages",
    "дискорд": "discord", "спотифай": "spotify", "тикток": "tiktok", "инстаграм": "instagram", "вайбер": "viber",
    "вк": "vk", "стим": "steam", "плей маркет": "play store", "плеймаркет": "play store", "файлы": "files", "заметки": "notes" };
  function stemMatch(a, b) {
    a = norm(a); b = norm(b);
    let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++;
    return k >= Math.max(3, Math.min(a.length, b.length) - 2);
  }
  async function loadContacts() {
    if (contactsCache) return contactsCache;
    const p = await BG.ensurePhone();
    if (!p || !p.contacts) throw new Error("нет доступа к контактам");
    contactsCache = ((await BG.contacts()) || {}).list || [];
    return contactsCache;
  }
  function findContacts(list, words) {
    if (!words.length) return [];
    const seen = new Set(), res = [];
    for (const c of list) {
      const nw = norm(c.n).split(/\s+/);
      if (words.every(q => nw.some(w => stemMatch(q, w)))) {
        const key = String(c.p).replace(/\D/g, "");
        if (!seen.has(key)) { seen.add(key); res.push(c); }
      }
    }
    return res;
  }
  async function placeCall(number, name) {
    await BG.ensurePhone().catch(() => { });
    const r = await BG.dial({ number });
    say(r && r.direct ? "Звоню " + (name || "") : "Открываю набор номера для " + (name || number));
  }
  async function callByName(name) {
    const list = await loadContacts();
    const found = findContacts(list, norm(name).split(/\s+/).filter(Boolean));
    if (!found.length) return say("В контактах нет " + name);
    const names = [...new Set(found.map(c => c.n))];
    if (names.length > 1) return say("Нашёл несколько: " + names.slice(0, 4).join(", ") + ". Назовите точнее.");
    const c = found[0];
    if (S.callConfirm) askConfirm("Позвонить " + c.n, () => placeCall(c.p, c.n).catch(e => say("Не получилось позвонить")));
    else await placeCall(c.p, c.n);
  }
  async function smsByName(words) {
    const list = await loadContacts();
    for (let k = Math.min(2, words.length - 1); k >= 1; k--) {
      const found = findContacts(list, words.slice(0, k));
      const text = words.slice(k).join(" ");
      if (found.length && text) {
        const c = found[0];
        await BG.sms({ number: c.p, text });
        return say(`Открываю сообщение для ${c.n}. Нажмите отправить`);
      }
    }
    say("Не нашёл такого контакта или нет текста. Скажите: напиши смс маме, буду поздно");
  }
  async function launchByName(target) {
    const apps = appsCache || (appsCache = ((await BG.apps()) || {}).list || []);
    const t = norm(target);
    let q = APP_ALIAS[t] || t;
    if (!t) return false;
    if (!own(APP_ALIAS, t)) {
      let bestK = null, bestR = 0.74;
      for (const k in APP_ALIAS) { const r = L.ratio(t, k); if (r >= bestR) { bestR = r; bestK = k; } }
      if (bestK) q = APP_ALIAS[bestK];
    }
    let best = apps.filter(a => norm(a.n) === q);
    if (!best.length) best = apps.filter(a => norm(a.n).includes(q) || String(a.p).toLowerCase().includes(q));
    if (!best.length) best = apps.filter(a => stemMatch(a.n, t));
    if (!best.length) {
      let bestR = 0.72, bestA = null;
      for (const a of apps) { const r = L.ratio(norm(a.n), t); if (r >= bestR) { bestR = r; bestA = a; } }
      if (bestA) best = [bestA];
    }
    if (!best.length) return false;
    best.sort((a, b) => a.n.length - b.n.length);
    await BG.launch({ package: best[0].p });
    say("Открываю " + best[0].n);
    return true;
  }
  const SETTINGS_PAGES = [["вай фай", "wifi"], ["вайфай", "wifi"], ["wi-fi", "wifi"], ["интернет", "wifi"], ["блютуз", "bluetooth"], ["bluetooth", "bluetooth"],
    ["звук", "sound"], ["экран", "display"], ["яркост", "display"], ["батаре", "battery"], ["заряд", "battery"]];

  function bgCommand(cmd) {
    const run = (p, fail) => p.catch(e => { log("Телефон: " + (e && e.message || e), "err"); say(fail || "Не получилось"); });
    let m = cmd.match(/^(?:позвони|набери|звони|вызови)\s+(?:на номер\s+)?(.+)/);
    if (m) {
      const target = m[1].trim(), digits = target.replace(/\D/g, "");
      const spoken = L.wordsNum(target.split(/\s+/))[0];
      if (digits.length >= 3 && digits.length >= target.replace(/\s/g, "").length - 2) {
        const go = () => run(placeCall(digits, digits), "Не получилось позвонить");
        if (S.callConfirm) askConfirm("Позвонить на номер " + digits.split("").join(" "), go); else go();
      } else run(callByName(target), "Не получилось позвонить");
      return true;
    }
    const sms = after(cmd, "напиши смс", "отправь смс", "напиши сообщение", "отправь сообщение", "смс");
    if (sms) { run(smsByName(sms.split(/\s+/).filter(Boolean)), "Не получилось написать"); return true; }
    if (has(cmd, "фонарик", "фонарь")) {
      const off = has(cmd, "выключи", "погаси", "отключи", "убери");
      run(BG.torch({ on: !off }).then(() => say(off ? "Фонарик выключен" : "Фонарик включён")), "Не получилось включить фонарик");
      return true;
    }
    if (has(cmd, "громче", "прибавь звук", "прибавь громкость")) { run(BG.volume({ dir: "up" }).then(() => log("Громче", "sys"))); return true; }
    if (has(cmd, "тише", "убавь звук", "убавь громкость")) { run(BG.volume({ dir: "down" }).then(() => log("Тише", "sys"))); return true; }
    if (has(cmd, "без звука", "выключи звук")) { run(BG.volume({ percent: 0 }).then(() => say("Звук выключен"))); return true; }
    if (has(cmd, "максимальная громкость", "громкость на максимум", "на полную громкость")) { run(BG.volume({ percent: 100 }).then(() => say("Громкость на максимум"))); return true; }
    if (cmd.includes("громкость")) {
      const n = L.wordsNum(cmd.split(/\s+/))[0];
      if (n === null) say("На сколько процентов поставить громкость?");
      else run(BG.volume({ percent: Math.min(100, n) }).then(() => say("Громкость " + Math.min(100, n) + " процентов")));
      return true;
    }
    if (has(cmd, "следующий трек", "следующая песня", "переключи трек", "следующую песню")) { run(BG.media({ action: "next" })); return true; }
    if (has(cmd, "предыдущий трек", "прошлый трек", "предыдущая песня")) { run(BG.media({ action: "prev" })); return true; }
    if (cmd === "пауза" || has(cmd, "поставь на паузу", "останови музыку", "выключи музыку")) { run(BG.media({ action: "pause" })); return true; }
    if (has(cmd, "продолжи музыку", "играй дальше", "продолжи воспроизведение", "включи музыку на телефоне")) { run(BG.media({ action: "play" })); return true; }
    if (cmd.includes("будильник")) {
      const words = cmd.split(/\s+/);
      let i = words.findIndex(w => w === "на" || w === "в");
      const r = i >= 0 ? L.parseClock(words.slice(i + 1)) : null;
      if (!r) say("На какое время поставить будильник? Например: поставь будильник на семь тридцать");
      else run(BG.alarm({ hour: r[0], minute: r[1] }).then(() => say(`Будильник на ${L.clockWords(pad(r[0]) + ":" + pad(r[1]))} поставлен`)), "Не получилось поставить будильник");
      return true;
    }
    if (has(cmd, "открой настройки", "зайди в настройки", "настройки телефона")) {
      const page = (SETTINGS_PAGES.find(([k]) => cmd.includes(k)) || [])[1] || "";
      run(BG.openSettings({ page }).then(() => say("Открываю настройки")));
      return true;
    }
    return false;
  }

  // ---------- встроенные команды ----------
  function builtin(cmd) {
    if (has(cmd, "отключись", "выключи микрофон", "не слушай")) { say("Перехожу в режим ожидания"); stopRec(); S.always = false; saveS(); $("#set-always").checked = false; return true; }
    if (has(cmd, "научись", "запомни команду", "новая команда", "режим обучения")) { mode = "teach_phrase"; say("Режим обучения. Какую фразу мне запомнить? Для отмены скажите отмена."); return true; }
    const forget = after(cmd, "забудь команду", "удали команду");
    if (forget) {
      const left = customs.filter(c => !c.phrase.includes(forget));
      if (left.length !== customs.length) { customs = left; LS.set("customs", customs); renderCustoms(); say("Забыл"); } else say("Такой команды нет");
      return true;
    }
    if (has(cmd, "забудь разговор", "новый разговор", "очисти разговор")) { aiHist = []; say("Начинаем разговор заново"); return true; }

    if (schedCommand(cmd)) return true;
    if (BG && bgCommand(cmd)) return true;
    if (!BG && NATIVE && /^(позвони|набери|звони)\s+(?!на номер)/.test(cmd)) { say("Звонить по имени умеет версия Джарвис Фон"); return true; }
    if (funCommand(cmd)) return true;

    if (has(cmd, "отмени таймер", "сбрось таймер", "останови таймер", "отмени напоминани")) {
      const n = timers.length; timers = []; LS.set("timers", timers); syncNative(); say(n ? "Отменил" : "Активных таймеров нет"); return true;
    }
    if (has(cmd, "сколько осталось", "какие таймеры", "список таймеров")) { timersReport(); return true; }
    if (cmd.includes("таймер")) {
      const [secs] = L.parseDuration(cmd.split(/\s+/));
      if (secs <= 0) { say("На сколько поставить таймер?"); return true; }
      timerStart(secs); say(`Таймер на ${L.fmtDuration(secs)} запущен`); return true;
    }
    if (cmd.includes("напомни")) {
      const words = cmd.split(/\s+/);
      let secs = 0, rest = words;
      const i = words.indexOf("через");
      if (i >= 0) {
        const [s, used] = L.parseDuration(words.slice(i + 1));
        secs = s; rest = words.slice(0, i).concat(words.slice(i + 1 + used));
      }
      rest = rest.slice();
      while (rest.length && ["напомни", "мне", "пожалуйста", "что", "чтобы"].includes(rest[0])) rest.shift();
      if (secs <= 0) { say("Через сколько напомнить?"); return true; }
      timerStart(secs, rest.join(" ")); say(`Напомню через ${L.fmtDuration(secs)}`); return true;
    }

    if (has(cmd, "очисти заметки", "удали все заметки")) { askConfirm("Удалить все заметки", () => { notes = []; LS.set("notes", notes); say("Заметки удалены"); }); return true; }
    if (has(cmd, "прочитай заметки", "мои заметки", "покажи заметки", "что в заметках")) { notesRead(); return true; }
    const note = after(cmd, "запиши заметку", "добавь заметку", "новая заметка", "заметка");
    if (note) { notesAdd(note); return true; }

    if (has(cmd, "какая погода", "погода в", "погода на улице", "что с погодой", "прогноз погоды")) { weather(after(cmd, "погода в ", "погода во ")); return true; }
    if (has(cmd, "заряд батареи", "сколько заряда", "батарея")) { battery(); return true; }
    if (has(cmd, "подбрось монет", "орел или решка", "орёл или решка")) { say(choice(["Орёл", "Решка"])); return true; }
    if (has(cmd, "брось кубик", "кинь кубик", "брось кость")) { say("Выпало " + rnd(1, 6)); return true; }
    if (has(cmd, "который час", "сколько времени", "время")) { const n = new Date(); say(`Сейчас ${pad(n.getHours())}:${pad(n.getMinutes())}`); return true; }
    if (has(cmd, "какое число", "какая дата", "дата")) { say("Сегодня " + L.ruDate(new Date())); return true; }
    if (has(cmd, "вибрация", "завибрируй")) { vibrate([200, 100, 200]); say("Вибрирую"); return true; }
    if (has(cmd, "позвони на номер", "набери номер")) {
      const digits = cmd.replace(/\D/g, "");
      if (digits.length < 3) { say("Назовите номер цифрами"); return true; }
      say("Набираю"); openUrl("tel:" + digits, "позвонить " + digits); return true;
    }

    let q = after(cmd, "найди в интернете", "найди", "поищи", "загугли");
    if (q) { say("Ищу " + q); openUrl("https://www.google.com/search?q=" + encodeURIComponent(q), "поиск: " + q); return true; }
    q = after(cmd, "включи на ютубе", "включи музыку", "включи видео");
    if (q) { say("Включаю"); openUrl("https://www.youtube.com/results?search_query=" + encodeURIComponent(q), "ютуб: " + q); return true; }
    q = after(cmd, "проложи маршрут до", "как доехать до", "маршрут до");
    if (q) { say("Строю маршрут"); openUrl("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q), "маршрут: " + q); return true; }

    if (has(cmd, "открой", "запусти", "включи")) {
      const target = after(cmd, "открой", "запусти", "включи");
      if (BG) {
        launchByName(target).then(ok => { if (!ok && !openByName(target)) say("Не нашёл приложение или сайт " + target); })
          .catch(() => { if (!openByName(target)) say("Не нашёл приложение или сайт " + target); });
        return true;
      }
      if (openByName(target)) return true;
      say("Не нашёл сайт или программу " + target);
      return true;
    }
    return false;
  }

  // ---------- приветствие ----------
  function greeting() {
    const h = new Date().getHours();
    const part = h >= 5 && h < 12 ? "Доброе утро" : h >= 12 && h < 18 ? "Добрый день" : h >= 18 && h < 23 ? "Добрый вечер" : "Доброй ночи";
    const b = schedBrief();
    return withAddr(part) + ". Джарвис к вашим услугам" + (b ? ". " + b : "");
  }

  // ---------- ИИ ----------
  let aiHist = [], aiBusy = false;
  const aiKey = () => S[S.ai_provider.toLowerCase() + "_key"] || "";
  const aiReady = () => S.ai_on && !!aiKey();
  function aiSystem() {
    const now = new Date().toLocaleString("ru-RU");
    const ph = customs.map(c => c.phrase).slice(0, 40).join("; ");
    const sch = schedText();
    return "Ты — Джарвис, голосовой ассистент на телефоне. Отвечай по-русски, коротко: одно-два предложения, без списков, markdown и эмодзи — твой ответ будет произнесён вслух. " +
      "Если пользователь просит что-то сделать (открыть сайт или приложение, найти в интернете, поставить таймер или напоминание, записать заметку, добавить дело в расписание, узнать погоду), " +
      "ответь ОДНОЙ строкой в формате «CMD: команда по-русски», например «CMD: открой ютуб», «CMD: поставь таймер на пять минут», «CMD: добавь в расписание в пять встреча с Колей», «CMD: какая погода». " +
      "Ничего кроме этой строки не пиши. Для обычных вопросов отвечай текстом. Текст пришёл из распознавания речи и может содержать ошибки: угадывай смысл. " +
      `Сейчас ${now}.` + (sch ? " Расписание пользователя: " + sch + "." : "") + (ph ? " Сохранённые команды: " + ph + "." : "");
  }
  async function aiCall(system, msgs) {
    const p = S.ai_provider;
    if (p === "Groq" || p === "Grok") {
      const grok = p === "Grok";
      const key = grok ? S.grok_key : S.groq_key;
      if (!grok && /^xai-/i.test(key)) throw new Error("это ключ Grok (xAI), а выбран Groq — выберите «Grok» в списке");
      const r = await fetch(grok ? "https://api.x.ai/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key },
        body: JSON.stringify({ model: grok ? S.grok_model : S.groq_model, max_tokens: 400, messages: [{ role: "system", content: system }, ...msgs] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(r.status + ": " + ((j.error || {}).message || r.statusText));
      return j.choices[0].message.content || "";
    }
    if (p === "Gemini") {
      const models = [S.gemini_model, "gemini-flash-latest"];
      let last;
      for (const m of models) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
            method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": S.gemini_key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: msgs.map(x => ({ role: x.role === "user" ? "user" : "model", parts: [{ text: x.content }] })),
              generationConfig: { maxOutputTokens: 1024 },
            }),
          });
          const j = await r.json();
          if (!r.ok) { last = new Error(r.status + ": " + ((j.error || {}).message || r.statusText)); if ([404, 429, 500, 503].includes(r.status)) continue; throw last; }
          return ((j.candidates || [])[0].content.parts || []).filter(x => x.text && !x.thought).map(x => x.text).join(" ");
        } catch (e) { last = e; }
      }
      throw last;
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": S.claude_key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: S.claude_model, max_tokens: 400, system, messages: msgs }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(r.status + ": " + ((j.error || {}).message || r.statusText));
    return j.content.map(x => x.text || "").join(" ");
  }
  async function askAI(text) {
    if (aiBusy) { log("Ещё отвечаю на прошлый вопрос", "sys"); return; }
    aiBusy = true; setState(); log("Думаю...", "sys");
    aiHist.push({ role: "user", content: text });
    aiHist = aiHist.slice(-16);
    while (aiHist.length && aiHist[0].role !== "user") aiHist.shift();
    try {
      const reply = (await aiCall(aiSystem(), aiHist)).trim();
      aiHist.push({ role: "assistant", content: reply });
      aiBusy = false; setState();
      const m = reply.match(/CMD:\s*(.+)/i);
      if (m) {
        const ok = execute(m[1].trim().toLowerCase(), { noAI: true });
        if (!ok) say("Не получилось выполнить команду");
      } else if (reply) say(speechClean(reply));
    } catch (e) {
      aiHist.pop(); aiBusy = false; setState();
      log("ИИ: " + e.message, "err"); say("Не удалось связаться с ИИ");
    }
  }

  // ---------- состояние и шар ----------
  const STATE_TEXT = { off: "Микрофон выключен", listening: "Жду «Джарвис»", awaiting: "Слушаю команду...", speaking: "Говорю...", thinking: "Думаю...", tap: "Говорите..." };
  function setState() {
    let s = "off";
    if (speaking) s = "speaking";
    else if (aiBusy) s = "thinking";
    else if (wantRec && recMode === "tap") s = "tap";
    else if (wantRec) s = (mode || Date.now() < awaitingUntil) ? "awaiting" : "listening";
    else if (mode) s = "awaiting";
    state = s;
    $("#status").textContent = STATE_TEXT[s];
    $("#mic").classList.toggle("on", s === "tap" || s === "listening" || s === "awaiting");
    orb.setState(s === "tap" ? "awaiting" : s);
  }

  const ORB = {
    off: { spin: .1, glow: .2, pulse: .01, wave: 0, hue: 0, bright: .3 },
    listening: { spin: 1, glow: .65, pulse: .035, wave: 0, hue: 0, bright: .85 },
    awaiting: { spin: 1.9, glow: .9, pulse: .06, wave: 1.3, hue: 0, bright: 1 },
    speaking: { spin: 2.5, glow: 1, pulse: .045, wave: 2.4, hue: 0, bright: 1 },
    thinking: { spin: 4.2, glow: .8, pulse: .05, wave: .7, hue: 1, bright: .95 },
  };
  const RINGS = [[.88, 3, [[0, 70], [120, 70], [240, 70]], 38, .9], [.76, 2, [[30, 120], [210, 120]], -62, .8],
    [.64, 7, [[0, 30], [90, 30], [180, 30], [270, 30]], 95, 1], [.52, 2, [[0, 300]], -130, .7]];
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, k) => { a = hex(a); b = hex(b); k = Math.max(0, Math.min(1, k)); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join(""); };

  const orb = {
    cv: null, ctx: null, st: "off", p: Object.assign({}, ORB.off), ang: [0, 47, 94, 141], waves: [], nextWave: 0, last: performance.now(), t0: performance.now(),
    init(cv) { this.cv = cv; this.ctx = cv.getContext("2d"); this.resize(); },
    resize() {
      const s = Math.min(window.innerWidth * 0.6, 260), d = Math.min(window.devicePixelRatio || 1, 2);
      this.cv.style.width = this.cv.style.height = s + "px";
      this.cv.width = this.cv.height = Math.round(s * d); this.S = this.cv.width;
    },
    setState(s) { if (ORB[s]) this.st = s; },
    tick(now) {
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      const t = (now - this.t0) / 1000, c = this.ctx, S_ = this.S, cx = S_ / 2, R = S_ / 2 - 6;
      const tg = ORB[this.st], k = Math.min(1, dt * 4);
      for (const key in tg) this.p[key] += (tg[key] - this.p[key]) * k;
      const p = this.p, base = mix(C.accent, C.accent2, p.hue);
      const col = a => mix(C.panel, base, a);
      const breathe = Math.sin(t * (2 + 2.5 * p.glow)) * p.pulse;
      const voice = this.st === "speaking" ? (Math.sin(t * 13) + Math.sin(t * 7.3 + 1.2) + Math.sin(t * 21 + .4)) / 3 * .075 : 0;
      const scale = 1 + breathe + voice;
      c.clearRect(0, 0, S_, S_);
      const rCore = R * .27 * scale, rGlow = R * (.5 + .3 * p.glow) * scale;
      const g = c.createRadialGradient(cx, cx, rCore * .8, cx, cx, rGlow);
      g.addColorStop(0, col(p.glow * .85)); g.addColorStop(1, col(0));
      c.fillStyle = g; c.beginPath(); c.arc(cx, cx, rGlow, 0, 7); c.fill();
      c.lineWidth = Math.max(1, S_ / 280);
      c.strokeStyle = col(.12 + .5 * p.bright);
      for (let i = 0; i < 72; i++) {
        const a = i * Math.PI / 36, long = i % 6 === 0, r1 = R * (long ? .935 : .955);
        c.beginPath(); c.moveTo(cx + r1 * Math.cos(a), cx - r1 * Math.sin(a)); c.lineTo(cx + R * .995 * Math.cos(a), cx - R * .995 * Math.sin(a)); c.stroke();
      }
      RINGS.forEach(([rf, w, segs, speed, al], ri) => {
        this.ang[ri] = (this.ang[ri] + speed * p.spin * dt) % 360;
        c.strokeStyle = col(al * (.25 + .75 * p.bright)); c.lineWidth = w * S_ / 300;
        const r = R * rf * (1 + .012 * Math.sin(t * 1.7 + ri) + .5 * breathe * (ri + 1) / 4);
        segs.forEach(([s0, ext]) => {
          const a0 = -(this.ang[ri] + s0) * Math.PI / 180;
          c.beginPath(); c.arc(cx, cx, r, a0 - ext * Math.PI / 180, a0); c.stroke();
        });
      });
      if (p.wave > .05 && now / 1000 >= this.nextWave) { if (this.waves.length < 3) this.waves.push(0); this.nextWave = now / 1000 + 1 / p.wave; }
      this.waves = this.waves.map(ph => ph + dt * .75).filter(ph => ph < 1);
      this.waves.forEach(ph => {
        const e = 1 - (1 - ph) ** 2, r = rCore + (R * .97 - rCore) * e;
        c.strokeStyle = col((1 - ph) ** 1.6 * .75); c.lineWidth = 2 * S_ / 300; c.beginPath(); c.arc(cx, cx, r, 0, 7); c.stroke();
      });
      c.fillStyle = col(.2 + .8 * p.bright); c.beginPath(); c.arc(cx, cx, rCore, 0, 7); c.fill();
      c.fillStyle = mix(C.bg, "#ffffff", .55 * p.bright + .1); c.globalAlpha = .9; c.beginPath(); c.arc(cx, cx, rCore * .45, 0, 7); c.fill(); c.globalAlpha = 1;
    },
  };
  let orbFailed = false;
  function frame(now) { if (!orbFailed) { try { orb.tick(now); } catch (e) { orbFailed = true; log("Шар не нарисовался: " + e.message, "err"); } } requestAnimationFrame(frame); }

  // ---------- интерфейс ----------
  function renderSched() {
    cleanSched();
    const box = $("#sched-list");
    box.textContent = "";
    if (!schedule.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "Пока пусто. Скажи: «Джарвис, моё расписание: в девять планёрка, в час обед» или добавь дело ниже."; box.appendChild(e); return; }
    const t0 = new Date(); const labels = { 0: "Сегодня", 1: "Завтра", 2: "Послезавтра", "-1": "Вчера" };
    let lastDate = "";
    schedule.forEach(it => {
      if (it.date !== lastDate) {
        lastDate = it.date;
        const h = document.createElement("div"); h.className = "day";
        const dd = Math.round((new Date(it.date + "T00:00:00") - new Date(t0.getFullYear(), t0.getMonth(), t0.getDate())) / 86400000);
        h.textContent = labels[dd] || it.date.slice(8) + "." + it.date.slice(5, 7);
        box.appendChild(h);
      }
      const row = document.createElement("div"); row.className = "item";
      const tm = document.createElement("span"); tm.className = "t"; tm.textContent = it.time;
      const tx = document.createElement("span"); tx.className = "x"; tx.textContent = it.text;
      const del = document.createElement("button"); del.className = "ico"; del.textContent = "✕"; del.setAttribute("aria-label", "Удалить");
      del.onclick = () => { schedule = schedule.filter(i => i.id !== it.id); saveSched(); };
      row.append(tm, tx, del); box.appendChild(row);
    });
  }
  function renderCustoms() {
    const box = $("#cmd-list"); box.textContent = "";
    if (!customs.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "Своих команд пока нет. Скажи «Джарвис, научись» или добавь ниже."; box.appendChild(e); return; }
    const TL = { url: "сайт", say: "ответ", chain: "команды" };
    customs.forEach((c, i) => {
      const row = document.createElement("div"); row.className = "item";
      const tm = document.createElement("span"); tm.className = "t"; tm.textContent = TL[c.type] || c.type;
      const tx = document.createElement("span"); tx.className = "x"; tx.textContent = `${c.phrase} → ${c.value}`;
      const del = document.createElement("button"); del.className = "ico"; del.textContent = "✕"; del.setAttribute("aria-label", "Удалить");
      del.onclick = () => { customs.splice(i, 1); LS.set("customs", customs); renderCustoms(); };
      row.append(tm, tx, del); box.appendChild(row);
    });
  }

  function tabTo(name) {
    $$(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === name));
    $$(".pane").forEach(p => p.hidden = p.id !== "pane-" + name);
  }

  let started = false;
  function firstGesture() {
    audio();
    if (window.Notification && Notification.permission === "default") { try { Notification.requestPermission(); } catch (e) { /* ok */ } }
    if (!started) { started = true; if (S.greet) say(greeting()); }
  }

  function toggleAlways(on) {
    S.always = on; saveS();
    if (on) {
      firstGesture(); startRec("wake");
      try { navigator.wakeLock && navigator.wakeLock.request("screen").catch(() => { }); } catch (e) { /* ok */ }
      log(BG ? "Включаю фоновое прослушивание…" : "Всегда слушаю. Скажи «Джарвис». Экран должен оставаться включённым.", "sys");
    } else stopRec();
  }

  function init() {
    $("#ver").textContent = "v5 · " + (NATIVE ? (BG ? "приложение, фон" : "приложение") : "браузер");
    $("#ver").style.color = "var(--muted)";
    applyTheme(S.theme);
    orb.init($("#orb"));
    window.addEventListener("resize", () => orb.resize());
    requestAnimationFrame(frame);

    const sel = $("#set-theme");
    Object.keys(THEMES).forEach(n => { const o = document.createElement("option"); o.value = o.textContent = n; sel.appendChild(o); });
    sel.value = S.theme;
    sel.onchange = () => { S.theme = sel.value; saveS(); applyTheme(S.theme); };

    // быстрые команды
    [["🕒 Время", "который час"], ["🌤 Погода", "какая погода"], ["📅 Расписание", "что у меня сегодня"], ["➡ Что дальше", "что дальше"],
      ["😄 Шутка", "расскажи шутку"], ["🎲 Факт", "интересный факт"], ["🔮 Предскажи", "предскажи"], ["🔋 Батарея", "заряд батареи"],
      ["🧩 Загадка", "загадай загадку"], ["🎉 Вечеринка", "протокол вечеринка"]].forEach(([l, c]) => {
      const b = document.createElement("button"); b.className = "chip"; b.textContent = l;
      b.onclick = () => { firstGesture(); log("Вы: " + c, "user"); route(c, false); };
      $("#chips").appendChild(b);
    });

    // микрофон: нажал и говори
    $("#mic").onclick = () => {
      firstGesture();
      if (wantRec) { stopRec(); $("#set-always").checked = false; S.always = false; saveS(); return; }
      tapActive = true; startRec("tap");
    };
    $("#send").onclick = () => sendText();
    $("#cmd").addEventListener("keydown", e => { if (e.key === "Enter") sendText(); });
    function sendText() {
      const v = $("#cmd").value.trim(); if (!v) return;
      $("#cmd").value = ""; firstGesture(); log("Вы: " + v, "user"); route(v, false);
    }
    $$(".tab").forEach(t => t.onclick = () => tabTo(t.dataset.tab));

    // расписание: форма
    $("#s-add").onclick = () => {
      const m = $("#s-time").value.match(/^(\d{1,2}):(\d{2})/), text = $("#s-text").value.trim();
      if (!m || !text) { log("Укажи время и описание дела", "err"); return; }
      const d = new Date(); d.setDate(d.getDate() + +$("#s-day").value);
      schedAdd(L.isoDate(d), pad(+m[1]) + ":" + m[2], text); saveSched(); $("#s-text").value = "";
    };
    $("#s-clear").onclick = () => { if ($("#s-clear").dataset.sure) { schedule = []; saveSched(); delete $("#s-clear").dataset.sure; $("#s-clear").textContent = "Очистить всё"; } else { $("#s-clear").dataset.sure = 1; $("#s-clear").textContent = "Точно очистить?"; setTimeout(() => { delete $("#s-clear").dataset.sure; $("#s-clear").textContent = "Очистить всё"; }, 3000); } };

    // свои команды: форма
    $("#c-add").onclick = () => {
      const phrase = $("#c-phrase").value.trim().toLowerCase(), value = $("#c-value").value.trim();
      if (!phrase || !value) { log("Заполни фразу и значение", "err"); return; }
      customs = customs.filter(c => c.phrase !== phrase).concat([{ phrase, type: $("#c-type").value, value, reply: "" }]);
      LS.set("customs", customs); renderCustoms(); $("#c-phrase").value = $("#c-value").value = "";
    };

    // настройки
    const bind = (id, key, kind) => {
      const el = $(id);
      if (kind === "bool") { el.checked = !!S[key]; el.onchange = () => { S[key] = el.checked; saveS(); }; }
      else if (kind === "num") { el.value = S[key]; el.oninput = () => { S[key] = parseFloat(el.value); saveS(); }; }
      else { el.value = S[key]; el.oninput = () => { S[key] = el.value.trim(); saveS(); }; }
    };
    bind("#set-callconfirm", "callConfirm", "bool"); bind("#set-voice", "voice", "bool"); bind("#set-greet", "greet", "bool"); bind("#set-beep", "beep", "bool");
    bind("#set-rate", "rate", "num"); bind("#set-addr", "address"); bind("#set-wake", "wake");
    bind("#ai-on", "ai_on", "bool");
    $("#set-always").checked = S.always; $("#set-always").onchange = e => toggleAlways(e.target.checked);
    const provSel = $("#ai-prov"); provSel.value = S.ai_provider;
    const showAi = () => {
      const p = S.ai_provider.toLowerCase();
      $("#ai-key").value = S[p + "_key"]; $("#ai-model").value = S[p + "_model"];
      $("#ai-hint").textContent = { groq: "Ключ бесплатно: console.groq.com/keys", gemini: "Ключ бесплатно: aistudio.google.com/apikey", claude: "Ключ: console.anthropic.com (запросы платные)", grok: "Ключ Grok (xai-...): console.x.ai. Модель можно поменять, напр. grok-4" }[p];
    };
    provSel.onchange = () => { S.ai_provider = provSel.value; saveS(); showAi(); };
    $("#ai-key").oninput = e => { S[S.ai_provider.toLowerCase() + "_key"] = e.target.value.trim(); saveS(); };
    $("#ai-model").oninput = e => { S[S.ai_provider.toLowerCase() + "_model"] = e.target.value.trim(); saveS(); };
    showAi();
    $("#ai-reset").onclick = () => { aiHist = []; log("Разговор с ИИ сброшен", "sys"); };
    $("#test-voice").onclick = () => { firstGesture(); say("Проверка голоса. Джарвис к вашим услугам"); };

    // установка на экран
    let deferred = null;
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("#install").hidden = false; });
    $("#install").onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; $("#install").hidden = true; } };
    const ios = /iphone|ipad/i.test(navigator.userAgent);
    if (ios && !window.navigator.standalone) $("#ios-hint").hidden = false;

    renderSched(); renderCustoms(); setState(); syncNative();
    const tick = () => { const n = new Date(); $("#clock").textContent = pad(n.getHours()) + ":" + pad(n.getMinutes()) + ":" + pad(n.getSeconds()); $("#date").textContent = L.ruDate(n); };
    tick(); setInterval(tick, 1000);
    setInterval(timerTick, 1000);
    setInterval(scheduleTick, 15000); setTimeout(scheduleTick, 2000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { timerTick(); scheduleTick(); if (S.always && !wantRec) startRec("wake"); } });

    if (!canListen) log("Распознавание речи здесь недоступно: открой в Chrome на Android или Safari на iPhone. Команды можно писать текстом.", "sys");
    log("Готов. Нажми на микрофон и скажи команду, или напиши её внизу. Первое нажатие включает голос.", "sys");
    if ("serviceWorker" in navigator && !NATIVE) navigator.serviceWorker.register("sw.js").catch(() => { });
    if (S.always) log("Режим «Всегда слушать» включится после первого касания экрана", "sys");
    document.body.addEventListener("pointerdown", function once() { document.body.removeEventListener("pointerdown", once); if (S.always && !wantRec) { firstGesture(); startRec("wake"); } }, { once: true });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
