# Add project specific ProGuard rules here.

# Keep line numbers for readable crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor core
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod *;
}

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# WebView JS bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor Camera plugin
-keep class com.capacitorjs.plugins.camera.** { *; }

# Suppress warnings for optional Facebook SDK (referenced by Firebase Auth plugin but not used)
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.login.LoginManager
-dontwarn com.facebook.login.widget.LoginButton
-dontwarn kotlin.coroutines.jvm.internal.SpillingKt
