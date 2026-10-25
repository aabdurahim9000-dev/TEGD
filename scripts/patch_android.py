"""Права, иконка для Android-проекта, который создаёт `npx cap add android`."""
import glob, os, re, shutil

man = "android/app/src/main/AndroidManifest.xml"
s = open(man, encoding="utf-8").read()
BG = os.environ.get("BG") == "1"          # вариант с фоновым прослушиванием
perms = ["INTERNET", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "VIBRATE", "POST_NOTIFICATIONS",
         "SCHEDULE_EXACT_ALARM", "USE_EXACT_ALARM", "RECEIVE_BOOT_COMPLETED", "WAKE_LOCK"]
if BG:
    perms += ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MICROPHONE", "CALL_PHONE", "READ_CONTACTS"]
add = "".join(f'    <uses-permission android:name="android.permission.{p}" />\n'
              for p in perms if f'android.permission.{p}"' not in s)
if BG and "com.android.alarm.permission.SET_ALARM" not in s:
    add += '    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />\n'
s = s.replace("<application", add + "    <application", 1)
if "<queries>" not in s:
    q = ('    <queries>\n'
         '        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>\n'
         '        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="tg" /></intent>\n'
         '        <intent><action android:name="android.speech.RecognitionService" /></intent>\n'
         '        <intent><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent>\n'
         '    </queries>\n')
    s = s.replace("</manifest>", q + "</manifest>")
if BG:
    mains = glob.glob("android/app/src/main/java/**/MainActivity.java", recursive=True)
    if not mains:
        raise SystemExit("MainActivity.java не найден")
    jdir = os.path.dirname(mains[0])
    pkg = re.search(r"^package\s+([\w.]+);", open(mains[0], encoding="utf-8").read(), re.M).group(1)
    for name in ("MainActivity", "JarvisBgPlugin", "ListenService"):
        t = open(f"scripts/bg/{name}.java.tpl", encoding="utf-8").read().replace("__PKG__", pkg)
        open(os.path.join(jdir, name + ".java"), "w", encoding="utf-8").write(t)
    svc = f'        <service android:name="{pkg}.ListenService" android:exported="false" android:foregroundServiceType="microphone" />\n'
    s = s.replace("</application>", svc + "    </application>", 1)
    print("background service installed into", pkg)
open(man, "w", encoding="utf-8").write(s)
print("manifest patched")

try:
    from PIL import Image
    src = Image.open("www/icon-512.png").convert("RGBA")
    shutil.rmtree("android/app/src/main/res/mipmap-anydpi-v26", ignore_errors=True)
    for d in glob.glob("android/app/src/main/res/mipmap-*"):
        for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
            f = os.path.join(d, name)
            if os.path.exists(f):
                w = Image.open(f).size[0]
                src.resize((w, w), Image.LANCZOS).save(f)
    print("icons replaced")
except Exception as e:                      # иконка не критична
    print("icons skipped:", e)
