import {z} from 'zod';
import {fetchJson,TravelError} from './http';

export type RedditSuggestion={title:string;excerpt:string;subreddit:string;score:number;comments:number;url:string};
let cachedToken:{value:string;expiresAt:number}|null=null;

async function redditToken(){
 const clientId=process.env.REDDIT_CLIENT_ID,secret=process.env.REDDIT_CLIENT_SECRET;
 if(!clientId||!secret)throw new TravelError('Reddit recommendations are not configured.',503);
 if(cachedToken&&cachedToken.expiresAt>Date.now()+30000)return cachedToken.value;
 const payload=await fetchJson<unknown>('https://www.reddit.com/api/v1/access_token',{method:'POST',headers:{Authorization:`Basic ${btoa(`${clientId}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded','User-Agent':process.env.REDDIT_USER_AGENT||'roam-travel-planner/1.0'},body:'grant_type=client_credentials'},10000);
 const parsed=z.object({access_token:z.string().min(1),expires_in:z.number().positive().default(3600)}).parse(payload);
 cachedToken={value:parsed.access_token,expiresAt:Date.now()+parsed.expires_in*1000};return parsed.access_token;
}

export async function searchRedditTravel(destination:string,interests=''):Promise<RedditSuggestion[]>{
 const token=await redditToken();
 const query=[destination,interests,'travel recommendations'].filter(Boolean).join(' ');
 const url=new URL('https://oauth.reddit.com/search');
 Object.entries({q:query,sort:'relevance',t:'year',limit:'12',type:'link',raw_json:'1'}).forEach(([key,value])=>url.searchParams.set(key,value));
 const payload=await fetchJson<unknown>(url,{headers:{Authorization:`Bearer ${token}`,'User-Agent':process.env.REDDIT_USER_AGENT||'roam-travel-planner/1.0'}},12000);
 const post=z.object({title:z.string(),selftext:z.string().default(''),subreddit:z.string(),score:z.number().default(0),num_comments:z.number().default(0),permalink:z.string()});
 const parsed=z.object({data:z.object({children:z.array(z.object({data:post}))})}).parse(payload);
 return parsed.data.children.map(({data})=>({title:data.title,excerpt:data.selftext.replace(/\s+/g,' ').slice(0,240),subreddit:data.subreddit,score:data.score,comments:data.num_comments,url:`https://www.reddit.com${data.permalink}`})).filter(item=>item.score>=2).sort((a,b)=>(b.score+b.comments*2)-(a.score+a.comments*2)).slice(0,6);
}

