package com.chromasnap.app;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		// Opt in explicitly for Android 15 edge-to-edge behavior and back-compat handling.
		EdgeToEdge.enable(this);
		registerPlugin(GooglePlayBillingPlugin.class);
		super.onCreate(savedInstanceState);

		// Hardware back walks the web app's history (feature -> dashboard) before leaving the app.
		getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
			@Override
			public void handleOnBackPressed() {
				WebView webView = getBridge() != null ? getBridge().getWebView() : null;
				if (webView != null && webView.canGoBack()) {
					webView.goBack();
				} else {
					moveTaskToBack(true);
				}
			}
		});
	}
}
