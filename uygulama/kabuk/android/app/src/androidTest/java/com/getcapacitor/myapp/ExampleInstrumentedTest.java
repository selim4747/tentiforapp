package com.getcapacitor.myapp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {
    @Test
    public void packageAndNativeResourcesArePresent() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("dev.pages.tentiforapp", appContext.getPackageName());
        assertNotNull(appContext.getResources().getXml(
                appContext.getResources().getIdentifier(
                        "tentifor_widget_info", "xml", appContext.getPackageName())));
        assertNotNull(appContext.getResources().getLayout(
                appContext.getResources().getIdentifier(
                        "tentifor_widget", "layout", appContext.getPackageName())));
    }

    @Test
    public void launchIntentStartsMainActivity() throws Exception {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        PackageManager packageManager = appContext.getPackageManager();
        Intent launchIntent = packageManager.getLaunchIntentForPackage(appContext.getPackageName());
        assertNotNull("APK launch intent bulunamadı", launchIntent);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

        Activity activity = InstrumentationRegistry.getInstrumentation().startActivitySync(launchIntent);
        assertNotNull(activity);
        assertEquals("dev.pages.tentiforapp.MainActivity", activity.getClass().getName());
        assertFalse(activity.isFinishing());
        assertEquals("APK sürümü 6.3.13 olmalı", "6.3.13", packageManager.getPackageInfo(appContext.getPackageName(), 0).versionName);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) appContext.getSystemService(Context.NOTIFICATION_SERVICE);
            assertNotNull(manager);
            assertNotNull("FCM bildirim kanalı oluşturulmadı", manager.getNotificationChannel("tentiforapp"));
        }
        InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish);
    }
}
