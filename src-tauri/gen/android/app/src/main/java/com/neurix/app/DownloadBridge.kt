package com.neurix.app

import android.content.Context
import android.webkit.JavascriptInterface

/**
 * Called from the web layer as `window.NeurixAndroid`.
 *
 * The download itself runs in Rust. This only asks Android to keep the app's
 * process running while it does, so a multi-gigabyte download is not cut off
 * the moment the user switches to another app or the screen turns off.
 */
class DownloadBridge(private val context: Context) {
  @JavascriptInterface
  fun startDownloadService(title: String) {
    try {
      DownloadService.start(context, title)
    } catch (e: Exception) {
      // Starting a foreground service can be refused (for example if the app
      // is already in the background). The download still runs while the app
      // is open, which is the behaviour before this service existed.
      Logger.warn("Could not start the download service: $e")
    }
  }

  @JavascriptInterface
  fun stopDownloadService() {
    try {
      DownloadService.stop(context)
    } catch (e: Exception) {
      Logger.warn("Could not stop the download service: $e")
    }
  }
}
