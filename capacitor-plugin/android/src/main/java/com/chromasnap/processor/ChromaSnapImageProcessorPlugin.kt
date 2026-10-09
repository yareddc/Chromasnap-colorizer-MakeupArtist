package com.chromasnap.processor

import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

@CapacitorPlugin(name = "ChromaSnapImageProcessor")
class ChromaSnapImageProcessorPlugin : Plugin() {
    private val implementation = ChromaSnapImageProcessor()
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    @PluginMethod
    fun checkSafety(call: PluginCall) {
        val imageData = call.getString("image")
        if (imageData == null) {
            call.reject("Image data required")
            return
        }
        
        scope.launch {
            try {
                val result = implementation.checkSafety(imageData)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject(e.message ?: "Safety check failed")
            }
        }
    }

    @PluginMethod
    fun upscaleImage(call: PluginCall) {
        val imageData = call.getString("image")
        val apiKey = call.getString("apiKey")
        
        if (imageData == null) {
            call.reject("Image data required")
            return
        }
        if (apiKey == null) {
            call.reject("API key required")
            return
        }
        
        scope.launch {
            try {
                val result = implementation.upscaleImage(imageData, apiKey)
                val response = JSObject()
                response.put("success", true)
                response.put("result", result)
                call.resolve(response)
            } catch (e: Exception) {
                val response = JSObject()
                response.put("success", false)
                response.put("error", e.message ?: "Upscaling failed")
                call.resolve(response)
            }
        }
    }

    @PluginMethod
    fun enhanceVibrancy(call: PluginCall) {
        val imageData = call.getString("image")
        val apiKey = call.getString("apiKey")
        
        if (imageData == null) {
            call.reject("Image data required")
            return
        }
        if (apiKey == null) {
            call.reject("API key required")
            return
        }
        
        scope.launch {
            try {
                val result = implementation.enhanceVibrancy(imageData, apiKey)
                val response = JSObject()
                response.put("success", true)
                response.put("result", result)
                call.resolve(response)
            } catch (e: Exception) {
                val response = JSObject()
                response.put("success", false)
                response.put("error", e.message ?: "Enhancement failed")
                call.resolve(response)
            }
        }
    }

    @PluginMethod
    fun sharpenImage(call: PluginCall) {
        val imageData = call.getString("image")
        val apiKey = call.getString("apiKey")
        
        if (imageData == null) {
            call.reject("Image data required")
            return
        }
        if (apiKey == null) {
            call.reject("API key required")
            return
        }
        
        scope.launch {
            try {
                val result = implementation.sharpenImage(imageData, apiKey)
                val response = JSObject()
                response.put("success", true)
                response.put("result", result)
                call.resolve(response)
            } catch (e: Exception) {
                val response = JSObject()
                response.put("success", false)
                response.put("error", e.message ?: "Sharpening failed")
                call.resolve(response)
            }
        }
    }

    @PluginMethod
    fun animateImage(call: PluginCall) {
        val imageData = call.getString("image")
        val apiKey = call.getString("apiKey")
        
        if (imageData == null) {
            call.reject("Image data required")
            return
        }
        if (apiKey == null) {
            call.reject("API key required")
            return
        }
        
        scope.launch {
            try {
                val result = implementation.animateImage(imageData, apiKey)
                val response = JSObject()
                response.put("success", true)
                response.put("result", result)
                call.resolve(response)
            } catch (e: Exception) {
                val response = JSObject()
                response.put("success", false)
                response.put("error", e.message ?: "Animation failed")
                call.resolve(response)
            }
        }
    }
}
