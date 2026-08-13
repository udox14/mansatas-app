package com.mansatas.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
