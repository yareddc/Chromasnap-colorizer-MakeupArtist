package com.chromasnap.app;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		// Opt in explicitly for Android 15 edge-to-edge behavior and back-compat handling.
		EdgeToEdge.enable(this);
		registerPlugin(GooglePlayBillingPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
