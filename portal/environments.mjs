import * as T from 'three';
// One shared arena, with moving emissive geometry instead of expensive bloom.
export function environmentScene(){
 const group=new T.Group(),materials=new Set(),geometries=new Set(),runners=[],arcs=[];
 const mat=(color,glow=false,opacity=1)=>{const m=glow?new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,blending:opacity<1?T.AdditiveBlending:T.NormalBlending}):new T.MeshStandardMaterial({color,roughness:.72,metalness:.25});materials.add(m);return m;};
 const mesh=(geometry,material,x,y,z)=>{geometries.add(geometry);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;};
 const palette=['#26e4ff','#b86cff','#ff5ea8','#ffd174'],neon=palette.map(c=>mat(c,true)),dark=mat('#122239');
 const floor=mesh(new T.PlaneGeometry(26,26),mat('#091526'),0,-.012,0);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
 const platform=mesh(new T.CylinderGeometry(.68,.74,.05,64),dark,0,-.026,0);platform.receiveShadow=true;
 for(let i=0;i<3;i++){const ring=mesh(new T.TorusGeometry(.72+i*.11,.006,6,96),neon[i],0,.008,0);ring.rotation.x=-Math.PI/2;}
 for(let i=0;i<3;i++){const arc=mesh(new T.TorusGeometry(.77+i*.11,.017,6,64,Math.PI*.55),neon[(i+1)%4],0,.012+i*.002,0);arc.rotation.x=-Math.PI/2;arcs.push(arc);}
 for(let i=0;i<8;i++){
  const z=-1.25-i*1.4,color=neon[i%3];
  for(const side of [-1,1]){
   mesh(new T.BoxGeometry(.12,2.8,.12),dark,side*1.65,1.39,z);
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
 const grid=new T.GridHelper(24,48,0x244e76,0x172b4d);grid.position.y=-.008;group.add(grid);geometries.add(grid.geometry);for(const m of [grid.material].flat())materials.add(m);
 const cyan=new T.PointLight(0x28cfff,1.5,5,2),pink=new T.PointLight(0xef56bd,1.2,5,2);cyan.position.set(-1.2,1.5,-.8);pink.position.set(1.2,1.8,-1);group.add(cyan,pink);
 return {group,background:new T.Color('#060d22'),fog:new T.Fog('#060d22',6,18),update(seconds){
  arcs.forEach((arc,i)=>{arc.rotation.z=seconds*(i%2?-.24:.2)+i*2;});
  for(const r of runners){if(r.vertical)r.mesh.position.y=.2+((seconds*.28+r.phase)%2.4);else r.mesh.position.z=1-((seconds*1.1+r.phase+20)%12);}
  cyan.position.z=-.8+Math.sin(seconds*.4)*.45;pink.position.y=1.6+Math.sin(seconds*.35)*.35;
 },dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
