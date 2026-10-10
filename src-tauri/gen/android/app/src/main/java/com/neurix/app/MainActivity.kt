package com.neurix.app

import android.webkit.WebView

class MainActivity : TauriActivity() {
  // Expose a tiny bridge to the web layer so it can keep the process alive
  // while a model downloads (see DownloadService). Everything else goes
  // through Tauri's own IPC.
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(DownloadBridge(applicationContext), "NeurixAndroid")
  }
}
