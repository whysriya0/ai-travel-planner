"use client";
import {useEffect,useRef,useState} from 'react';
import {Compass,Plus,Minus,RotateCcw,Maximize,Minimize,Layers,Footprints,Coffee,BedDouble,Leaf,TrainFront,Sun} from 'lucide-react';
import type {Destination} from '@/lib/travel/destinations';
import type {JourneyDay} from '@/lib/travel/sample-journey';
interface Props {destination:Destination;day:JourneyDay; selected:number; progress:number; playing:boolean; onSelect:(i:number)=>void; immersive:boolean; setImmersive:(b:boolean)=>void; reducedMotion:boolean}
export function travelPoint(day:JourneyDay,progress:number){
 const stops=day.stops??[];
 if(!stops.length)return {x:50,y:50,moving:false,index:0};
 if(stops.length===1)return {x:stops[0].x,y:stops[0].y,moving:false,index:0};
 const n=stops.length-1;
 const safeProgress=Number.isFinite(progress)?Math.max(0,Math.min(100,progress)):0;
 const raw=safeProgress/100*n;
 const idx=Math.max(0,Math.min(n,Math.floor(raw)));
 const a=stops[idx]??stops[0],b=stops[Math.min(idx+1,n)]??a;
 const t=Math.max(0,Math.min(1,(raw-idx-.23)/.77));
 const mid=(a.x+b.x)/2;const u=1-t;
 return {x:u*u*u*a.x+3*u*u*t*mid+3*u*t*t*mid+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*b.y,moving:t>0&&idx<n,index:idx};
}
export default function StoryMap({destination,day,selected,progress,playing,onSelect,immersive,setImmersive,reducedMotion}:Props){
 const [zoom,setZoom]=useState(1),[flat,setFlat]=useState(false),[pan,setPan]=useState({x:0,y:0}),[dragging,setDragging]=useState(false);
 const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
 const point=travelPoint(day,progress);const safeSelected=Number.isFinite(selected)?Math.max(0,Math.min(selected,day.stops.length-1)):0;const stop=day.stops[safeSelected]??day.stops[0];const path=day.stops.map((s,i)=>i===0?`M${s.x*10},${s.y*10}`:`C${(day.stops[i-1].x+s.x)*5},${day.stops[i-1].y*10} ${(day.stops[i-1].x+s.x)*5},${s.y*10} ${s.x*10},${s.y*10}`).join(' ');
 useEffect(()=>{setPan({x:0,y:0});setZoom(1)},[day.id]);
 const shift=playing&&!reducedMotion?{x:(50-point.x)*.07,y:(50-point.y)*.05}:{x:0,y:0};
 const reset=()=>{setPan({x:0,y:0});setZoom(1);setFlat(false)};
 const ModeIcon=point.moving?(day.id===2&&point.index===3?TrainFront:Footprints):(stop.kind==='rest'?Coffee:stop.kind==='stay'?BedDouble:Compass);
 return <div className={`map-stage ${flat?'flat':'diorama'} ${dragging?'dragging':''}`} aria-label="Interactive illustrated travel story map" tabIndex={0} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setPan(p=>({x:Math.max(-14,Math.min(14,p.x+(e.key==='ArrowLeft'?3:e.key==='ArrowRight'?-3:0))),y:Math.max(-12,Math.min(12,p.y+(e.key==='ArrowUp'?3:e.key==='ArrowDown'?-3:0)))}))}}}>
  <div className="map-world" style={{transform:`perspective(1500px) translate(${pan.x+shift.x}%,${pan.y+shift.y}%) scale(${zoom*(flat?1:1.075)}) rotateX(${flat||reducedMotion?0:7}deg) rotateZ(${flat?0:-1}deg)`}} onPointerDown={e=>{if(e.pointerType==='touch'||(e.target as HTMLElement).closest('button'))return;drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true)}} onPointerMove={e=>{if(!drag.current)return;setPan({x:Math.max(-14,Math.min(14,drag.current.px+(e.clientX-drag.current.x)/25)),y:Math.max(-12,Math.min(12,drag.current.py+(e.clientY-drag.current.y)/25))})}} onPointerUp={()=>{drag.current=null;setDragging(false)}} onPointerCancel={()=>{drag.current=null;setDragging(false)}}>
   <img className="scene-image" src={destination.image} alt={`Artistic ${destination.name} landscape with miniature scenery and animated itinerary routes`} draggable={false}/>
   <svg className="route-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><path d={path} className="route-underlay"/><path d={path} className="route-track"/><path d={path} className={`route-flow ${playing?'moving':''}`}/></svg>
   {day.stops.map((s,i)=>{const Icon=s.kind==='rest'?Coffee:s.kind==='stay'?BedDouble:undefined;return <button key={s.id} onClick={()=>onSelect(i)} className={`map-pin ${i===safeSelected?'active':''} ${s.kind}`} style={{left:s.x+'%',top:s.y+'%'}} aria-label={`View stop ${i+1}: ${s.name}`} aria-pressed={safeSelected===i}>{Icon?<Icon size={16}/>:i+1}<span>{s.shortName}</span></button>})}
   {playing&&<div className={`traveler ${point.moving?'walking':'resting'}`} style={{left:point.x+'%',top:point.y+'%'}} aria-hidden="true"><ModeIcon size={17}/></div>}
  </div>
  <div className="map-vignette"/>
  <div className="map-title">{destination.name.toUpperCase()}<span>{destination.country.toUpperCase()} · YOUR NEXT GREAT STORY</span></div>
  <div className="map-toolbar"><button className="view-mode" onClick={()=>setFlat(!flat)} aria-pressed={!flat}><Layers size={15}/>{flat?'Flat view':'Diorama view'}</button><button className="square-button" aria-label={immersive?'Exit immersive view':'Enter immersive view'} onClick={()=>setImmersive(!immersive)}>{immersive?<Minimize size={17}/>:<Maximize size={17}/>}</button></div>
  <div className="map-compass" aria-hidden="true"><span>N</span><Compass size={29}/></div>
  <div className="map-zoom"><button aria-label="Zoom in" disabled={zoom>=1.55} onClick={()=>setZoom(z=>Math.min(1.55,z+.15))}><Plus size={17}/></button><button aria-label="Zoom out" disabled={zoom<=.9} onClick={()=>setZoom(z=>Math.max(.9,z-.15))}><Minus size={17}/></button><button aria-label="Reset map view" onClick={reset}><RotateCcw size={15}/></button></div>
  <div className="map-legend"><span><i/>Explore</span><span><Coffee size={12}/>Rest</span><span><BedDouble size={12}/>Stay</span></div>
  <div className="map-fineprint">Illustrated map · not to scale</div>
  <div className="scene-mood"><Sun size={14}/>{playing&&point.moving?'On the way · '+day.stops[Math.min(point.index+1,day.stops.length-1)].travelMinutes+' min':'A little room to wander'}</div>
 </div>
}


