import {journey as kyoto,type JourneyDay,type ItineraryStop} from './sample-journey';
export interface Destination {id:string;name:string;country:string;label:string;image:string;subtitle:string;days:JourneyDay[];color:string}
type Seed=[string,string,string,string,number,number,number,'explore'|'rest'|'stay',string];
function makeDay(id:number,title:string,subtitle:string,seeds:Seed[]):JourneyDay{return {id,title,subtitle,mood:'A thoughtful balance of discovery and downtime',stops:seeds.map((s,i)=>({id:`${id}-${i}-${s[0]}`,name:s[0],shortName:s[1],time:s[2],story:s[3],estimatedCost:s[4],x:s[5],y:s[6],kind:s[7],category:s[8],duration:i===4?'Overnight':s[7]==='rest'?'60 min':'90 min',reason:s[7]==='rest'?'A deliberate pause between activities. Venue and travel details are illustrative until live search is connected.':s[7]==='stay'?'A sample lodging allowance, not a reservation.':'A curated sample stop with time to explore. Final opening hours, routes and availability still need live verification.',lat:0,lng:0,travelMinutes:i===0?0:15+i*5}))}}
const bali=[makeDay(1,'The island sets the pace','Rice terraces & Ubud discoveries',[
 ['Tegallalang rice terraces','Rice terraces','08:30','The morning spills across a thousand shades of green. Take the narrow path, and let the island set your pace.',12,25,27,'explore','Nature'],
 ['A wander through Ubud','Ubud lanes','11:00','Handmade things, open doorways, little offerings. Look closer. Every lane has a story.',15,42,55,'explore','Culture'],
 ['A slow Balinese lunch','Lunch pause','13:00','Fresh flavors, a cool drink, and a table in the shade. Some of the best travel happens sitting down.',18,60,56,'rest','Food'],
 ['An evening temple visit','Temple gardens','16:00','Stone guardians and frangipani blossoms. Keep your steps gentle and your curiosity open.',8,38,38,'explore','Culture'],
 ['Your Ubud hideaway','Your villa','19:00','A warm evening. The sound of the garden. Let the day settle around you.',70,28,76,'stay','Accommodation']]),
 makeDay(2,'A little salt in the air','Coastal paths & golden light',[
 ['Morning on the coast','Coastal walk','09:00','Bare feet. A wide horizon. Begin with a walk that has nowhere particular to end.',0,72,68,'explore','Nature'],
 ['A neighborhood café','Coffee break','11:00','Coffee arrives slowly here. That might be the point.',9,53,70,'rest','Food'],
 ['Lunch near the ocean','Seaside lunch','13:00','Find the shady seat. Order something local. Stay for another story.',22,64,53,'rest','Food'],
 ['Watch the sky change','Sunset beach','17:00','The sky moves from gold to rose. Put the phone away for a moment. Keep this one for yourself.',0,80,47,'explore','Nature'],
 ['A night by the sea','Coastal stay','20:00','The waves will keep time tonight. You can stop.',90,41,79,'stay','Accommodation']]),
 makeDay(3,'Take a little Bali home','Craft, color & a final pause',[
 ['Ubud art market','Art market','09:00','Look for the thing with a story. Ask who made it. Take your time.',25,41,59,'explore','Culture'],
 ['A garden and a good book','Garden pause','11:30','One last hour with nothing to check off. Let the breeze choose the page.',8,26,41,'rest','Nature'],
 ['A farewell Balinese lunch','Last little feast','13:00','Order your new favorite. It already tastes a little like a memory.',20,59,58,'rest','Food'],
 ['One more green view','Terrace outlook','15:00','Let your eyes follow the terraces. There will be busy days again. Remember this one.',5,29,24,'explore','Nature'],
 ['The journey home','Departure','18:00','Leave room in your bag for the person you became here.',30,55,83,'rest','Transport']])];
