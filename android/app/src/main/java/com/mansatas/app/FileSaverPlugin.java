package com.mansatas.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

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
            boolean isImage = mimeType != null && mimeType.toLowerCase().startsWith("image/");
            String publicFolder = isImage
                ? Environment.DIRECTORY_PICTURES + File.separator + "MANSATAS"
                : Environment.DIRECTORY_DOWNLOADS + File.separator + "MANSATAS";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    publicFolder
                );
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri collection = isImage
                    ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                uri = resolver.insert(collection, values);
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
                String legacyDirectory = isImage ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS;
                File directory = new File(getContext().getExternalFilesDir(legacyDirectory), "MANSATAS");
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

            String destination = isImage ? "Galeri/Pictures/MANSATAS" : "Download/MANSATAS";
            getActivity().runOnUiThread(() -> showFileActions(uri, mimeType, filename, destination));

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("filename", filename);
            result.put("publicDownloads", publicDownloads);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Gagal menyimpan file: " + error.getMessage(), error);
        }
    }

    private void showFileActions(Uri uri, String mimeType, String filename, String destination) {
        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
        viewIntent.setDataAndType(uri, mimeType);
        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType(mimeType);
        shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
        shareIntent.putExtra(Intent.EXTRA_TITLE, filename);
        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        new android.app.AlertDialog.Builder(getActivity())
            .setTitle("File tersimpan")
            .setMessage(filename + "\n\nLokasi: " + destination)
            .setPositiveButton("Buka", (dialog, which) -> {
                try {
                    getActivity().startActivity(viewIntent);
                } catch (Exception error) {
                    Toast.makeText(getContext(), "Tidak ada aplikasi untuk membuka file ini.", Toast.LENGTH_LONG).show();
                }
            })
            .setNeutralButton("Bagikan", (dialog, which) -> {
                Intent chooser = Intent.createChooser(shareIntent, "Bagikan " + filename);
                getActivity().startActivity(chooser);
            })
            .setNegativeButton("Selesai", null)
            .show();
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
