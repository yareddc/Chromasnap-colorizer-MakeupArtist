import Foundation

class ChromaSnapImageProcessor {
    private let apiUrl = "https://generativelanguage.googleapis.com/v1beta/models"
    
    // MARK: - Analysis Methods
    
    func checkSafety(imageData: String, completion: @escaping ([String: Any]?, Error?) -> Void) {
        let base64Data = extractBase64(imageData)
        let mimeType = extractMimeType(imageData)
        
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["inlineData": ["data": base64Data, "mimeType": mimeType]],
                        ["text": "Critically analyze this image for safety. Does it contain nudity, sexually explicit content, or minors (children/teenagers)? Respond strictly in JSON format."]
                    ]
                ]
            ],
            "generationConfig": [
                "responseMimeType": "application/json",
                "responseSchema": [
                    "type": "OBJECT",
                    "properties": [
                        "isSafe": ["type": "BOOLEAN"],
                        "containsMinors": ["type": "BOOLEAN"],
                        "reason": ["type": "STRING"]
                    ],
                    "required": ["isSafe", "containsMinors", "reason"]
                ]
            ]
        ]
        
        makeGeminiRequest("gemini-2.0-flash:generateContent", body: requestBody, completion: completion)
    }
    
    // MARK: - Image Processing Methods
    
    func upscaleImage(imageData: String, apiKey: String, completion: @escaping (String?, Error?) -> Void) {
        let base64Data = extractBase64(imageData)
        let mimeType = extractMimeType(imageData)
        
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["inlineData": ["data": base64Data, "mimeType": mimeType]],
                        ["text": "Upscale this image to a higher resolution. Enhance the clarity, sharpness, and details while keeping the original composition and colors identical. Only output the image."]
                    ]
                ]
            ]
        ]
        
        makeGeminiImageRequest("gemini-2.0-flash:generateContent", body: requestBody, apiKey: apiKey, completion: completion)
    }
    
    func enhanceVibrancy(imageData: String, apiKey: String, completion: @escaping (String?, Error?) -> Void) {
        let base64Data = extractBase64(imageData)
        let mimeType = extractMimeType(imageData)
        
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["inlineData": ["data": base64Data, "mimeType": mimeType]],
                        ["text": "Increase the color vibrancy and saturation of this image to make it look more vivid and lively. Maintain natural-looking skin tones and realistic lighting. Only output the image."]
                    ]
                ]
            ]
        ]
        
        makeGeminiImageRequest("gemini-2.0-flash:generateContent", body: requestBody, apiKey: apiKey, completion: completion)
    }
    
    func sharpenImage(imageData: String, apiKey: String, completion: @escaping (String?, Error?) -> Void) {
        let base64Data = extractBase64(imageData)
        let mimeType = extractMimeType(imageData)
        
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["inlineData": ["data": base64Data, "mimeType": mimeType]],
                        ["text": "Sharpen this image. Enhance the fine details, edges, and textures to make it look crisp and clear without introducing significant noise. Maintain the original colors and lighting. Only output the image."]
                    ]
                ]
            ]
        ]
        
        makeGeminiImageRequest("gemini-2.0-flash:generateContent", body: requestBody, apiKey: apiKey, completion: completion)
    }
    
    func animateImage(imageData: String, apiKey: String, completion: @escaping (String?, Error?) -> Void) {
        // Video generation requires Veo API - would need separate implementation
        // For now, return placeholder
        let error = NSError(domain: "ChromaSnap", code: 1, userInfo: [NSLocalizedDescriptionKey: "Video generation not yet implemented on native iOS"])
        completion(nil, error)
    }
    
    // MARK: - Helper Methods
    
    private func extractBase64(_ dataUrl: String) -> String {
        let components = dataUrl.split(separator: ",", maxSplits: 1)
        return String(components.count > 1 ? components[1] : dataUrl)
    }
    
    private func extractMimeType(_ dataUrl: String) -> String {
        let components = dataUrl.split(separator: ",", maxSplits: 1)
        if let first = components.first {
            let mimeComponent = first.split(separator: ";", maxSplits: 1)
            if let mime = mimeComponent.first?.split(separator: ":", maxSplits: 1).last {
                return String(mime)
            }
        }
        return "image/png"
    }
    
    private func makeGeminiRequest(_ endpoint: String, body: [String: Any], completion: @escaping ([String: Any]?, Error?) -> Void) {
        // This would be called by plugin with API key
        // For simplicity, using environment or stored API key
        guard let apiKey = ProcessInfo.processInfo.environment["GEMINI_API_KEY"] else {
            let error = NSError(domain: "ChromaSnap", code: 1, userInfo: [NSLocalizedDescriptionKey: "API key not configured"])
            completion(nil, error)
            return
        }
        
        let urlString = "\(apiUrl)/\(endpoint)?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            let error = NSError(domain: "ChromaSnap", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
            completion(nil, error)
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(nil, error)
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(nil, error)
                return
            }
            
            guard let data = data else {
                let error = NSError(domain: "ChromaSnap", code: 3, userInfo: [NSLocalizedDescriptionKey: "No response data"])
                completion(nil, error)
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    completion(json, nil)
                }
            } catch {
                completion(nil, error)
            }
        }.resume()
    }
    
    private func makeGeminiImageRequest(_ endpoint: String, body: [String: Any], apiKey: String, completion: @escaping (String?, Error?) -> Void) {
        let urlString = "\(apiUrl)/\(endpoint)?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            let error = NSError(domain: "ChromaSnap", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
            completion(nil, error)
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(nil, error)
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(nil, error)
                return
            }
            
            guard let data = data else {
                let error = NSError(domain: "ChromaSnap", code: 3, userInfo: [NSLocalizedDescriptionKey: "No response data"])
                completion(nil, error)
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let candidate = (json["candidates"] as? [[String: Any]])?.first,
                   let content = candidate["content"] as? [String: Any],
                   let parts = content["parts"] as? [[String: Any]],
                   let firstPart = parts.first,
                   let inlineData = firstPart["inlineData"] as? [String: Any],
                   let base64Data = inlineData["data"] as? String {
                    let resultImage = "data:image/png;base64,\(base64Data)"
                    completion(resultImage, nil)
                } else {
                    let error = NSError(domain: "ChromaSnap", code: 4, userInfo: [NSLocalizedDescriptionKey: "Invalid response format"])
                    completion(nil, error)
                }
            } catch {
                completion(nil, error)
            }
        }.resume()
    }
}
