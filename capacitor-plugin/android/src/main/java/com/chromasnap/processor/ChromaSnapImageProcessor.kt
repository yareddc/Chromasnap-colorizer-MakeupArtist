package com.chromasnap.processor

import android.util.Log
import com.getcapacitor.JSObject
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ChromaSnapImageProcessor {
    private val apiUrl = "https://generativelanguage.googleapis.com/v1beta/models"
    private val TAG = "ChromaSnap"
    
    suspend fun analyzeMonochromatic(imageData: String): JSObject {
        val base64Data = extractBase64(imageData)
        val mimeType = extractMimeType(imageData)
        
        val requestBody = JSONObject().apply {
            put("contents", JSONObject.wrap(listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("inlineData" to mapOf("data" to base64Data, "mimeType" to mimeType)),
                        mapOf("text" to "Is this image black and white (monochromatic)? Respond strictly with \"true\" or \"false\" in JSON format.")
                    )
                )
            )))
            put("generationConfig", mapOf(
                "responseMimeType" to "application/json",
                "responseSchema" to mapOf(
                    "type" to "OBJECT",
                    "properties" to mapOf(
                        "isMonochromatic" to mapOf("type" to "BOOLEAN")
                    ),
                    "required" to listOf("isMonochromatic")
                )
            ))
        }
        
        return makeGeminiRequest("gemini-2.0-flash:generateContent", requestBody)
    }
    
    suspend fun checkSafety(imageData: String): JSObject {
        val base64Data = extractBase64(imageData)
        val mimeType = extractMimeType(imageData)
        
        val requestBody = JSONObject().apply {
            put("contents", JSONObject.wrap(listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("inlineData" to mapOf("data" to base64Data, "mimeType" to mimeType)),
                        mapOf("text" to "Critically analyze this image for safety. Does it contain nudity, sexually explicit content, or minors (children/teenagers)? Respond strictly in JSON format.")
                    )
                )
            )))
            put("generationConfig", mapOf(
                "responseMimeType" to "application/json",
                "responseSchema" to mapOf(
                    "type" to "OBJECT",
                    "properties" to mapOf(
                        "isSafe" to mapOf("type" to "BOOLEAN"),
                        "containsMinors" to mapOf("type" to "BOOLEAN"),
                        "reason" to mapOf("type" to "STRING")
                    ),
                    "required" to listOf("isSafe", "containsMinors", "reason")
                )
            ))
        }
        
        return makeGeminiRequest("gemini-2.0-flash:generateContent", requestBody)
    }
    
    suspend fun colorizeImage(imageData: String, theme: String, apiKey: String): String {
        val base64Data = extractBase64(imageData)
        val mimeType = extractMimeType(imageData)
        
        val themePrompts = mapOf(
            "Natural" to "realistic skin tones, natural landscapes, and accurate fabric colors.",
            "Cinematic" to "a moody, cinematic film look with high contrast and teal-and-orange hints.",
            "Vivid" to "bright, highly saturated, and punchy modern colors.",
            "Vintage" to "warm, slightly desaturated, nostalgic 70s film tones.",
            "Technicolor" to "highly vibrant, stylized mid-century 3-strip technicolor look."
        )
        
        val instruction = themePrompts[theme] ?: themePrompts["Natural"]!!
        
        val requestBody = JSONObject().apply {
            put("contents", JSONObject.wrap(listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("inlineData" to mapOf("data" to base64Data, "mimeType" to mimeType)),
                        mapOf("text" to "You are a professional photo restorer. Colorize this black and white photo with high precision using a $theme palette. Ensure $instruction Output ONLY the resulting colorized image. No conversational text.")
                    )
                )
            )))
        }
        
        val result = makeGeminiImageRequest("gemini-2.0-flash:generateContent", requestBody, apiKey)
        return result
    }
    
    suspend fun upscaleImage(imageData: String, apiKey: String): String {
        val base64Data = extractBase64(imageData)
        val mimeType = extractMimeType(imageData)
        
        val requestBody = JSONObject().apply {
            put("contents", JSONObject.wrap(listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("inlineData" to mapOf("data" to base64Data, "mimeType" to mimeType)),
                        mapOf("text" to "Upscale this image to a higher resolution. Enhance the clarity, sharpness, and details while keeping the original composition and colors identical. Only output the image.")
                    )
                )
            )))
        }
        
        return makeGeminiImageRequest("gemini-2.0-flash:generateContent", requestBody, apiKey)
    }
    
    suspend fun enhanceVibrancy(imageData: String, apiKey: String): String {
        val base64Data = extractBase64(imageData)
        val mimeType = extractMimeType(imageData)
        
        val requestBody = JSONObject().apply {
            put("contents", JSONObject.wrap(listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("inlineData" to mapOf("data" to base64Data, "mimeType" to mimeType)),
                        mapOf("text" to "Increase the color vibrancy and saturation of this image to make it look more vivid and lively. Maintain natural-looking skin tones and realistic lighting. Only output the image.")
                    )
                )
            )))
        }
        
        return makeGeminiImageRequest("gemini-2.0-flash:generateContent", requestBody, apiKey)
    }
    
    suspend fun sharpenImage(imageData: String, apiKey: String): String {
        val base64Data = extractBase64(imageData)
        val mimeType = extractMimeType(imageData)
        
        val requestBody = JSONObject().apply {
            put("contents", JSONObject.wrap(listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("inlineData" to mapOf("data" to base64Data, "mimeType" to mimeType)),
                        mapOf("text" to "Sharpen this image. Enhance the fine details, edges, and textures to make it look crisp and clear without introducing significant noise. Maintain the original colors and lighting. Only output the image.")
                    )
                )
            )))
        }
        
        return makeGeminiImageRequest("gemini-2.0-flash:generateContent", requestBody, apiKey)
    }
    
    suspend fun animateImage(imageData: String, apiKey: String): String {
        throw Exception("Video generation not yet implemented on native Android")
    }
    
    // MARK: - Helper Methods
    
    private fun extractBase64(dataUrl: String): String {
        val parts = dataUrl.split(",", limit = 2)
        return if (parts.size > 1) parts[1] else dataUrl
    }
    
    private fun extractMimeType(dataUrl: String): String {
        return try {
            val parts = dataUrl.split(",", limit = 2)
            val mimeComponent = parts[0].split(";")[0]
            mimeComponent.split(":").last()
        } catch (e: Exception) {
            "image/png"
        }
    }
    
    private suspend fun makeGeminiRequest(endpoint: String, body: JSONObject): JSObject {
        val apiKey = System.getenv("GEMINI_API_KEY") ?: throw Exception("API key not configured")
        val urlString = "$apiUrl/$endpoint?key=$apiKey"
        
        return try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.connectTimeout = 300000 // 5 minutes
            connection.readTimeout = 600000 // 10 minutes
            
            // Send request
            connection.outputStream.write(body.toString().toByteArray())
            connection.outputStream.flush()
            
            // Read response
            val responseCode = connection.responseCode
            val inputStream = if (responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream
            } else {
                connection.errorStream
            }
            
            val response = BufferedReader(InputStreamReader(inputStream)).use { it.readText() }
            val result = JSObject(response)
            connection.disconnect()
            result
        } catch (e: Exception) {
            Log.e(TAG, "Gemini request failed", e)
            throw e
        }
    }
    
    private suspend fun makeGeminiImageRequest(endpoint: String, body: JSONObject, apiKey: String): String {
        val urlString = "$apiUrl/$endpoint?key=$apiKey"
        
        return try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.connectTimeout = 300000 // 5 minutes
            connection.readTimeout = 600000 // 10 minutes
            
            // Send request
            connection.outputStream.write(body.toString().toByteArray())
            connection.outputStream.flush()
            
            // Read response
            val inputStream = connection.inputStream
            val response = BufferedReader(InputStreamReader(inputStream)).use { it.readText() }
            val json = JSONObject(response)
            
            connection.disconnect()
            
            // Extract image from response
            val candidates = json.optJSONArray("candidates")
            if (candidates != null && candidates.length() > 0) {
                val candidate = candidates.getJSONObject(0)
                val content = candidate.optJSONObject("content")
                if (content != null) {
                    val parts = content.optJSONArray("parts")
                    if (parts != null && parts.length() > 0) {
                        val part = parts.getJSONObject(0)
                        val inlineData = part.optJSONObject("inlineData")
                        if (inlineData != null) {
                            val base64Data = inlineData.optString("data")
                            return "data:image/png;base64,$base64Data"
                        }
                    }
                }
            }
            
            throw Exception("Invalid response format from API")
        } catch (e: Exception) {
            Log.e(TAG, "Gemini image request failed", e)
            throw e
        }
    }
}
