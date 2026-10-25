package __PKG__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;

/** Служба переднего плана: постоянно слушает микрофон и отдаёт распознанный текст в приложение. */
public class ListenService extends Service {
    public interface Callback {
        void onText(String text);
        void onStopped();
    }

    public static volatile Callback callback;
    public static volatile boolean running = false;
    static final String ACTION_STOP = "__PKG__.STOP";
    private static final String CHANNEL = "jarvis_listen";
    private static ListenService instance;

    private final Handler h = new Handler(Looper.getMainLooper());
    private SpeechRecognizer sr;
    private boolean paused = false;
    private boolean alive = false;
    private boolean listening = false;
    private String lastPartial = "";

    private final Runnable startTask = new Runnable() {
        @Override
        public void run() {
            beginListen();
        }
    };

    public static void setPaused(final boolean p) {
        final ListenService s = instance;
        if (s == null) return;
        s.h.post(new Runnable() {
            @Override
            public void run() {
                s.paused = p;
                if (p) {
                    s.stopRec();
                } else {
                    s.schedule(300);
                }
            }
        });
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            Callback c = callback;
            if (c != null) c.onStopped();
            shutdown();
            return START_NOT_STICKY;
        }
        instance = this;
        startInForeground();
        if (!alive) {
            alive = true;
            running = true;
            schedule(200);
        }
        return START_NOT_STICKY;
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Джарвис слушает", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(ch);
        }
        int fl = Build.VERSION.SDK_INT >= 23
                ? (PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)
                : PendingIntent.FLAG_UPDATE_CURRENT;
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent po = PendingIntent.getActivity(this, 0, open, fl);
        Intent stop = new Intent(this, ListenService.class);
        stop.setAction(ACTION_STOP);
        PendingIntent ps = PendingIntent.getService(this, 1, stop, fl);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setContentTitle("Джарвис слушает")
                .setContentText("Скажи «Джарвис…»")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(po)
                .addAction(0, "Выключить", ps)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(77, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(77, n);
        }
    }

    private void schedule(long ms) {
        h.removeCallbacks(startTask);
        h.postDelayed(startTask, ms);
    }

    private void beginListen() {
        if (!alive || paused || listening) return;
        try {
            if (sr == null) {
                if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                    schedule(5000);
                    return;
                }
                sr = SpeechRecognizer.createSpeechRecognizer(this);
                sr.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) { }
                    @Override public void onBeginningOfSpeech() { }
                    @Override public void onRmsChanged(float rmsdB) { }
                    @Override public void onBufferReceived(byte[] buffer) { }
                    @Override public void onEndOfSpeech() { }
                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> pm = partialResults == null ? null
                                : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (pm != null && !pm.isEmpty() && pm.get(0) != null) lastPartial = pm.get(0);
                    }
                    @Override public void onEvent(int eventType, Bundle params) { }

                    @Override
                    public void onResults(Bundle results) {
                        listening = false;
                        ArrayList<String> m = results == null ? null
                                : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (m != null && !m.isEmpty() && m.get(0) != null) ? m.get(0) : "";
                        // иногда итог короче промежуточного результата: берём более полный
                        if (lastPartial.length() > text.length() && lastPartial.startsWith(text)) text = lastPartial;
                        lastPartial = "";
                        if (!text.isEmpty()) {
                            Callback c = callback;
                            if (c != null) c.onText(text);
                        }
                        schedule(250);
                    }

                    @Override
                    public void onError(int error) {
                        listening = false;
                        if (!lastPartial.isEmpty()
                                && (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
                            String t = lastPartial;
                            lastPartial = "";
                            Callback c = callback;
                            if (c != null) c.onText(t);
                            schedule(250);
                        } else if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                            lastPartial = "";
                            schedule(300);
                        } else if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                            Callback c = callback;
                            if (c != null) c.onStopped();
                            shutdown();
                        } else {
                            destroyRec();
                            schedule(1500);
                        }
                    }
                });
            }
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_WEB_SEARCH);
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2200);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1800);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2500);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
            i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
            lastPartial = "";
            listening = true;
            sr.startListening(i);
        } catch (Exception e) {
            listening = false;
            destroyRec();
            schedule(2000);
        }
    }

    private void stopRec() {
        listening = false;
        if (sr != null) {
            try {
                sr.cancel();
            } catch (Exception ignored) {
            }
        }
    }

    private void destroyRec() {
        listening = false;
        if (sr != null) {
            try {
                sr.destroy();
            } catch (Exception ignored) {
            }
            sr = null;
        }
    }

    private void shutdown() {
        alive = false;
        running = false;
        h.removeCallbacksAndMessages(null);
        destroyRec();
        instance = null;
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        alive = false;
        running = false;
        h.removeCallbacksAndMessages(null);
        destroyRec();
        instance = null;
        super.onDestroy();
    }
}
