package dev.pages.tentiforapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class TentiforWidgetProvider extends AppWidgetProvider {
    public static void update(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.tentifor_widget);
        Intent launch = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra("tentifor_route", "#/oyunlar");
        PendingIntent pending = PendingIntent.getActivity(
                context,
                widgetId,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        views.setTextViewText(R.id.widget_title, "TentiFor");
        views.setTextViewText(R.id.widget_body, "Günün kelimesi hazır mı? Dokun ve oyna.");
        manager.updateAppWidget(widgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override
    public void onEnabled(Context context) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, TentiforWidgetProvider.class);
        for (int id : manager.getAppWidgetIds(component)) update(context, manager, id);
    }
}
