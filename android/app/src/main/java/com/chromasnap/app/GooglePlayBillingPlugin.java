package com.chromasnap.app;

import android.app.Activity;
import android.util.Log;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "GooglePlayBillingPlugin";
    private BillingClient billingClient;
    private String pendingPurchaseCallId;

    private interface BillingReadyCallback {
        void onReady();
        void onError(String message);
    }

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Plugin loaded");
        initializeBillingClient();
    }

    private void initializeBillingClient() {
        if (billingClient != null) {
            return;
        }

        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .build();

        Log.i(TAG, "BillingClient initialized");
        startBillingConnection(new BillingReadyCallback() {
            @Override
            public void onReady() {
                Log.i(TAG, "Billing connection ready during initialization");
                // Connected. Calls that need billing readiness will still re-check.
            }

            @Override
            public void onError(String message) {
                Log.w(TAG, "Billing connection failed during initialization: " + message);
                // Ignore here; availability/purchase calls handle and surface errors.
            }
        });
    }

    private void startBillingConnection(BillingReadyCallback callback) {
        if (billingClient == null) {
            Log.e(TAG, "Billing client unavailable when starting connection");
            callback.onError("Billing client unavailable");
            return;
        }

        if (billingClient.isReady()) {
            Log.i(TAG, "Billing client already ready");
            callback.onReady();
            return;
        }

        Log.i(TAG, "Starting billing service connection");
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected");
                // Will reconnect on next request.
            }

            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.i(TAG, "Billing setup finished: OK");
                    callback.onReady();
                } else {
                    int responseCode = billingResult.getResponseCode();
                    String debugMessage = billingResult.getDebugMessage();
                    Log.e(TAG, "Billing setup failed: " + responseCode + " " + debugMessage);
                    callback.onError("Google Play Billing unavailable (code " + responseCode + "): " + debugMessage);
                }
            }
        });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        initializeBillingClient();
        Log.i(TAG, "isAvailable called");

        startBillingConnection(new BillingReadyCallback() {
            @Override
            public void onReady() {
                Log.i(TAG, "isAvailable resolved: available=true");
                JSObject result = new JSObject();
                result.put("available", true);
                result.put("platform", "android");
                call.resolve(result);
            }

            @Override
            public void onError(String message) {
                Log.w(TAG, "isAvailable resolved: available=false, message=" + message);
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("platform", "android");
                result.put("message", message);
                call.resolve(result);
            }
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        initializeBillingClient();

        String productId = call.getString("productId", "").trim();
        String productType = call.getString("productType", "").trim();
        Log.i(TAG, "purchase called productId=" + productId + " productType=" + productType);

        if (productId.isEmpty()) {
            call.reject("productId is required");
            return;
        }

        if (!"subs".equals(productType) && !"inapp".equals(productType)) {
            call.reject("productType must be subs or inapp");
            return;
        }

        if (billingClient == null) {
            Log.e(TAG, "purchase rejected: billing client unavailable");
            call.reject("Billing client unavailable");
            return;
        }

        startBillingConnection(new BillingReadyCallback() {
            @Override
            public void onReady() {
                Log.i(TAG, "Billing connection ready for purchase: " + productId);
                executePurchaseFlow(call, productId, productType);
            }

            @Override
            public void onError(String message) {
                Log.e(TAG, "Billing connection error before purchase: " + message);
                call.reject(message);
            }
        });
    }

    private void executePurchaseFlow(PluginCall call, String productId, String productType) {
        String billingProductType = "subs".equals(productType)
            ? BillingClient.ProductType.SUBS
            : BillingClient.ProductType.INAPP;

        QueryProductDetailsParams.Product product =
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(billingProductType)
                .build();

        QueryProductDetailsParams params =
            QueryProductDetailsParams.newBuilder()
                .setProductList(List.of(product))
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
            Log.i(TAG, "queryProductDetailsAsync result code=" + billingResult.getResponseCode() + " msg=" + billingResult.getDebugMessage());
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Failed to query product details: " + billingResult.getDebugMessage());
                return;
            }

            List<ProductDetails> productDetailsList = productDetailsResult == null
                ? null
                : productDetailsResult.getProductDetailsList();

            if (productDetailsList == null || productDetailsList.isEmpty()) {
                call.reject("No product details found for productId: " + productId);
                return;
            }

            ProductDetails productDetails = productDetailsList.get(0);
            BillingFlowParams.ProductDetailsParams.Builder productDetailsParamsBuilder =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(productDetails);

            if (BillingClient.ProductType.SUBS.equals(billingProductType)) {
                List<ProductDetails.SubscriptionOfferDetails> offers = productDetails.getSubscriptionOfferDetails();
                if (offers == null || offers.isEmpty()) {
                    call.reject("No subscription offers available for productId: " + productId);
                    return;
                }
                productDetailsParamsBuilder.setOfferToken(offers.get(0).getOfferToken());
            }

            List<BillingFlowParams.ProductDetailsParams> detailsParamsList = new ArrayList<>();
            detailsParamsList.add(productDetailsParamsBuilder.build());

            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(detailsParamsList)
                .build();

            Activity activity = getActivity();
            if (activity == null) {
                Log.e(TAG, "purchase rejected: activity unavailable");
                call.reject("Activity unavailable for launching billing flow");
                return;
            }

            pendingPurchaseCallId = call.getCallbackId();
            bridge.saveCall(call);

            activity.runOnUiThread(() -> {
                Log.i(TAG, "Launching billing flow for productId=" + productId);
                BillingResult launchResult = billingClient.launchBillingFlow(activity, flowParams);
                Log.i(TAG, "launchBillingFlow result code=" + launchResult.getResponseCode() + " msg=" + launchResult.getDebugMessage());
                if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectPendingCall("Failed to launch billing flow: " + launchResult.getDebugMessage());
                }
            });
        });
    }

    @Override
    public void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
            billingClient = null;
        }
        super.handleOnDestroy();
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        Log.i(TAG, "onPurchasesUpdated code=" + billingResult.getResponseCode() + " msg=" + billingResult.getDebugMessage());
        if (pendingPurchaseCallId == null) {
            Log.w(TAG, "onPurchasesUpdated received with no pending call");
            return;
        }

        int responseCode = billingResult.getResponseCode();
        if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            rejectPendingCall("Purchase canceled");
            return;
        }

        if (responseCode != BillingClient.BillingResponseCode.OK) {
            rejectPendingCall("Purchase failed: " + billingResult.getDebugMessage());
            return;
        }

        if (purchases == null || purchases.isEmpty()) {
            rejectPendingCall("Purchase failed: empty purchase list");
            return;
        }

        Purchase purchase = purchases.get(0);
        Log.i(TAG, "Purchase success token=" + purchase.getPurchaseToken() + " orderId=" + purchase.getOrderId());
        List<String> products = purchase.getProducts();

        JSObject result = new JSObject();
        result.put("purchaseToken", purchase.getPurchaseToken());
        result.put("orderId", purchase.getOrderId());
        result.put("purchaseState", purchase.getPurchaseState());
        result.put("productId", products != null && !products.isEmpty() ? products.get(0) : "");

        resolvePendingCall(result);
    }

    private void resolvePendingCall(JSObject result) {
        if (pendingPurchaseCallId == null) return;

        PluginCall pendingCall = bridge.getSavedCall(pendingPurchaseCallId);
        if (pendingCall != null) {
            Log.i(TAG, "Resolving pending purchase call");
            pendingCall.resolve(result);
            bridge.releaseCall(pendingPurchaseCallId);
        }

        pendingPurchaseCallId = null;
    }

    private void rejectPendingCall(String message) {
        if (pendingPurchaseCallId == null) return;

        PluginCall pendingCall = bridge.getSavedCall(pendingPurchaseCallId);
        if (pendingCall != null) {
            Log.e(TAG, "Rejecting pending purchase call: " + message);
            pendingCall.reject(message);
            bridge.releaseCall(pendingPurchaseCallId);
        }

        pendingPurchaseCallId = null;
    }
}
