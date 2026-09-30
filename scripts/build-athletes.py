"""Run with Blender 4.5: blender -b --python scripts/build-athletes.py -- SOURCE_DIR OUTPUT_DIR.
Source assets: MakeHuman/MPFB CC0. See assets/athletes/ATTRIBUTION.md.
"""
import bpy, sys, os, gzip, math
from functools import cache
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]; SRC,OUT=map(os.path.abspath,args[:2]); os.makedirs(OUT,exist_ok=True)
def obj(path):
 v=[];uv=[];faces=[];group='body'
 for line in open(path):
  p=line.split()
  if not p:continue
  if p[0]=='v':v.append(list(map(float,p[1:4])))
  elif p[0]=='vt':uv.append(list(map(float,p[1:3])))
  elif p[0]=='g':group=p[1]
  elif p[0]=='f':faces.append((group,[(int(q.split('/')[0])-1,int(q.split('/')[1])-1 if '/' in q and q.split('/')[1] else 0) for q in p[1:]]))
 return np.array(v),uv,faces
base,uv,faces=obj(SRC+'/base.obj')
@cache
def delta(name):
 a=np.zeros_like(base)
 for line in gzip.open(SRC+'/'+name+'.target.gz','rt'):
  p=line.split()
  if len(p)==4:a[int(p[0])]=list(map(float,p[1:]))
 return a

def shape(pres,build='athletic'):
 a=base.copy();f={'masculine':0,'feminine':1,'neutral':.38}[pres]
 for sex,w in [('female',f),('male',1-f)]:
  for ancestry in ['african','asian','caucasian']:a+=delta(ancestry+'-'+sex+'-young')*w/3
  avg=delta('universal-'+sex+'-young-averagemuscle-averageweight')
  strong=delta('universal-'+sex+'-young-maxmuscle-averageweight')
  lean=delta('universal-'+sex+'-young-maxmuscle-minweight')
  a+=(lean*.85+strong*.15 if build=='lean' else strong if build=='strong' else lean*.35+strong*.65)*w
 return a

def transform(points,lowest):
 p=points.copy();p[:,1]-=lowest
 p=np.stack([p[:,0],-p[:,2],p[:,1]],axis=1)*SCALE
 # Broad, anatomical volume changes keep the three trained builds legible.
 x=p[:,0].copy();h=p[:,2];front=np.clip((-p[:,1]-.015)/.06,0,1)
 breadth={'lean':.96,'athletic':1.045,'strong':1.15}[BUILD]
 p[:,0]*=1+(breadth-1)*np.exp(-((h-1.25)/.30)**4)
 p[:,0]*=1-{'lean':.06,'athletic':.05,'strong':.025}[BUILD]*np.exp(-((h-1.035)/.11)**2)
 def g(cx,cz,sx,sz):return np.exp(-((np.abs(x)-cx)/sx)**2-((h-cz)/sz)**2)
 pec={'lean':.008,'athletic':.014,'strong':.021}[BUILD]*(.45 if PRES=='feminine' else 1)
 definition={'lean':.0035,'athletic':.0045,'strong':.0055}[BUILD]
 relief=pec*g(.075,1.335,.066,.065)
 for z in [1.075,1.14,1.205]:relief+=definition*g(.037,z,.028,.025)
 relief-=.0015*g(0,1.15,.008,.14)
 p[:,1]-=relief*front
 return p

def material(name,color=(1,1,1,1),texture=None,alpha=False):
 m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=color;bs.inputs['Roughness'].default_value=.56 if name=='Skin' else .82
 if name=='Skin':bs.inputs['Subsurface Weight'].default_value=.08
 if name in ['Skin','Kit']:
  noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=650 if name=='Skin' else 400
  bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.001
  m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
 if texture:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(OUT+'/'+texture,check_existing=True)
  mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
  mix.inputs[2].default_value={'Skin':(.63,.43,.29,1),'Hair':(.065,.043,.028,1),'Shoes':(.6,.65,.6,1)}.get(name,(1,1,1,1))
  m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
  if alpha:m.node_tree.links.new(t.outputs['Alpha'],bs.inputs['Alpha']);m.surface_render_method='DITHERED'
 return m

