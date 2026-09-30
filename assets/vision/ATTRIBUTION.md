# Local portrait segmentation

Google MediaPipe Selfie Multiclass 256 × 256 float32 model, Apache License 2.0.

- Model: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
- SHA-256: c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0
- Model card/license: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf
- Runtime: @mediapipe/tasks-vision, locked by package-lock.json (Apache 2.0). Its WASM distribution is copied into public assets during build.
- Classes: background, hair, body skin, face skin, clothes, accessories.

The downloaded model is committed as an immutable asset; builds do not download a moving `latest` model. Photos are processed on the user's device and never sent to a segmentation API. The included Apache license applies to the model and runtime, not uploaded photographs.

## Five-view alignment

The optional likeness editor also uses Google's Face Landmarker v1 bundle locally to suggest landmarks for front and three-quarter photos. Full profiles use manual landmarks because the model is not intended for views beyond 80 degrees. This does not identify people.

- Model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SHA-256: 64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff
- Model card / Apache 2.0 license: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf
