package com.mansatas.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {
    private WebView printWebView;

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        String jobName = call.getString("jobName", "Dokumen MANSATAS");

        if (html == null || html.trim().isEmpty()) {
            call.reject("Dokumen yang akan dicetak kosong.");
            return;
        }
        if (getActivity() == null) {
            call.reject("Layar Android belum siap.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = new WebView(getActivity());
                printWebView = webView;
                webView.getSettings().setJavaScriptEnabled(false);
                webView.getSettings().setLoadWithOverviewMode(true);
                webView.getSettings().setUseWideViewPort(true);
                webView.setWebViewClient(new WebViewClient() {
                    private boolean printed = false;

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (printed) return;
                        printed = true;

                        PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                        if (manager == null) {
                            call.reject("Layanan cetak Android tidak tersedia.");
                            return;
                        }

                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                        manager.print(jobName, adapter, new PrintAttributes.Builder().build());
                        JSObject result = new JSObject();
                        result.put("started", true);
                        call.resolve(result);
                    }
                });
                webView.loadDataWithBaseURL(
                    "https://app.mansatas.com/",
                    html,
                    "text/html",
                    "UTF-8",
                    null
                );
            } catch (Exception error) {
                call.reject("Gagal membuka dialog cetak: " + error.getMessage(), error);
            }
        });
    }
}
