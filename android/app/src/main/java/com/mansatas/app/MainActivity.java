package com.mansatas.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);
        // Izinkan Android/Google Password Manager mengenali dan mengisi form login WebView.
        // Password tetap dikelola oleh penyedia Autofill perangkat, bukan disimpan aplikasi.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getBridge().getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        }
        // Apply edge-to-edge consistently on Android versions prior to Android
        // 15 as well; Android 15+ enforces this for apps targeting recent SDKs.
        WindowCompat.enableEdgeToEdge(getWindow());
        applySafeContentInsets();
    }

    private void applySafeContentInsets() {
        // Fit the entire WebView, including fixed headers, bottom navigation and
        // web dialogs. Do not depend on the installed WebView's CSS safe-area support.
        // SystemBars.insetsHandling is disabled so Capacitor cannot overwrite this.
        View content = (View) getBridge().getWebView().getParent();
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            int handledTypes = WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout()
                | WindowInsetsCompat.Type.ime();
            Insets safe = windowInsets.getInsets(handledTypes);
            // Insets are a union (max), not a sum: the keyboard includes the
            // navigation area. Absolute padding also avoids accumulation on rotation.
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);

            // Dispatch explicit zero insets instead of CONSUMED, allowing WebView
            // to clear stale CSS safe areas when the keyboard/rotation changes.
            return new WindowInsetsCompat.Builder(windowInsets)
                .setInsets(handledTypes, Insets.NONE)
                .build();
        });
        ViewCompat.requestApplyInsets(content);
    }
}
