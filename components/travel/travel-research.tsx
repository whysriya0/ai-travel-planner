"use client";

import {ExternalLink,Hotel,MessageCircle,Plane,Star} from 'lucide-react';
import type {RedditSuggestion} from '@/lib/reddit';
import type {FlightOption,HotelOption} from '@/lib/searchapi';

export type TravelResearchData={reddit:RedditSuggestion[];flights:FlightOption[];hotels:HotelOption[];notices:string[]};
export default function TravelResearch({data,loading}:{data:TravelResearchData|null;loading:boolean}){
 if(!loading&&!data)return null;
 return <section className="travel-research" aria-label="Community, flight and hotel suggestions"><header><span>THE PRACTICAL LAYER</span><h3>Real voices. Real options.</h3><p>Community tips are kept separate from live prices so you can judge each source clearly.</p></header>{loading&&<div className="research-loading"><i/><span>Checking Reddit, hotels and flights…</span></div>}{data&&<>
   {data.hotels.length>0&&<div className="research-group"><h4><Hotel size={15}/>Hotels ranked for value</h4><div className="research-cards">{data.hotels.slice(0,4).map(hotel=><article key={hotel.name}>{hotel.image&&<img src={hotel.image} alt=""/>}<div><strong>{hotel.name}</strong><p>{hotel.rating&&<span><Star size={11} fill="currentColor"/> {hotel.rating.toFixed(1)}{hotel.reviews?` · ${hotel.reviews.toLocaleString()} reviews`:''}</span>}</p><footer><b>{hotel.currency} {hotel.pricePerNight.toLocaleString()}<small>/night</small></b>{hotel.link&&<a href={hotel.link} target="_blank" rel="noopener noreferrer" aria-label={`View ${hotel.name}`}><ExternalLink size={14}/></a>}</footer></div></article>)}</div></div>}
   {data.flights.length>0&&<div className="research-group"><h4><Plane size={15}/>Flight options</h4><div className="flight-list">{data.flights.slice(0,4).map((flight,index)=><article key={`${flight.airline}-${index}`}><div><strong>{flight.departure} → {flight.arrival}</strong><span>{flight.airline} · {flight.stops?`${flight.stops} stop${flight.stops>1?'s':''}`:'Nonstop'}</span></div><b>{flight.currency} {flight.price.toLocaleString()}</b></article>)}</div></div>}
   {data.reddit.length>0&&<div className="research-group"><h4><MessageCircle size={15}/>What travelers are saying</h4><div className="reddit-list">{data.reddit.slice(0,5).map(post=><a key={post.url} href={post.url} target="_blank" rel="noopener noreferrer"><span>r/{post.subreddit} · {post.score.toLocaleString()} points · {post.comments.toLocaleString()} comments</span><strong>{post.title}</strong>{post.excerpt&&<p>{post.excerpt}</p>}</a>)}</div></div>}
   {data.notices.length>0&&<details><summary>Unavailable sources ({data.notices.length})</summary>{data.notices.map((notice,index)=><p key={index}>{notice}</p>)}</details>}
 </>}</section>;
}

