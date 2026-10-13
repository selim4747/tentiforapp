package dev.pages.tentiforapp;

import android.content.Intent;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(TentiforNativePlugin.class);
        createNotificationChannel();
        super.onCreate(state);
        handleRouteIntent(getIntent());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                "tentiforapp",
                "TentiFor bildirimleri",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("TentiFor kişisel bildirimleri");
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRouteIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView != null) webView.postDelayed(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('capacitorResume'));", null), 120);
    }

    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            super.onBackPressed();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
                "(function(){window.__tf62BackHandled=false;window.dispatchEvent(new Event('tentifor-back-button'));return window.__tf62BackHandled?'1':'0';})()",
                value -> {
                    if (!"\"1\"".equals(value)) MainActivity.super.onBackPressed();
                });
    }

    private void handleRouteIntent(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra("tentifor_route");
        boolean shared = Intent.ACTION_SEND.equals(intent.getAction())
                || (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null);
        if ((route == null || route.isEmpty()) && shared) route = "#/fan";
        if (route == null || route.isEmpty()) return;
        String title = intent.getStringExtra(Intent.EXTRA_TITLE);
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String mime = intent.getType();
        String uri = intent.getDataString();
        final String targetRoute = route;
        final String sharedTitle = title == null ? "" : title;
        final String sharedText = text == null ? "" : text;
        final String sharedMime = mime == null ? "" : mime;
        final String sharedUri = uri == null ? "" : uri;
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;
        String detail = "{route:" + org.json.JSONObject.quote(targetRoute)
                + ",title:" + org.json.JSONObject.quote(sharedTitle)
                + ",text:" + org.json.JSONObject.quote(sharedText)
                + ",mime:" + org.json.JSONObject.quote(sharedMime)
                + ",uri:" + org.json.JSONObject.quote(sharedUri) + "}";
        String script = "(function(d){if(window.__tfQueueNativeRoute)window.__tfQueueNativeRoute(d);else{window.__tfPendingNativeRoutes=window.__tfPendingNativeRoutes||[];window.__tfPendingNativeRoutes.push(d);}})(" + detail + ");";
        webView.postDelayed(() -> webView.evaluateJavascript(script, null), 350);
    }
}