const alps=[makeDay(1,'Somewhere above the everyday','Alpine villages & lakeside paths',[
 ['A morning in the mountains','Alpine outlook','09:00','Take a breath that feels a little bigger. The mountains have a way of making room.',0,27,29,'explore','Nature'],
 ['Wander the chalet village','Village lanes','11:00','Wooden balconies, flower boxes, and a bell in the distance. A small place, beautifully lived in.',12,32,68,'explore','Culture'],
 ['Lunch with a lake view','Lakeside lunch','13:00','A warm bowl, a cold blue lake, and no reason to hurry.',32,61,56,'rest','Food'],
 ['Along the water','Lakeside trail','15:30','The lake holds the mountains upside down. Walk a little farther. Find your own view.',0,76,49,'explore','Nature'],
 ['A cozy mountain night','Your chalet','19:00','The peaks turn pink outside the window. Inside, everything is warm.',130,27,81,'stay','Accommodation']]),
 makeDay(2,'The scenic way around','Railway windows & mountain air',[
 ['Take the scenic train','Mountain railway','09:00','A red train draws a line through the green. Let the window do the storytelling.',65,44,79,'explore','Transport'],
 ['A high meadow walk','Meadow trail','11:00','Wildflowers at your feet, snow above your head. Go at the pace of noticing.',0,36,32,'explore','Nature'],
 ['Pause at a mountain hut','Mountain lunch','13:00','Something hearty tastes even better when you have earned the view.',35,55,46,'rest','Food'],
 ['A moment by the lake','Blue hour walk','16:00','Sit on a rock, or keep walking. The afternoon belongs to you.',0,76,58,'explore','Nature'],
 ['Home to your chalet','Chalet evening','19:00','A quiet room, tired feet, a very good kind of day.',130,28,73,'stay','Accommodation']]),
 makeDay(3,'Keep the mountains with you','Village flavors & a final view',[
 ['The village wakes up','Village morning','09:00','The bakery opens. A bicycle goes by. Join the morning, just as it is.',10,28,65,'explore','Culture'],
 ['Coffee on the terrace','Terrace coffee','11:00','Cup your hands around something warm. Keep looking up.',8,49,60,'rest','Food'],
 ['One last lakeside picnic','Picnic pause','13:00','Bread, cheese, a little chocolate. The best table is a patch of grass.',22,70,48,'rest','Food'],
 ['Your favorite view, again','Alpine farewell','15:00','Go back to the place you loved most. A second look is its own kind of adventure.',0,33,28,'explore','Nature'],
 ['All aboard for home','Journey home','18:00','The mountains get smaller through the window. Somehow, they stay with you.',35,48,82,'rest','Transport']])];
export const destinations:Destination[]=[{id:'kyoto',name:'Kyoto',country:'Japan',label:'Kyoto, Japan',image:'/kyoto-diorama.webp',subtitle:'Ancient lanes. Quiet temples. A thousand little discoveries.',days:kyoto,color:'#315c45'},{id:'bali',name:'Bali',country:'Indonesia',label:'Bali, Indonesia',image:'/bali-diorama.webp',subtitle:'Jungle mornings. Ocean afternoons. Life at island pace.',days:bali,color:'#276c62'},{id:'alps',name:'Swiss Alps',country:'Switzerland',label:'Swiss Alps, Switzerland',image:'/alps-diorama.webp',subtitle:'Wide-open skies. Alpine trails. A little closer to wonder.',days:alps,color:'#3c6380'}];
export interface TripPreferences {destinationId:string;startDate:string;days:number;travelers:number;budget:number;pace:'relaxed'|'balanced';interest:'Culture'|'Nature'|'Food'}
export const defaultPreferences:TripPreferences={destinationId:'kyoto',startDate:'2027-04-12',days:3,travelers:2,budget:900,pace:'balanced',interest:'Culture'};
export function createDemoTrip(preferences:TripPreferences):JourneyDay[]{const destination=destinations.find(d=>d.id===preferences.destinationId)!;const order=[...destination.days];const first=preferences.interest==='Nature'?1:preferences.interest==='Food'?2:0;const sorted=[order[first],...order.filter((_,i)=>i!==first)].slice(0,preferences.days);return sorted.map((d,i)=>({...d,id:i+1,mood:preferences.pace==='relaxed'?'Less rushing. More room for the unexpected.':d.mood,stops:preferences.pace==='relaxed'?d.stops.filter((_,j)=>j!==1):[...d.stops]}));}

