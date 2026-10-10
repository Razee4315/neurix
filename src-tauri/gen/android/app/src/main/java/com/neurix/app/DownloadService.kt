package com.neurix.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * A foreground service with no work of its own.
 *
 * Android freezes or kills a backgrounded app within minutes. Model files are
 * gigabytes, so without this a download only survives if the user keeps the
 * app on screen the whole time. While the service runs (with its ongoing
 * notification) the process stays alive and the Rust download continues.
 */
class DownloadService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { stopSelf() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "model"
    val notification = buildNotification(title)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    acquireLocks()

    // Safety net: if the web layer never reports the download as finished,
    // do not hold the device awake indefinitely.
    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, MAX_RUNTIME_MS)

    // If the process is killed there is no download to resume from here, so
    // do not ask to be restarted.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    releaseLocks()
    super.onDestroy()
  }

  // Android 14+ calls this when a dataSync service reaches its daily limit.
  override fun onTimeout(startId: Int) {
    stopSelf()
  }

  private fun buildNotification(title: String): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Background downloads",
      NotificationManager.IMPORTANCE_LOW
    )
    channel.description = "Shown while a model is downloading so the download is not interrupted"
    manager.createNotificationChannel(channel)

    val open = packageManager.getLaunchIntentForPackage(packageName)
      ?: Intent(this, MainActivity::class.java)
    val pending = PendingIntent.getActivity(
      this,
      0,
      open,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle("Downloading $title")
      .setContentText("Neurix keeps downloading in the background")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(pending)
      .build()
  }

  private fun acquireLocks() {
    if (wakeLock == null) {
      val power = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Neurix:download").apply {
        setReferenceCounted(false)
        acquire(MAX_RUNTIME_MS)
      }
    }
    if (wifiLock == null) {
      val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      @Suppress("DEPRECATION")
      wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Neurix:download").apply {
        setReferenceCounted(false)
        acquire()
      }
    }
  }

  private fun releaseLocks() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    wifiLock?.let { if (it.isHeld) it.release() }
    wifiLock = null
  }

  companion object {
    private const val CHANNEL_ID = "download_service"
    private const val NOTIFICATION_ID = 4201
    private const val EXTRA_TITLE = "title"
    private const val MAX_RUNTIME_MS = 6L * 60L * 60L * 1000L

    fun start(context: Context, title: String) {
      val intent = Intent(context, DownloadService::class.java).putExtra(EXTRA_TITLE, title)
      context.startForegroundService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, DownloadService::class.java))
    }
  }
}
