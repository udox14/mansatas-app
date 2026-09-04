package com.mansatas.app;

import static org.junit.Assert.assertEquals;

import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class SafeContentInsetsTest {
    @Test
    public void fitsBarsCutoutAndKeyboardWithoutAccumulatingPadding() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View content = (View) activity.getBridge().getWebView().getParent();
                // Three-button navigation, then gesture navigation.
                check(content, Insets.of(0, 24, 0, 48), Insets.NONE, Insets.NONE,
                    Insets.of(0, 24, 0, 48));
                check(content, Insets.of(0, 24, 0, 16), Insets.NONE, Insets.NONE,
                    Insets.of(0, 24, 0, 16));
                // Keyboard replaces (does not add to) navigation-bar padding.
                check(content, Insets.of(0, 24, 0, 48), Insets.NONE, Insets.of(0, 0, 0, 300),
                    Insets.of(0, 24, 0, 300));
                // Rotation and keyboard dismissal must clear the previous padding.
                check(content, Insets.of(0, 24, 48, 0), Insets.of(40, 0, 0, 0), Insets.NONE,
                    Insets.of(40, 24, 48, 0));
                check(content, Insets.NONE, Insets.NONE, Insets.NONE, Insets.NONE);
                ViewCompat.requestApplyInsets(content);
            });
        }
    }

    private static void check(View content, Insets bars, Insets cutout, Insets keyboard, Insets expected) {
        int types = WindowInsetsCompat.Type.systemBars()
            | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime();
        WindowInsetsCompat input = new WindowInsetsCompat.Builder()
            .setInsets(WindowInsetsCompat.Type.systemBars(), bars)
            .setInsets(WindowInsetsCompat.Type.displayCutout(), cutout)
            .setInsets(WindowInsetsCompat.Type.ime(), keyboard)
            .build();
        WindowInsetsCompat remaining = ViewCompat.dispatchApplyWindowInsets(content, input);
        assertEquals(expected.left, content.getPaddingLeft());
        assertEquals(expected.top, content.getPaddingTop());
        assertEquals(expected.right, content.getPaddingRight());
        assertEquals(expected.bottom, content.getPaddingBottom());
        assertEquals(Insets.NONE, remaining.getInsets(types));
    }
}
