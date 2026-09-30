# Local portrait segmentation

Google MediaPipe Selfie Multiclass 256 × 256 float32 model, Apache License 2.0.

- Model: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
- SHA-256: c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0
- Model card/license: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf
- Runtime: @mediapipe/tasks-vision, locked by package-lock.json (Apache 2.0). Its WASM distribution is copied into public assets during build.
- Classes: background, hair, body skin, face skin, clothes, accessories.

The downloaded model is committed as an immutable asset; builds do not download a moving `latest` model. Photos are processed on the user's device and never sent to a segmentation API. The included Apache license applies to the model and runtime, not uploaded photographs.
