import {z} from 'zod';
import {fetchJson,TravelError} from './http';

export type SpendingEstimate={recommendedTripSpend:number;averageDailyDiscretionarySpend:number;availableCredit?:number;currency:string;basis:string;disclaimer:string};
const plaidBase=()=>process.env.PLAID_ENV==='production'?'https://production.plaid.com':process.env.PLAID_ENV==='development'?'https://development.plaid.com':'https://sandbox.plaid.com';
async function plaid(path:string,body:Record<string,unknown>){
 const client_id=process.env.PLAID_CLIENT_ID,secret=process.env.PLAID_SECRET;if(!client_id||!secret)throw new TravelError('Card connection is not configured.',503);
 return fetchJson<unknown>(plaidBase()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,client_id,secret})},20000);
}
export async function createPlaidLinkToken(clientUserId:string){
 const payload=await plaid('/link/token/create',{user:{client_user_id:clientUserId},client_name:'Roam travel planner',products:['transactions'],additional_consented_products:['liabilities'],country_codes:['US'],language:'en',transactions:{days_requested:90}});
 return z.object({link_token:z.string(),expiration:z.string()}).parse(payload);
}
export async function estimateFromPlaid(publicToken:string,days:number,budget:number):Promise<SpendingEstimate>{
 const exchange=z.object({access_token:z.string()}).parse(await plaid('/item/public_token/exchange',{public_token:publicToken}));
 const end=new Date(),start=new Date(end);start.setUTCDate(start.getUTCDate()-90);
 const [transactionsResult,liabilitiesResult]=await Promise.allSettled([
   plaid('/transactions/get',{access_token:exchange.access_token,start_date:start.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10),options:{count:500}}),
   plaid('/liabilities/get',{access_token:exchange.access_token})
 ]);
 const transaction=z.object({amount:z.number(),date:z.string(),category:z.array(z.string()).optional(),personal_finance_category:z.object({primary:z.string().optional()}).optional(),pending:z.boolean().default(false)});
 const transactions=transactionsResult.status==='fulfilled'?z.object({transactions:z.array(transaction).default([])}).parse(transactionsResult.value).transactions:[];
 const excluded=/RENT|MORTGAGE|LOAN|TRANSFER|UTILIT|INSURANCE|CREDIT_CARD_PAYMENT|PAYROLL/i;
 const discretionary=transactions.filter(item=>!item.pending&&item.amount>0&&!excluded.test([item.personal_finance_category?.primary,...(item.category||[])].join(' ')));
 const averageDaily=Math.round(discretionary.reduce((sum,item)=>sum+item.amount,0)/90*100)/100;
 let availableCredit:number|undefined;
 if(liabilitiesResult.status==='fulfilled'){
   const account=z.object({type:z.string(),balances:z.object({available:z.number().nullable().optional(),limit:z.number().nullable().optional(),current:z.number().nullable().optional()})});
   const accounts=z.object({accounts:z.array(account).default([])}).parse(liabilitiesResult.value).accounts.filter(item=>item.type==='credit');
   const value=accounts.reduce((sum,item)=>sum+(item.balances.available??Math.max(0,(item.balances.limit||0)-(item.balances.current||0))),0);if(value>0)availableCredit=Math.round(value*100)/100;
 }
 const spendSignal=Math.max(100,averageDaily*Math.max(1,days)*1.15);const creditCap=availableCredit?availableCredit*.2:Number.POSITIVE_INFINITY;
 return {recommendedTripSpend:Math.round(Math.min(budget,spendSignal,creditCap)),averageDailyDiscretionarySpend:averageDaily,availableCredit,currency:'USD',basis:'Last 90 days of consented discretionary transactions'+(availableCredit?' and current available credit.':'.'),disclaimer:'Planning estimate only. Roam does not retrieve or infer your credit score and this is not financial advice.'};
}

