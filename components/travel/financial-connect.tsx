"use client";

import {useState} from 'react';
import {CreditCard,LockKeyhole,RefreshCw,ShieldCheck} from 'lucide-react';
import type {SpendingEstimate} from '@/lib/finance';

declare global{interface Window{Plaid?:{create:(config:{token:string;onSuccess:(publicToken:string)=>void;onExit:()=>void})=>{open:()=>void;destroy:()=>void}}}}
let plaidScript:Promise<void>|null=null;
function loadPlaid(){
 if(window.Plaid)return Promise.resolve();
 if(!plaidScript)plaidScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error('Plaid could not load.'));document.head.appendChild(script)});
 return plaidScript;
}

export default function FinancialConnect({days,budget,onUseBudget}:{days:number;budget:number;onUseBudget:(value:number)=>void}){
 const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[estimate,setEstimate]=useState<SpendingEstimate|null>(null),[message,setMessage]=useState('');
 const connect=async()=>{
   setState('loading');setMessage('');
   try{
     const response=await fetch('/api/finance/link-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientUserId:crypto.randomUUID()})});
     const data=await response.json() as {link_token?:string;error?:string};if(!response.ok||!data.link_token)throw new Error(data.error||'Card connection is unavailable.');
     await loadPlaid();if(!window.Plaid)throw new Error('Plaid could not start.');
     const handler=window.Plaid.create({token:data.link_token,onExit:()=>setState(current=>current==='ready'?'ready':'idle'),onSuccess:async publicToken=>{
       try{const result=await fetch('/api/finance/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({publicToken,days,budget})});const payload=await result.json() as {estimate?:SpendingEstimate;error?:string};if(!result.ok||!payload.estimate)throw new Error(payload.error||'The estimate could not be calculated.');setEstimate(payload.estimate);setState('ready')}catch(error){setMessage(error instanceof Error?error.message:'The estimate could not be calculated.');setState('error')}finally{handler.destroy()}
     }});handler.open();
   }catch(error){setMessage(error instanceof Error?error.message:'Card connection is unavailable.');setState('error')}
 };
 return <section className={`finance-connect ${state}`} aria-label="Optional travel spending estimate"><header><span><CreditCard size={17}/></span><div><strong>Set a comfortable travel spend</strong><p>Connect a card securely to estimate from recent spending and available credit.</p></div></header>{estimate?<div className="finance-result"><span>Suggested trip spend</span><strong>{estimate.currency} {estimate.recommendedTripSpend.toLocaleString()}</strong><p>{estimate.basis}</p><button type="button" onClick={()=>onUseBudget(Math.max(50,estimate.recommendedTripSpend))}>Use this estimate</button><small><ShieldCheck size={12}/>{estimate.disclaimer}</small></div>:<button type="button" className="finance-button" onClick={connect} disabled={state==='loading'}>{state==='loading'?<RefreshCw className="spin" size={15}/>:<LockKeyhole size={15}/>} {state==='loading'?'Opening secure connection…':'Connect a credit card'}</button>}{message&&<p className="finance-error" role="alert">{message}</p>}<small className="finance-privacy">Roam receives a summary only. Card numbers and raw transactions are not sent to the travel agent.</small></section>;
}

