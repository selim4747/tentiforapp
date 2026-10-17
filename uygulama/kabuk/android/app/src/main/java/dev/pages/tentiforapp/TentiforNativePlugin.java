package dev.pages.tentiforapp;

import android.app.Activity;
import android.content.Context;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

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
        Activity baseActivity = getActivity();
        if (!(baseActivity instanceof FragmentActivity)) {
            call.reject("Bu Android etkinliği biyometriyi desteklemiyor.");
            return;
        }
        FragmentActivity activity = (FragmentActivity) baseActivity;
        activity.runOnUiThread(() -> {
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
        });
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
    private File durableStateFile() {
        return new File(getContext().getFilesDir(), "tentiforapp-state.json");
    }

    private static final String DURABLE_STATE_KEY_ALIAS = "tentiforapp-durable-state-v1";
    private static final String DURABLE_STATE_PREFIX = "TFSTATE1:";

    private SecretKey durableStateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(DURABLE_STATE_KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(DURABLE_STATE_KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(DURABLE_STATE_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private byte[] encryptDurableState(String value) throws Exception {
        byte[] plaintext = value.getBytes(StandardCharsets.UTF_8);
        if (plaintext.length > 8_000_000) throw new IllegalArgumentException("Uygulama durumu çok büyük.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, durableStateKey());
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(plaintext);
        byte[] payload = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, payload, 0, iv.length);
        System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
        return (DURABLE_STATE_PREFIX + Base64.encodeToString(payload, Base64.NO_WRAP)).getBytes(StandardCharsets.UTF_8);
    }

    private String decryptDurableState(byte[] stored) throws Exception {
        String value = new String(stored, StandardCharsets.UTF_8);
        if (!value.startsWith(DURABLE_STATE_PREFIX)) return value; // Eski düz metin durumunu sonraki yazımda yükselt.
        byte[] payload = Base64.decode(value.substring(DURABLE_STATE_PREFIX.length()), Base64.NO_WRAP);
        if (payload.length <= 12) throw new IllegalArgumentException("Kalıcı uygulama verisi bozuk.");
        byte[] iv = new byte[12];
        byte[] encrypted = new byte[payload.length - iv.length];
        System.arraycopy(payload, 0, iv, 0, iv.length);
        System.arraycopy(payload, iv.length, encrypted, 0, encrypted.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, durableStateKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void saveAppState(PluginCall call) {
        String value = call.getString("value", "");
        if (value == null || value.length() > 8_000_000) {
            call.reject("Uygulama durumu çok büyük.");
            return;
        }
        File target = durableStateFile();
        File temp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temp)) {
            output.write(encryptDurableState(value));
            output.getFD().sync();
            if (!temp.renameTo(target)) {
                try (FileOutputStream fallback = new FileOutputStream(target)) {
                    fallback.write(value.getBytes(StandardCharsets.UTF_8));
                    fallback.getFD().sync();
                }
                temp.delete();
            }
            call.resolve();
        } catch (Exception error) {
            temp.delete();
            call.reject("Uygulama durumu kaydedilemedi.", error);
        }
    }

    @PluginMethod
    public void loadAppState(PluginCall call) {
        File target = durableStateFile();
        if (!target.exists()) {
            JSObject result = new JSObject();
            result.put("value", "");
            call.resolve(result);
            return;
        }
        try (FileInputStream input = new FileInputStream(target)) {
            byte[] bytes = new byte[(int) Math.min(target.length(), 12_000_000)];
            int length = 0;
            int read;
            while (length < bytes.length && (read = input.read(bytes, length, bytes.length - length)) != -1) {
                length += read;
            }
            JSObject result = new JSObject();
            result.put("value", length > 0 ? decryptDurableState(bytes) : "");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Uygulama durumu okunamadı.", error);
        }
    }

    @PluginMethod
    public void saveBridge(PluginCall call) {
        String value = call.getString("value", "");
        if (value == null || value.length() > 64000) {
            call.reject("Offline köprü verisi çok büyük.");
            return;
        }
        getContext().getSharedPreferences("tentifor_native", Context.MODE_PRIVATE)
                .edit().putString("bridge", value).apply();
        call.resolve();
    }

    @PluginMethod
    public void loadBridge(PluginCall call) {
        String value = getContext().getSharedPreferences("tentifor_native", Context.MODE_PRIVATE)
                .getString("bridge", "");
        getContext().getSharedPreferences("tentifor_native", Context.MODE_PRIVATE)
                .edit().remove("bridge").apply();
        JSObject result = new JSObject();
        result.put("value", value == null ? "" : value);
        call.resolve(result);
    }

}
