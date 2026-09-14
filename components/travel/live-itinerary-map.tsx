"use client";

import {useMemo,useState,type CSSProperties} from 'react';
import {MapPin,Minus,Navigation,Plus,RotateCcw,Star} from 'lucide-react';
import type {Itinerary,ItineraryStop} from '@/lib/types';

const WIDTH=1000,HEIGHT=560,PADDING=86;
const dayColors=['#315d43','#b47b3d','#5d718a','#875e78','#6b7848','#9b654f'];

type PlotPoint={stop:ItineraryStop;x:number;y:number;number:number};

export default function LiveItineraryMap({itinerary}:{itinerary:Itinerary}){
 const [activeDay,setActiveDay]=useState(0),[selectedId,setSelectedId]=useState(itinerary.stops[0]?.id||''),[zoom,setZoom]=useState(1);
 const visible=useMemo(()=>itinerary.stops.filter(stop=>!activeDay||stop.day===activeDay),[itinerary.stops,activeDay]);
 const points=useMemo<PlotPoint[]>(()=>{
   if(!visible.length)return [];
   const lats=visible.map(stop=>stop.lat),lngs=visible.map(stop=>stop.lng);
   const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
   const latSpan=Math.max(maxLat-minLat,.004),lngSpan=Math.max(maxLng-minLng,.004);
   return visible.map(stop=>({
     stop,
     x:PADDING+((stop.lng-minLng)/lngSpan)*(WIDTH-PADDING*2),
     y:PADDING+((maxLat-stop.lat)/latSpan)*(HEIGHT-PADDING*2),
     number:itinerary.stops.filter(item=>item.day===stop.day).findIndex(item=>item.id===stop.id)+1
   }));
 },[visible,itinerary.stops]);
 const paths=useMemo(()=>Array.from({length:itinerary.days},(_,index)=>index+1).filter(day=>!activeDay||day===activeDay).map(day=>{
   const dayPoints=points.filter(point=>point.stop.day===day);
   return {day,d:dayPoints.map((point,index)=>`${index?'L':'M'} ${point.x} ${point.y}`).join(' ')};
 }).filter(path=>path.d),[points,itinerary.days,activeDay]);
 const selected=visible.find(stop=>stop.id===selectedId)||visible[0];
 const chooseDay=(day:number)=>{setActiveDay(day);setSelectedId((day?itinerary.stops.find(stop=>stop.day===day):itinerary.stops[0])?.id||'');setZoom(1)};
 return <section className="live-route-map" aria-label={`Interactive route map for ${itinerary.destination}`}>
   <header className="live-map-heading"><div><span>YOUR ROUTE, BROUGHT TO LIFE</span><h3>{itinerary.destination}</h3><p>Every pin is a verified place. Select a day or activity to explore the journey.</p></div><div className="live-map-stat"><Navigation size={15}/><strong>{itinerary.stops.length}</strong><span>story stops</span></div></header>
   <nav className="live-map-days" aria-label="Filter route by day"><button className={!activeDay?'active':''} onClick={()=>chooseDay(0)}>All days</button>{Array.from({length:itinerary.days},(_,index)=>index+1).map(day=><button key={day} className={activeDay===day?'active':''} onClick={()=>chooseDay(day)} style={{'--day-color':dayColors[(day-1)%dayColors.length]} as CSSProperties}>Day {day}</button>)}</nav>
   <div className="live-map-canvas">
     <div className="live-map-grid" aria-hidden="true"/>
     <div className="live-map-world" style={{'--map-zoom':zoom} as CSSProperties}>
       <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Route connecting ${visible.length} activities`}>
         <defs><filter id="routeGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
         {paths.map(path=><g key={path.day}><path className="live-route-shadow" d={path.d}/><path className="live-route-line" d={path.d} style={{'--route-color':dayColors[(path.day-1)%dayColors.length]} as CSSProperties}/></g>)}
       </svg>
       {points.map(point=><button key={point.stop.id} className={`live-map-pin ${selected?.id===point.stop.id?'selected':''}`} style={{left:`${point.x/WIDTH*100}%`,top:`${point.y/HEIGHT*100}%`,'--pin-color':dayColors[(point.stop.day-1)%dayColors.length]} as CSSProperties} onClick={()=>setSelectedId(point.stop.id)} aria-label={`Day ${point.stop.day}, stop ${point.number}: ${point.stop.name}`}><span>{point.number}</span><small>{point.stop.name}</small></button>)}
     </div>
     <div className="live-map-controls" aria-label="Map zoom controls"><button onClick={()=>setZoom(value=>Math.min(1.55,value+.15))} disabled={zoom>=1.55} aria-label="Zoom in"><Plus size={16}/></button><button onClick={()=>setZoom(value=>Math.max(1,value-.15))} disabled={zoom<=1} aria-label="Zoom out"><Minus size={16}/></button><button onClick={()=>setZoom(1)} aria-label="Reset map"><RotateCcw size={14}/></button></div>
     <div className="live-map-legend">{Array.from({length:itinerary.days},(_,index)=>index+1).map(day=><span key={day}><i style={{background:dayColors[(day-1)%dayColors.length]}}/>Day {day}</span>)}</div>
     {selected&&<article className="live-map-detail"><div className="live-map-detail-pin"><MapPin size={18}/><span>D{selected.day}</span></div><div><small>{selected.category} · Day {selected.day}</small><strong>{selected.name}</strong><p>{selected.reason}</p><footer>{selected.rating&&<span><Star size={12} fill="currentColor"/>{selected.rating.toFixed(1)}</span>}<span>≈ ${selected.estimatedCost} / person</span><a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.name)}&query_place_id=${encodeURIComponent(selected.placeId)}`}>Open in Maps</a></footer></div></article>}
   </div>
   <p className="live-map-note">Geographic route view fitted to the returned coordinates. Driving lines are summarized in the itinerary below.</p>
 </section>;
}

