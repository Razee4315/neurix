package com.neurix.app

import android.app.Activity
import android.graphics.Color
import android.webkit.JavascriptInterface
import androidx.core.view.WindowCompat

/**
 * Called from the web layer as `window.NeurixBars` whenever the theme
 * changes, so the status and navigation bars match the app: the bar colors
 * (used up to Android 14; from Android 15 the app draws behind the bars) and
 * dark or light bar icons, which every version uses.
 */
class SystemBarsBridge(private val activity: Activity) {
  @JavascriptInterface
  fun setColors(top: String, bottom: String, light: Boolean) {
    activity.runOnUiThread {
      try {
        val window = activity.window
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.parseColor(top)
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.parseColor(bottom)
        window.decorView.setBackgroundColor(Color.parseColor(top))
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = light
        controller.isAppearanceLightNavigationBars = light
      } catch (e: Exception) {
        Logger.warn("Could not color the system bars: $e")
      }
    }
  }
}
