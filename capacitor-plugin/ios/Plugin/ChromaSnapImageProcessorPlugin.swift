import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(ChromaSnapImageProcessorPlugin)
public class ChromaSnapImageProcessorPlugin: CAPPlugin, URLSessionDelegate {
    private let implementation = ChromaSnapImageProcessor()
    private var urlSession: URLSession!
    
    override public func load() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 300 // 5 minutes for long operations
        config.timeoutIntervalForResource = 600 // 10 minutes
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }
    
    @objc func checkSafety(_ call: CAPPluginCall) {
        guard let imageData = call.getString("image") else {
            call.reject("Image data required")
            return
        }
        
        implementation.checkSafety(imageData: imageData) { result, error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else if let result = result {
                call.resolve(result)
            }
        }
    }
    
    @objc func upscaleImage(_ call: CAPPluginCall) {
        guard let imageData = call.getString("image") else {
            call.reject("Image data required")
            return
        }
        guard let apiKey = call.getString("apiKey") else {
            call.reject("API key required")
            return
        }
        
        implementation.upscaleImage(imageData: imageData, apiKey: apiKey) { result, error in
            if let error = error {
                call.resolve(["success": false, "error": error.localizedDescription])
            } else if let result = result {
                call.resolve(["success": true, "result": result])
            }
        }
    }
    
    @objc func enhanceVibrancy(_ call: CAPPluginCall) {
        guard let imageData = call.getString("image") else {
            call.reject("Image data required")
            return
        }
        guard let apiKey = call.getString("apiKey") else {
            call.reject("API key required")
            return
        }
        
        implementation.enhanceVibrancy(imageData: imageData, apiKey: apiKey) { result, error in
            if let error = error {
                call.resolve(["success": false, "error": error.localizedDescription])
            } else if let result = result {
                call.resolve(["success": true, "result": result])
            }
        }
    }
    
    @objc func sharpenImage(_ call: CAPPluginCall) {
        guard let imageData = call.getString("image") else {
            call.reject("Image data required")
            return
        }
        guard let apiKey = call.getString("apiKey") else {
            call.reject("API key required")
            return
        }
        
        implementation.sharpenImage(imageData: imageData, apiKey: apiKey) { result, error in
            if let error = error {
                call.resolve(["success": false, "error": error.localizedDescription])
            } else if let result = result {
                call.resolve(["success": true, "result": result])
            }
        }
    }
    
    @objc func animateImage(_ call: CAPPluginCall) {
        guard let imageData = call.getString("image") else {
            call.reject("Image data required")
            return
        }
        guard let apiKey = call.getString("apiKey") else {
            call.reject("API key required")
            return
        }
        
        implementation.animateImage(imageData: imageData, apiKey: apiKey) { result, error in
            if let error = error {
                call.resolve(["success": false, "error": error.localizedDescription])
            } else if let result = result {
                call.resolve(["success": true, "result": result])
            }
        }
    }
}
