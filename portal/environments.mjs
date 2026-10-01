import * as T from 'three';
// A light sci-fi arena with colored moving rails and a soft sage horizon.
export function environmentScene(){
 const group=new T.Group(),materials=new Set(),geometries=new Set(),runners=[],arcs=[];
 const mat=(color,glow=false,opacity=1)=>{const m=glow?new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,blending:T.NormalBlending}):new T.MeshStandardMaterial({color,roughness:.72,metalness:.25});materials.add(m);return m;};
 const mesh=(geometry,material,x,y,z)=>{geometries.add(geometry);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;};
 const palette=['#d9ed93','#728e30','#283e34','#b8df56'],neon=palette.map(c=>mat(c,true)),structure=mat('#c7d4cb');
 const floor=mesh(new T.PlaneGeometry(26,26),mat('#e2e9dd'),0,-.012,0);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
 const platform=mesh(new T.CylinderGeometry(.68,.74,.05,64),structure,0,-.026,0);platform.receiveShadow=true;
 for(let i=0;i<3;i++){const ring=mesh(new T.TorusGeometry(.72+i*.11,.006,6,96),neon[i],0,.008,0);ring.rotation.x=-Math.PI/2;}
 for(let i=0;i<3;i++){const arc=mesh(new T.TorusGeometry(.77+i*.11,.017,6,64,Math.PI*.55),neon[(i+1)%4],0,.012+i*.002,0);arc.rotation.x=-Math.PI/2;arcs.push(arc);}
 for(let i=0;i<8;i++){
  const z=-1.25-i*1.4,color=neon[i%3];
  for(const side of [-1,1]){
   mesh(new T.BoxGeometry(.12,2.8,.12),structure,side*1.65,1.39,z);
   mesh(new T.BoxGeometry(.016,2.7,.018),color,side*1.58,1.35,z+.07);
   const halo=mesh(new T.PlaneGeometry(.10,2.7),mat(palette[i%3],true,.13),side*1.58,1.35,z+.085);halo.renderOrder=1;
   const pulse=mesh(new T.BoxGeometry(.035,.30,.032),neon[(i+1)%4],side*1.58,1,z+.09);runners.push({mesh:pulse,phase:i*.7+(side+1)*.9,vertical:true});
  }
  mesh(new T.BoxGeometry(3.18,.018,.018),color,0,2.7,z+.07);
 }
 for(const side of [-1,1]){
  mesh(new T.BoxGeometry(.018,.015,13),neon[side<0?0:2],side*1.2,.004,-5);
  const runner=mesh(new T.BoxGeometry(.06,.025,.8),neon[side<0?3:1],side*1.2,.017,-3);runners.push({mesh:runner,phase:side,vertical:false});
 }
 const grid=new T.GridHelper(24,48,0xaebfb2,0xc9d4c7);grid.position.y=-.008;group.add(grid);geometries.add(grid.geometry);for(const m of [grid.material].flat())materials.add(m);
 const lime=new T.PointLight(0xd9ed93,1.5,5,2),green=new T.PointLight(0x728e30,1.2,5,2);lime.position.set(-1.2,1.5,-.8);green.position.set(1.2,1.8,-1);group.add(lime,green);
 return {group,background:new T.Color('#edf0e6'),fog:new T.Fog('#edf0e6',4,15),update(seconds){
  arcs.forEach((arc,i)=>{arc.rotation.z=seconds*(i%2?-.24:.2)+i*2;});
  for(const r of runners){if(r.vertical)r.mesh.position.y=.2+((seconds*.28+r.phase)%2.4);else r.mesh.position.z=1-((seconds*1.1+r.phase+20)%12);}
  lime.position.z=-.8+Math.sin(seconds*.4)*.45;green.position.y=1.6+Math.sin(seconds*.35)*.35;
 },dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
