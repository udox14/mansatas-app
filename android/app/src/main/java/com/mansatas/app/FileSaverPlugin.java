package com.mansatas.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void saveAndOpen(PluginCall call) {
        String data = call.getString("data");
        String requestedName = call.getString("filename", "dokumen.pdf");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (data == null || data.isEmpty()) {
            call.reject("Data file kosong.");
            return;
        }

        String filename = sanitizeFilename(requestedName);

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            boolean publicDownloads;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + File.separator + "MANSATAS"
                );
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Tidak dapat membuat file Downloads.");

                try (OutputStream output = resolver.openOutputStream(uri)) {
                    if (output == null) throw new IllegalStateException("Tidak dapat membuka file tujuan.");
                    output.write(bytes);
                } catch (Exception error) {
                    resolver.delete(uri, null, null);
                    throw error;
                }

                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                publicDownloads = true;
            } else {
                File directory = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "MANSATAS");
                if (!directory.exists() && !directory.mkdirs()) {
                    throw new IllegalStateException("Tidak dapat membuat direktori dokumen.");
                }
                File file = uniqueFile(directory, filename);
                try (OutputStream output = new FileOutputStream(file)) {
                    output.write(bytes);
                }
                uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
                publicDownloads = false;
            }

            openFile(uri, mimeType, filename);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("filename", filename);
            result.put("publicDownloads", publicDownloads);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Gagal menyimpan file: " + error.getMessage(), error);
        }
    }

    private void openFile(Uri uri, String mimeType, String filename) {
        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
        viewIntent.setDataAndType(uri, mimeType);
        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType(mimeType);
        shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
        shareIntent.putExtra(Intent.EXTRA_TITLE, filename);
        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Intent chooser = Intent.createChooser(viewIntent, "Buka " + filename);
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { shareIntent });
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(chooser);
    }

    private static String sanitizeFilename(String raw) {
        String name = raw == null ? "dokumen.pdf" : raw.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        name = name.replaceAll("^\\.+", "");
        if (name.isEmpty()) name = "dokumen.pdf";
        return name.length() > 120 ? name.substring(name.length() - 120) : name;
    }

    private static File uniqueFile(File directory, String filename) {
        File candidate = new File(directory, filename);
        if (!candidate.exists()) return candidate;

        int dot = filename.lastIndexOf('.');
        String base = dot > 0 ? filename.substring(0, dot) : filename;
        String extension = dot > 0 ? filename.substring(dot) : "";
        for (int i = 2; i < 1000; i++) {
            candidate = new File(directory, base + " (" + i + ")" + extension);
            if (!candidate.exists()) return candidate;
        }
        return new File(directory, System.currentTimeMillis() + "_" + filename);
    }
}