def mesh(name,positions,uvs,fs,mat,offset=0):
 used=sorted(set(i for _,f in fs for i,t in f));lookup={old:i for i,old in enumerate(used)}
 m=bpy.data.meshes.new(name);m.from_pydata([positions[i] for i in used],[],[[lookup[i] for i,t in f] for _,f in fs]);m.update()
 ob=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
 layer=m.uv_layers.new(name='UVMap')
 for poly,(_,f) in zip(m.polygons,fs):
  poly.use_smooth=True
  for loop,(_,t) in zip(poly.loop_indices,f):layer.data[loop].uv=uvs[t] if uvs else (0,0)
 if offset:
  # Smooth the cut boundary loops so necklines, armholes and hems are tailored.
  edge_count={}
  for poly in m.polygons:
   for edge in poly.edge_keys:edge_count[edge]=edge_count.get(edge,0)+1
  neighbors={}
  for (a,b),count in edge_count.items():
   if count==1:neighbors.setdefault(a,[]).append(b);neighbors.setdefault(b,[]).append(a)
  for _ in range(8):
   updates={i:sum((m.vertices[j].co for j in ns),Vector())/len(ns) for i,ns in neighbors.items()}
   for i,p in updates.items():m.vertices[i].co=m.vertices[i].co.lerp(p,.5)
  m.update()
  for i in neighbors:
   v=m.vertices[i]
   if name in ['Shorts','Leggings']:
    if v.co.z>.9:v.co.z=1.005
    elif name=='Shorts' and v.co.z<.75:v.co.z=.65
    elif name=='Leggings' and v.co.z<.2:v.co.z=.12
  for v in m.vertices:
   p,n,_,distance=BODY_BVH.find_nearest(v.co)
   if p is not None:v.co=p+n*.004
  m.update()
 return ob,used

def proxy(path,points):
 v,u,fs=obj(SRC+'/system/'+path+'.obj');scales=[1,1,1];mapping=[];reading=False
 for line in open(SRC+'/system/'+path+'.mhclo'):
  p=line.split()
  if not p or p[0].startswith('#'):continue
  if p[0] in ['x_scale','y_scale','z_scale']:
   ax=['x_scale','y_scale','z_scale'].index(p[0]);scales[ax]=abs(points[int(p[1]),ax]-points[int(p[2]),ax])/float(p[3])
  elif p[0]=='verts':reading=True
  elif reading:
   if not p[0].lstrip('-').isdigit():
    if mapping:break
    continue
   if len(p)==1:mapping.append(points[int(p[0])])
   else:mapping.append(sum(points[int(p[i])]*float(p[3+i]) for i in range(3))+np.array(list(map(float,p[6:9])))*scales)
 return np.array(mapping),u,fs

