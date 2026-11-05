package com.contentflow.contentflow_mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.util.ArrayDeque
import java.util.Locale

/**
 * On-device speech. The domestic web app keeps its TTS routes for the browser;
 * the phone uses the system recognizer and the system speech engine.
 */
class MainActivity : FlutterActivity() {
    private val methodName = "contentflow/voice"
    private val eventName = "contentflow/voice/events"
    private val micRequest = 4101
    private val mainHandler = Handler(Looper.getMainLooper())
    private val pending = ArrayDeque<Map<String, String?>>()

    private var sink: EventChannel.EventSink? = null
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingSpeak: Pair<String, String>? = null
    private var speakSerial = 0

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, eventName).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    sink = events
                    while (pending.isNotEmpty()) events?.success(pending.removeFirst())
                }

                override fun onCancel(arguments: Any?) {
                    sink = null
                }
            },
        )
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, methodName).setMethodCallHandler { call, result ->
            when (call.method) {
                "listenStart" -> {
                    val locale = call.argument<String>("locale") ?: "zh-CN"
                    if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                        result.error("unavailable", "speech", null)
                        return@setMethodCallHandler
                    }
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), micRequest)
                        result.error("permission", "microphone", null)
                        return@setMethodCallHandler
                    }
                    startListen(locale)
                    result.success(null)
                }
                "listenStop" -> {
                    recognizer?.stopListening()
                    emit("listen-end", null)
                    result.success(null)
                }
                "speak" -> {
                    val text = call.argument<String>("text") ?: ""
                    val locale = call.argument<String>("locale") ?: "zh-CN"
                    recognizer?.stopListening()
                    speak(text, locale)
                    result.success(null)
                }
                "speakStop" -> {
                    tts?.stop()
                    emit("speak-done", null)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun emit(type: String, text: String?) {
        val map = mapOf("type" to type, "text" to text)
        mainHandler.post {
            val events = sink
            if (events == null) pending.add(map) else events.success(map)
        }
    }

    private fun startListen(locale: String) {
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this)
            recognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = emit("listening", null)
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() = emit("listen-end", null)
                override fun onError(error: Int) {
                    if (error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) return
                    emit("error", "recognizer")
                }
                override fun onResults(results: Bundle?) {
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    emit("final", text)
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    if (!text.isNullOrBlank()) emit("partial", text)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        recognizer?.startListening(intent)
    }

    private fun speak(text: String, localeTag: String) {
        if (text.isBlank()) return
        if (tts == null || !ttsReady) {
            pendingSpeak = text to localeTag
            if (tts == null) {
                tts = TextToSpeech(this) { status ->
                    ttsReady = status == TextToSpeech.SUCCESS
                    val pending = pendingSpeak
                    pendingSpeak = null
                    if (ttsReady && pending != null) speak(pending.first, pending.second)
                    else if (!ttsReady) emit("error", "tts")
                }
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) = emit("speak-start", null)
                    override fun onDone(utteranceId: String?) {
                        if (utteranceId == "contentflow-last") emit("speak-done", null)
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) = emit("error", "tts")
                    override fun onError(utteranceId: String?, errorCode: Int) = emit("error", "tts")
                })
            }
            return
        }
        val locale = Locale.forLanguageTag(localeTag)
        tts?.language = locale
        val chunks = text.chunked(3000)
        val serial = ++speakSerial
        chunks.forEachIndexed { index, chunk ->
            val queue = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            val id = if (index == chunks.lastIndex) "contentflow-last" else "contentflow-$serial-$index"
            tts?.speak(chunk, queue, null, id)
        }
    }

    override fun onDestroy() {
        recognizer?.destroy()
        tts?.shutdown()
        super.onDestroy()
    }
}
