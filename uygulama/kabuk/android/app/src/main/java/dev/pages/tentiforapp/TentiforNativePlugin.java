package dev.pages.tentiforapp;

import android.app.Activity;
import android.content.Context;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "TentiforNative")
public class TentiforNativePlugin extends Plugin {
    private boolean screenLockDisabled = false;

    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject result = new JSObject();
        BiometricManager manager = BiometricManager.from(getContext());
        int biometric = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.BIOMETRIC_WEAK
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        result.put("biometric", biometric == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("screenWakeLock", true);
        result.put("widget", true);
        result.put("shareIntent", true);
        result.put("fileIntent", true);
        result.put("nfc", getContext().getPackageManager().hasSystemFeature("android.hardware.nfc"));
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Uygulama etkinliği hazır değil.");
            return;
        }
        String title = call.getString("title", "Gizli Tentifor içeriği");
        String subtitle = call.getString("subtitle", "Devam etmek için cihaz kilidini doğrula.");
        Executor executor = ContextCompat.getMainExecutor(activity);
        BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                            call.reject("Doğrulama iptal edildi.");
                        } else {
                            call.reject(String.valueOf(errString));
                        }
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        // Android kendi yeniden deneme arayüzünü gösterir.
                    }
                });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.BIOMETRIC_WEAK
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build();
        prompt.authenticate(info);
    }

    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Uygulama etkinliği hazır değil.");
            return;
        }
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (Boolean.TRUE.equals(enabled)) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                screenLockDisabled = true;
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                screenLockDisabled = false;
            }
            JSObject result = new JSObject();
            result.put("enabled", screenLockDisabled);
            call.resolve(result);
        });
    }
}
