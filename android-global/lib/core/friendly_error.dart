import 'package:flutter/material.dart';

const String kLoadingMessage = 'Loading. If this stays on screen, check your connection and try again. Nothing has been published.';

/// Replaces Flutter's red error screen with a next step. Nothing is published from a crashed view.
void installFriendlyErrorWidget() {
  ErrorWidget.builder = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    return const Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: Color(0xFFF8FAFC),
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'This screen hit an error. Go back and try again. Nothing was published.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  };
}

class CfLoading extends StatelessWidget {
  const CfLoading({super.key, this.message = kLoadingMessage});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
