import {FilesetResolver,ImageSegmenter} from '@mediapipe/tasks-vision';
let instance;
export async function segmentPortrait(canvas){
 if(!instance)instance=(async()=>ImageSegmenter.createFromOptions(await FilesetResolver.forVisionTasks('/assets/vision/v1/wasm'),{baseOptions:{modelAssetPath:'/assets/vision/v1/selfie-multiclass.tflite',delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true}))().catch(e=>{instance=null;throw e;});
 const segmenter=await instance;
 // Copy within the callback; MediaPipe owns and releases these result buffers.
 return new Promise((resolve,reject)=>{try{segmenter.segment(canvas,result=>{const masks=result.confidenceMasks;resolve({width:masks[0].width,height:masks[0].height,hair:new Float32Array(masks[1].getAsFloat32Array()),skin:new Float32Array(masks[3].getAsFloat32Array())});});}catch(e){reject(e);}});
}
