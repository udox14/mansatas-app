package com.mansatas.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.view.View;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String APP_URL = "https://app.mansatas.com/";
    private String lastGoodUrl = APP_URL;
    private boolean hasPageError = false;
    private ConnectivityManager.NetworkCallback networkCallback;

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

        setupWebViewRecovery();
        setupNetworkCallback();
    }

    private void setupWebViewRecovery() {
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                // Halaman mulai dimuat
            }

            @Override
            public void onPageLoaded(WebView webView) {
                String currentUrl = webView.getUrl();
                if (currentUrl != null && currentUrl.startsWith(APP_URL)) {
                    hasPageError = false;
                    lastGoodUrl = currentUrl;
                }
            }

            @Override
            public void onReceivedError(WebView webView) {
                hasPageError = true;
            }

            @Override
            public void onReceivedHttpError(WebView webView) {
                hasPageError = true;
            }

            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                hasPageError = true;
                // Jika proses render dimatikan Android saat di background untuk menghemat RAM,
                // muat ulang URL terakhir agar aplikasi tidak force close / crash.
                webView.post(() -> {
                    String target = (lastGoodUrl != null && lastGoodUrl.startsWith(APP_URL)) ? lastGoodUrl : APP_URL;
                    webView.loadUrl(target);
                });
                return true;
            }
        });
    }

    private void setupNetworkCallback() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;

            NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    runOnUiThread(() -> recoverWebViewIfFailed());
                }
            };

            cm.registerNetworkCallback(request, networkCallback);
        } catch (Exception ignored) {
            // Graceful fallback jika registrasi callback dibatasi perangkat
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        recoverWebViewIfFailed();
    }

    private void recoverWebViewIfFailed() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        String currentUrl = webView.getUrl();
        boolean isErrorState = hasPageError
            || currentUrl == null
            || currentUrl.contains("offline.html")
            || !currentUrl.startsWith(APP_URL);

        if (isErrorState && isNetworkAvailable()) {
            hasPageError = false;
            String target = (lastGoodUrl != null && lastGoodUrl.startsWith(APP_URL)) ? lastGoodUrl : APP_URL;
            webView.post(() -> webView.loadUrl(target));
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network activeNetwork = cm.getActiveNetwork();
            if (activeNetwork == null) return false;
            NetworkCapabilities capabilities = cm.getNetworkCapabilities(activeNetwork);
            return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception e) {
            return true;
        }
    }

    @Override
    public void onDestroy() {
        if (networkCallback != null) {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    cm.unregisterNetworkCallback(networkCallback);
                }
            } catch (Exception ignored) {}
        }
        super.onDestroy();
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
