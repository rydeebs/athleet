import {FilesetResolver,FaceLandmarker} from '@mediapipe/tasks-vision';
let task;
export async function suggestLandmarks(canvas){
 if(!task)task=FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/assets/vision/v1/wasm'),{baseOptions:{modelAssetPath:'/assets/vision/v1/face-landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:2,outputFaceBlendshapes:true}).catch(e=>{task=null;throw e;});
 const result=(await task).detect(canvas);if(result.faceLandmarks.length!==1)return null;const p=result.faceLandmarks[0],xy=i=>[p[i].x,p[i].y],mid=(a,b)=>[(p[a].x+p[b].x)/2,(p[a].y+p[b].y)/2];
 const eyes=[mid(33,133),mid(362,263)].sort((a,b)=>a[0]-b[0]),mouth=[xy(61),xy(291)].sort((a,b)=>a[0]-b[0]),cheeks=[xy(234),xy(454)].sort((a,b)=>a[0]-b[0]);
 const scores=Object.fromEntries((result.faceBlendshapes[0]?.categories||[]).map(c=>[c.categoryName,c.score]));return {points:{eyeL:eyes[0],eyeR:eyes[1],nose:xy(1),mouth:mid(13,14),chin:xy(152),cheekL:cheeks[0],cheekR:cheeks[1],mouthL:mouth[0],mouthR:mouth[1]},expression:Math.max(scores.mouthSmileLeft||0,scores.mouthSmileRight||0,scores.jawOpen||0)>.45};
}
