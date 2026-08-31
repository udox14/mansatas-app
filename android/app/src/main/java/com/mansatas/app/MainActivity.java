package com.mansatas.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);
        // Apply edge-to-edge consistently on Android versions prior to Android
        // 15 as well; Android 15+ enforces this for apps targeting recent SDKs.
        WindowCompat.enableEdgeToEdge(getWindow());
    }
}
