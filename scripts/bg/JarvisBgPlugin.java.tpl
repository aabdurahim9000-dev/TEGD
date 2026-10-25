package __PKG__;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.KeyEvent;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/** Мост между страницей приложения и службой фонового прослушивания, плюс нативная озвучка. */
@CapacitorPlugin(
        name = "JarvisBg",
        permissions = {
                @Permission(alias = "contacts", strings = {Manifest.permission.READ_CONTACTS}),
                @Permission(alias = "calls", strings = {Manifest.permission.CALL_PHONE})
        }
)
public class JarvisBgPlugin extends Plugin {
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private final ConcurrentHashMap<String, PluginCall> speaking = new ConcurrentHashMap<>();
    private int uid = 0;

    @Override
    public void load() {
        tts = new TextToSpeech(getContext().getApplicationContext(), new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status != TextToSpeech.SUCCESS || tts == null) return;
                tts.setLanguage(new Locale("ru", "RU"));
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) { }
                    @Override public void onDone(String utteranceId) { finish(utteranceId); }
                    @Override public void onError(String utteranceId) { finish(utteranceId); }
                });
                ttsReady = true;
            }
        });
    }

    private void finish(String id) {
        PluginCall c = speaking.remove(id);
        if (c != null) c.resolve();
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        Float rate = call.getFloat("rate", 1.0f);
        if (!ttsReady || tts == null || text == null || text.isEmpty()) {
            call.reject("tts unavailable");
            return;
        }
        String id = "u" + (uid++);
        speaking.put(id, call);
        tts.setSpeechRate(rate == null ? 1.0f : rate);
        int r = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
        if (r != TextToSpeech.SUCCESS) {
            speaking.remove(id);
            call.reject("tts error");
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("no microphone permission");
            return;
        }
        ListenService.callback = new ListenService.Callback() {
            @Override
            public void onText(String text) {
                wakeWebView();
                JSObject o = new JSObject();
                o.put("text", text);
                notifyListeners("heard", o);
            }

            @Override
            public void onStopped() {
                notifyListeners("stopped", new JSObject());
            }
        };
        try {
            Intent i = new Intent(getContext(), ListenService.class);
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            call.reject("cannot start service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        ListenService.callback = null;
        if (ListenService.running) {
            Intent i = new Intent(getContext(), ListenService.class);
            i.setAction(ListenService.ACTION_STOP);
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        ListenService.setPaused(true);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        ListenService.setPaused(false);
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject o = new JSObject();
        o.put("running", ListenService.running);
        call.resolve(o);
    }

    @PluginMethod
    public void batterySettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("unavailable");
        }
    }

    // ---------- телефон: звонки, контакты, приложения, фонарик, громкость ----------

    @PluginMethod
    public void ensurePhone(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED
                && getPermissionState("calls") == PermissionState.GRANTED) {
            JSObject o = new JSObject();
            o.put("contacts", true);
            o.put("calls", true);
            call.resolve(o);
            return;
        }
        requestPermissionForAliases(new String[]{"contacts", "calls"}, call, "phonePerms");
    }

    @PermissionCallback
    private void phonePerms(PluginCall call) {
        JSObject o = new JSObject();
        o.put("contacts", getPermissionState("contacts") == PermissionState.GRANTED);
        o.put("calls", getPermissionState("calls") == PermissionState.GRANTED);
        call.resolve(o);
    }

    @PluginMethod
    public void contacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            call.reject("no contacts permission");
            return;
        }
        JSArray arr = new JSArray();
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                            ContactsContract.CommonDataKinds.Phone.NUMBER},
                    null, null, null);
            int n = 0;
            while (c != null && c.moveToNext() && n < 3000) {
                JSObject o = new JSObject();
                o.put("n", c.getString(0));
                o.put("p", c.getString(1));
                arr.put(o);
                n++;
            }
        } catch (Exception e) {
            call.reject("contacts error: " + e.getMessage());
            return;
        } finally {
            if (c != null) c.close();
        }
        JSObject res = new JSObject();
        res.put("list", arr);
        call.resolve(res);
    }

    @PluginMethod
    public void dial(PluginCall call) {
        String num = call.getString("number", "");
        if (num == null || num.isEmpty()) {
            call.reject("no number");
            return;
        }
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED;
        try {
            Intent i = new Intent(granted ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(num)));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject o = new JSObject();
            o.put("direct", granted);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("dial failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sms(PluginCall call) {
        String num = call.getString("number", "");
        String text = call.getString("text", "");
        try {
            Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(num)));
            i.putExtra("sms_body", text);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("sms failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void apps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent q = new Intent(Intent.ACTION_MAIN);
            q.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> list = pm.queryIntentActivities(q, 0);
            JSArray arr = new JSArray();
            for (ResolveInfo ri : list) {
                JSObject o = new JSObject();
                o.put("n", String.valueOf(ri.loadLabel(pm)));
                o.put("p", ri.activityInfo.packageName);
                arr.put(o);
            }
            JSObject res = new JSObject();
            res.put("list", arr);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("apps failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void launch(PluginCall call) {
        String pkg = call.getString("package", "");
        try {
            Intent li = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
            if (li == null) {
                call.reject("no launch intent");
                return;
            }
            li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(li);
            call.resolve();
        } catch (Exception e) {
            call.reject("launch failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void torch(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        try {
            CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            String[] ids = cm.getCameraIdList();
            if (ids.length == 0) {
                call.reject("no camera");
                return;
            }
            cm.setTorchMode(ids[0], on);
            call.resolve();
        } catch (Exception e) {
            call.reject("torch failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void volume(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            String dir = call.getString("dir", "");
            if ("up".equals(dir)) {
                am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI);
            } else if ("down".equals(dir)) {
                am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
            } else {
                Integer pct = call.getInt("percent");
                if (pct == null) {
                    call.reject("no percent");
                    return;
                }
                int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                int v = Math.max(0, Math.min(max, Math.round(max * pct.intValue() / 100f)));
                am.setStreamVolume(AudioManager.STREAM_MUSIC, v, AudioManager.FLAG_SHOW_UI);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("volume failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void media(PluginCall call) {
        String a = call.getString("action", "");
        int code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
        if ("next".equals(a)) code = KeyEvent.KEYCODE_MEDIA_NEXT;
        else if ("prev".equals(a)) code = KeyEvent.KEYCODE_MEDIA_PREVIOUS;
        else if ("play".equals(a)) code = KeyEvent.KEYCODE_MEDIA_PLAY;
        else if ("pause".equals(a)) code = KeyEvent.KEYCODE_MEDIA_PAUSE;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
            am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
            call.resolve();
        } catch (Exception e) {
            call.reject("media failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void alarm(PluginCall call) {
        Integer h = call.getInt("hour");
        Integer m = call.getInt("minute");
        if (h == null || m == null) {
            call.reject("no time");
            return;
        }
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_ALARM);
            i.putExtra(AlarmClock.EXTRA_HOUR, h.intValue());
            i.putExtra(AlarmClock.EXTRA_MINUTES, m.intValue());
            i.putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("message", "Джарвис"));
            i.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("alarm failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String page = call.getString("page", "");
        String action = Settings.ACTION_SETTINGS;
        if ("wifi".equals(page)) action = Settings.ACTION_WIFI_SETTINGS;
        else if ("bluetooth".equals(page)) action = Settings.ACTION_BLUETOOTH_SETTINGS;
        else if ("sound".equals(page)) action = Settings.ACTION_SOUND_SETTINGS;
        else if ("display".equals(page)) action = Settings.ACTION_DISPLAY_SETTINGS;
        else if ("battery".equals(page)) action = Settings.ACTION_BATTERY_SAVER_SETTINGS;
        try {
            Intent i = new Intent(action);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("settings failed: " + e.getMessage());
        }
    }

    private void wakeWebView() {
        final Activity a = getActivity();
        if (a == null) return;
        a.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView w = getBridge().getWebView();
                    w.resumeTimers();
                    w.onResume();
                } catch (Exception ignored) {
                }
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
    }
}
