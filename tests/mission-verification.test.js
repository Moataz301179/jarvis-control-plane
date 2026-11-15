import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMission,digest,agentText,parseStructuredReview} from '../lib/mission-verification.js';
const artifact={id:'a',runtime:'hermes',text:'Subject: Supplier introduction\nHello, please share your catalogue.'};
function run(review={}) {return {plan:{acceptanceCriteria:['Contains email']},jobs:[{...artifact,result:artifact.text},{id:'b',runtime:'claude',phase:'review',result:{output:JSON.stringify({result:JSON.stringify({artifact_digest:digest([artifact]),verdict:'pass',checks:[{index:0,passed:true,evidence:'The work product contains a subject and email body.'}],...review})})}}]};}
test('independent review validates exact preparation artifact',()=>assert.equal(verifyMission(run()).verified,true));
test('model digest is recorded but deterministic artifact verification remains authoritative',()=>{const result=verifyMission(run({artifact_digest:'old'}));assert.equal(result.verified,true);assert.equal(result.digest_mismatch,true);assert.equal(result.digest_owner,'jarvis-deterministic-verifier');});
test('missing criterion evidence fails',()=>assert.equal(verifyMission(run({checks:[]})).verified,false));
test('negative reviewer verdict blocks completion',()=>assert.equal(verifyMission(run({verdict:'fail'})).verified,false));
test('self review fails',()=>{const r=run();r.jobs[1].runtime='hermes';assert.equal(verifyMission(r).verified,false)});
test('Codex event stream extracts work product without usage metadata',()=>assert.equal(agentText({output:'{"type":"item.completed","item":{"type":"agent_message","text":"draft"}}'}),'draft'));

test('review extraction accepts a fenced JSON block surrounded by explanatory prose',()=>{
  const review={artifact_digest:'abc',verdict:'pass',checks:[{index:0,passed:true,evidence:'This evidence is long enough.'}]};
  const output=`Verification is complete.\n\n\`\`\`json\n${JSON.stringify(review)}\n\`\`\`\n\nVerdict: PASS`;
  assert.deepEqual(parseStructuredReview({output}), review);
});