def refine_surface(ob,levels,body=False):
 original=ob.data
 keys=[(k.name,[v.co.copy() for v in k.data]) for k in original.shape_keys.key_blocks] if original.shape_keys else [('Basis',[v.co.copy() for v in original.vertices])]
 meshes=[]
 for name,coords in keys:
  m=bpy.data.meshes.new('refine');m.from_pydata(coords,[],[list(p.vertices) for p in original.polygons]);m.update()
  layer=m.uv_layers.new(name='UVMap')
  for i,d in enumerate(original.uv_layers.active.data):layer.data[i].uv=d.uv
  tmp=bpy.data.objects.new('refine',m);bpy.context.collection.objects.link(tmp)
  bpy.context.view_layer.objects.active=tmp
  mod=tmp.modifiers.new('Smooth surface','SUBSURF');mod.levels=levels
  bpy.ops.object.modifier_apply(modifier=mod.name)
  refined=tmp.data.copy()
  if not body:
   target=BODY_OBJECT.data.shape_keys.key_blocks.get(name) or BODY_OBJECT.data.shape_keys.key_blocks[0]
   bvh=BVHTree.FromPolygons([v.co for v in target.data],[list(p.vertices) for p in BODY_OBJECT.data.polygons])
   for v in refined.vertices:
    loc,n,_,_=bvh.find_nearest(v.co)
    if loc is not None:v.co=loc+n*.0035
  meshes.append((name,refined));bpy.data.objects.remove(tmp,do_unlink=True)
 ob.shape_key_clear();ob.data=meshes[0][1]
 for mat in original.materials:ob.data.materials.append(mat)
 for poly in ob.data.polygons:poly.use_smooth=True
 if len(meshes)>1:
  for name,m in meshes:
   key=ob.shape_key_add(name=name)
   for i,v in enumerate(m.vertices):key.data[i].co=v.co
 return ob

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.world.color=(.35,.35,.35);scene.view_settings.view_transform='AgX'
for name,loc,power,size in [('Key',(-3,-4,4),450,4),('Fill',(3,-2,2.5),230,3),('Rim',(1,2,3),500,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.1,-5.8,1.9));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.89))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.02;scene.camera=camera
outfits=['shirtless','singlet','sports-bra','tee','long-sleeve','tri-suit','wetsuit']
for pres in ['masculine','feminine','neutral']:
 PRES=pres;BUILD='athletic';points=shape(pres);low=min(points[i,1] for g,f in faces if g=='body' for i,t in f);high=max(points[i,1] for g,f in faces if g=='body' for i,t in f);SCALE=1.75/(high-low);pos=transform(points,low)
 sex='female' if pres=='feminine' else 'male'
 mats={'skin':material('Skin',texture='skin-'+sex+'-light.jpg'),'kit':material('Kit',(.035,.065,.048,1)),'hair':material('Hair',texture='hair-'+('ponytail01' if pres=='feminine' else 'short02')+'.png',alpha=True),'eyes':material('Eyes',texture='eyes.jpg'),'shoes':material('Shoes',texture='shoes.jpg')}
 objects=[]
 body,used=mesh('Body',pos,uv,[f for f in faces if f[0]=='body' and np.mean([pos[i,2] for i,t in f[1]])>.13],mats['skin']);objects.append(body)
 BODY_BVH=BVHTree.FromPolygons([v.co for v in body.data.vertices],[list(p.vertices) for p in body.data.polygons])
 body.shape_key_add(name='Basis')
 for build in ['lean','strong']:
  BUILD=build;new=transform(shape(pres,build),low);BUILD='athletic';key=body.shape_key_add(name=build)
  for j,i in enumerate(used):key.data[j].co=new[i]
 # Tight helper follows body contours; crop into garments with distinct coverage.
 helper=[f for f in faces if f[0]=='helper-tights']
 def choose(kind):
  result=[]
  for g,f in helper:
   c=np.mean([pos[i] for i,t in f],axis=0);x,y,z=c;ax=abs(x)
   if kind=='Shorts':keep=.64<z<1.01 and ax<.32
   elif kind=='Leggings':keep=.10<z<1.01 and ax<.32
   else:
    keep=.98<=z<1.47
    # Neckline and armholes follow the fitted torso; sleeves extend over the arms.
    if kind in ['Singlet','Bra']:keep=keep and ax<(.17 if z>1.30 else .20) and not(z>1.38 and ax<.085)
    if kind=='Bra':keep=keep and z>1.21
    if kind=='Tee':keep=keep and (ax<.19 or (ax-.18)*.72+(1.43-z)*.69<.18)
    if kind=='LongSleeve':keep=(.99<z<1.47 and ax<.32) or (ax>=.20 and .76<z<1.46)
   if keep:result.append((g,f))
  return result
 for kind in ['Shorts','Leggings','Singlet','Bra','Tee','LongSleeve']:
  ob,indices=mesh(kind,pos,uv,choose(kind),mats['kit'],.006);objects.append(ob)
  ob.shape_key_add(name='Basis')
  for build in ['lean','strong']:
   BUILD=build;new=transform(shape(pres,build),low);BUILD='athletic';key=ob.shape_key_add(name=build)
   for j,i in enumerate(indices):key.data[j].co=ob.data.vertices[j].co+Vector(new[i]-pos[i])
 for name,path,mat in [('Hair','hair/'+('ponytail01/ponytail01' if pres=='feminine' else 'short02/short02'),'hair'),('Eyes','eyes/low-poly/low-poly','eyes'),('Shoes','clothes/shoes04/shoes04','shoes')]:
  p,u,fs=proxy(path,points);ob,_=mesh(name,transform(p,low),u,fs,mats[mat]);objects.append(ob)
 BODY_OBJECT=body
 for o in objects:
  if o.name in ['Body','Shorts','Leggings','Singlet','Bra','Tee','LongSleeve']:refine_surface(o,1 if o.name=='Body' else 2,body=o.name=='Body')
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 # Store geometry and named material slots only; shared texture assets load once on the web.
 for m in mats.values():
  for n in list(m.node_tree.nodes):
   if n.type=='TEX_IMAGE':n.mute=True
 bpy.ops.export_scene.gltf(filepath=OUT+'/'+pres+'.glb',export_format='GLB',use_selection=True,export_image_format='NONE',export_materials='EXPORT',export_morph=True,export_morph_normal=False)
 for m in mats.values():
  for n in m.node_tree.nodes:
   if n.type=='TEX_IMAGE':n.mute=False
 for outfit in outfits:
  visible={'Body','Hair','Eyes','Shoes', 'Leggings' if outfit in ['long-sleeve','wetsuit'] else 'Shorts'}
  if outfit!='shirtless':visible.add({'singlet':'Singlet','sports-bra':'Bra','tee':'Tee','long-sleeve':'LongSleeve','tri-suit':'Singlet','wetsuit':'LongSleeve'}[outfit])
  for o in objects:o.hide_render=o.name.split('.')[0] not in visible
  scene.render.filepath=OUT+'/'+pres+'-'+outfit+'.png';bpy.ops.render.render(write_still=True)
 for o in objects:bpy.data.objects.remove(o,do_unlink=True)
 print('FINISHED',pres,flush=True)
