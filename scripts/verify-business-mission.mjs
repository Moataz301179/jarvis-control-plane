import {config} from '../lib/config.js';
const key='business-preparation-verification-20261113-v3';
async function api(path,body) {
 const r=await fetch(`http://127.0.0.1:3100${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${config.ownerToken}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const value=await r.json(); if(!r.ok) throw new Error(`${r.status}: ${JSON.stringify(value)}`);return value;
}
if(process.argv.includes('--start')) {
 const input={request_key:key,projectCode:'STUDIO',outcome:'Prepare a supplier introduction email draft and a supplier qualification checklist for HotelsVendors, a B2B hotel procurement platform. Use only these supplied facts. The email invites a supplier to share its catalogue and availability. Work product only; no external actions.',acceptanceCriteria:['Email draft contains a subject and a body inviting catalogue and availability information','Qualification checklist has at least four relevant items','No invented suppliers, contacts, prices or claims of delivery']};
 const first=await api('/v1/missions/dispatch',input),second=await api('/v1/missions/dispatch',input);
 if(first.id!==second.id) throw new Error('Duplicate mission created');
 console.log(JSON.stringify({id:first.id,deduplication:'passed'}));
}
const run=await api(`/v1/missions/status?request_key=${key}`);
if(run?.jobs?.length) {
 const job=run.jobs.at(-1);
 const state=await api(job.runtime==='hermes'?'/v1/hermes/state':'/v1/agents-projects/state');
 const actual=(job.runtime==='hermes'?state.jobs:state.macBridge.jobs).find(j=>j.id===job.id);
 if(actual?.status==='awaiting_approval' && process.argv.includes('--approve-preparation')) await api(`/v1/approvals/${job.runtime==='hermes'?'hermes_job':'mac_job'}/${job.id}/decision`,{decision:'yes',note:'Authorized supplier draft preparation and independent review acceptance test; no external actions'});
 console.log(JSON.stringify({mission:run.id,status:run.status,step:run.step,agent:job.runtime,agentStatus:actual?.status,error:run.error,report:run.report||null}));
} else console.log(JSON.stringify(run));
