import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';
import 'dart:io';
import 'package:url_launcher/url_launcher.dart';

void showInAppUpdateDialog(BuildContext context, String downloadUrl) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext context) {
      bool isDownloading = false;
      String downloadPercentage = "0";
      String updateStatusMessage = "";

      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: const Text('App Update'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isDownloading && updateStatusMessage.isEmpty)
                  const Text('A new version of the app is available. Please update to continue.'),
                if (updateStatusMessage.isNotEmpty && !isDownloading)
                  Text(
                    updateStatusMessage,
                    style: const TextStyle(color: Colors.red),
                  ),
                if (isDownloading) ...[
                  LinearProgressIndicator(
                    value: double.tryParse(downloadPercentage) != null
                        ? double.parse(downloadPercentage) / 100
                        : null,
                  ),
                  const SizedBox(height: 16),
                  Text(updateStatusMessage.isNotEmpty
                      ? updateStatusMessage
                      : 'Downloading: $downloadPercentage%'),
                ],
              ],
            ),
            actions: [
              if (!isDownloading)
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      isDownloading = true;
                      updateStatusMessage = "";
                      downloadPercentage = "0";
                    });

                    if (Platform.isAndroid) {
                      try {
                        OtaUpdate()
                            .execute(
                          downloadUrl,
                          destinationFilename: 'my-app-update.apk',
                        )
                            .listen(
                          (OtaEvent event) {
                            setState(() {
                              if (event.status == OtaStatus.DOWNLOADING) {
                                downloadPercentage = event.value ?? "0";
                              } else if (event.status == OtaStatus.INSTALLING) {
                                updateStatusMessage = "Preparing to install...";
                              } else if (event.status == OtaStatus.ALREADY_RUNNING_ERROR ||
                                  event.status == OtaStatus.PERMISSION_NOT_GRANTED_ERROR ||
                                  event.status == OtaStatus.INTERNAL_ERROR ||
                                  event.status == OtaStatus.DOWNLOAD_ERROR) {
                                isDownloading = false;
                                updateStatusMessage = "Error: failed to download or install update. Please try again.";
                              }
                            });
                          },
                          onError: (error) {
                            setState(() {
                              isDownloading = false;
                              updateStatusMessage = "Error: $error";
                            });
                          },
                        );
                      } catch (e) {
                        setState(() {
                          isDownloading = false;
                          updateStatusMessage = "Error: $e";
                        });
                      }
                    } else {
                      // Fallback for iOS / Web
                      final uri = Uri.parse(downloadUrl);
                      canLaunchUrl(uri).then((canLaunch) {
                        if (canLaunch) {
                          launchUrl(uri, mode: LaunchMode.externalApplication);
                        } else {
                          setState(() {
                            isDownloading = false;
                            updateStatusMessage = "Error: Could not open the update link.";
                          });
                        }
                      });
                    }
                  },
                  child: const Text('UPDATE NOW'),
                ),
            ],
          );
        },
      );
    },
  );
}
