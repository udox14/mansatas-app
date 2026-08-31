package com.mansatas.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
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
    }
}
