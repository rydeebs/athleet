import * as T from 'three';
export function environmentScene(name){
 const group=new T.Group(),materials=[],geometries=[];
 const mat=(color,emissive=false)=>{const m=emissive?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:.9});materials.push(m);return m;};
 const mesh=(geometry,material,x,y,z)=>{geometries.push(geometry);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;};
 const plane=(color,size=24)=>{const p=mesh(new T.PlaneGeometry(size,size),mat(color),0,-.012,0);p.rotation.x=-Math.PI/2;p.receiveShadow=true;return p;};
 let background=null,fog=null;
 if(name==='scifi'){
  background=new T.Color('#071424');fog=new T.Fog('#071424',5,16);plane('#101b2a');const cyan=mat('#43d3f3',true),dark=mat('#14263b');
  const platform=mesh(new T.CylinderGeometry(.65,.70,.05,64),dark,0,-.026,0);platform.receiveShadow=true;
  for(const radius of [.69,.78]){const ring=mesh(new T.TorusGeometry(radius,.006,6,80),cyan,0,.005,0);ring.rotation.x=Math.PI/2;}
  for(let i=0;i<7;i++){const z=-1.2-i*1.4;for(const x of [-1.6,1.6]){mesh(new T.BoxGeometry(.11,2.7,.11),dark,x,1.34,z);mesh(new T.BoxGeometry(.014,2.6,.014),cyan,x-.07,1.3,z);}mesh(new T.BoxGeometry(3.2,.012,.012),cyan,0,2.6,z);}
  const grid=new T.GridHelper(20,40,0x244c64,0x142c43);grid.position.y=-.008;group.add(grid);geometries.push(grid.geometry);materials.push(grid.material);
 }else if(name==='beach'){
  background=new T.Color('#bde8f3');fog=new T.Fog('#bde8f3',9,28);plane('#ead8b1');const ocean=mesh(new T.PlaneGeometry(45,25),mat('#43a7b2'),0,-.006,-14);ocean.rotation.x=-Math.PI/2;
  const trunk=mat('#866947'),leaves=mat('#3c7960');for(const [x,z] of [[-2,-2.5],[2.4,-4]]){mesh(new T.CylinderGeometry(.045,.075,2.7,9),trunk,x,1.33,z);for(let j=0;j<7;j++){const a=j/7*Math.PI*2,p=mesh(new T.SphereGeometry(1,12,6),leaves,x+Math.cos(a)*.4,2.62,z+Math.sin(a)*.4);p.scale.set(.62,.035,.14);p.rotation.y=-a;p.rotation.z=.2;}}
 }else if(name==='city'){
  background=new T.Color('#c0cddd');fog=new T.Fog('#c0cddd',10,28);plane('#889292');const building=mat('#566875'),window=mat('#d2e6df',true);for(let i=0;i<14;i++){const x=(i%7-3)*1.65,z=-4-Math.floor(i/7)*3,h=1.2+((i*7)%9)*.25;mesh(new T.BoxGeometry(1,h,.9),building,x,h/2,z);for(let y=.35;y<h-.1;y+=.5)mesh(new T.BoxGeometry(.72,.10,.015),window,x,y,z+.46);}const railing=mat('#364854');for(const x of [-2,2])mesh(new T.BoxGeometry(.04,.8,5),railing,x,.4,-1.5);
 }else if(name==='landscape'){
  background=new T.Color('#d6e6da');fog=new T.Fog('#d6e6da',7,28);plane('#789575');const mountain=mat('#677d80'),snow=mat('#e5ece5'),trees=mat('#31584b');for(let i=0;i<9;i++){const x=(i-4)*2,h=2.3+(i%3)*.7;mesh(new T.ConeGeometry(2,h,7),mountain,x,h/2,-7-(i%2)*3);mesh(new T.ConeGeometry(.5,h*.25,7),snow,x,h*.88,-7-(i%2)*3);}for(let i=0;i<12;i++){const x=(i%2?1:-1)*(1.8+(i%5)*.6),z=-1-i*.55;mesh(new T.ConeGeometry(.24,.95,9),trees,x,.47,z);}
 }
 return {group,background,fog,dispose(){for(const g of new Set(geometries))g.dispose();for(const m of new Set(materials.flat()))m.dispose();}};
}
