import AVFoundation
import Flutter
import Speech
import UIKit

/// On-device speech for ContentFlow Global. Locale is chosen by the Dart
/// control (en-US). No provider keys.
@main
@objc class AppDelegate: FlutterAppDelegate, FlutterStreamHandler, AVSpeechSynthesizerDelegate {
  private var sink: FlutterEventSink?
  private var pending: [[String: String?]] = []
  private let audioEngine = AVAudioEngine()
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private let synthesizer = AVSpeechSynthesizer()
  private var recognizer: SFSpeechRecognizer?
  private var tapInstalled = false

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    let ok = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    attachVoice()
    return ok
  }

  private func attachVoice() {
    let controller = window?.rootViewController as? FlutterViewController
      ?? (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.windows.first?.rootViewController as? FlutterViewController
    guard let controller else { return }
    let messenger = controller.binaryMessenger
    FlutterEventChannel(name: "contentflow/voice/events", binaryMessenger: messenger).setStreamHandler(self)
    FlutterMethodChannel(name: "contentflow/voice", binaryMessenger: messenger).setMethodCallHandler { [weak self] call, result in
      guard let self else { return }
      let args = call.arguments as? [String: Any] ?? [:]
      switch call.method {
      case "listenStart":
        let locale = args["locale"] as? String ?? "en-US"
        self.ensurePermissions { granted in
          if !granted {
            result(FlutterError(code: "permission", message: "microphone", details: nil))
            return
          }
          do {
            try self.startRecording(locale: locale)
            result(nil)
          } catch {
            result(FlutterError(code: "unavailable", message: "speech", details: nil))
          }
        }
      case "listenStop":
        self.stopRecording(emitEnd: true)
        result(nil)
      case "speak":
        let text = args["text"] as? String ?? ""
        let locale = args["locale"] as? String ?? "en-US"
        self.stopRecording(emitEnd: false)
        self.speak(text: text, locale: locale)
        result(nil)
      case "speakStop":
        self.synthesizer.stopSpeaking(at: .immediate)
        self.emit(type: "speak-done", text: nil)
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    for event in pending { events(event) }
    pending.removeAll()
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    sink = nil
    return nil
  }

  private func emit(type: String, text: String?) {
    let event: [String: String?] = ["type": type, "text": text]
    DispatchQueue.main.async {
      if let sink = self.sink {
        sink(event)
      } else {
        self.pending.append(event)
      }
    }
  }

  private func ensurePermissions(_ done: @escaping (Bool) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else {
        DispatchQueue.main.async { done(false) }
        return
      }
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        DispatchQueue.main.async { done(granted) }
      }
    }
  }

  private func startRecording(locale: String) throws {
    stopRecording(emitEnd: false)
    synthesizer.stopSpeaking(at: .immediate)
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
    try session.setActive(true, options: .notifyOthersOnDeactivation)
    let recognition = SFSpeechAudioBufferRecognitionRequest()
    recognition.shouldReportPartialResults = true
    request = recognition
    let speech = SFSpeechRecognizer(locale: Locale(identifier: locale))
    guard let speech, speech.isAvailable else {
      throw NSError(domain: "contentflow.voice", code: 1)
    }
    recognizer = speech
    task = speech.recognitionTask(with: recognition) { [weak self] result, error in
      guard let self else { return }
      if let result {
        let text = result.bestTranscription.formattedString
        if result.isFinal {
          self.emit(type: "final", text: text)
          self.stopRecording(emitEnd: false)
        } else {
          self.emit(type: "partial", text: text)
        }
      }
      if error != nil {
        self.emit(type: "error", text: "recognizer")
        self.stopRecording(emitEnd: false)
      }
    }
    let input = audioEngine.inputNode
    let format = input.outputFormat(forBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
      recognition.append(buffer)
    }
    tapInstalled = true
    audioEngine.prepare()
    try audioEngine.start()
    emit(type: "listening", text: nil)
  }

  private func stopRecording(emitEnd: Bool) {
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    if tapInstalled {
      audioEngine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    request?.endAudio()
    request = nil
    task?.cancel()
    task = nil
    if emitEnd { emit(type: "listen-end", text: nil) }
  }

  private func speak(text: String, locale: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return }
    synthesizer.stopSpeaking(at: .immediate)
    synthesizer.delegate = self
    let voice = AVSpeechSynthesisVoice(language: locale)
    var start = trimmed.startIndex
    while start < trimmed.endIndex {
      let end = trimmed.index(start, offsetBy: 3000, limitedBy: trimmed.endIndex) ?? trimmed.endIndex
      let utterance = AVSpeechUtterance(string: String(trimmed[start..<end]))
      utterance.voice = voice
      synthesizer.speak(utterance)
      start = end
    }
    emit(type: "speak-start", text: nil)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    if !synthesizer.isSpeaking { emit(type: "speak-done", text: nil) }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    emit(type: "speak-done", text: nil)
  }
}
