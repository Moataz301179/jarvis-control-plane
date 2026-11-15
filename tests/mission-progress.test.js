import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMissionState } from '../lib/mission-progress.js';
const run = {step:1,plan:{delegations:[{},{}]}};
test('review cannot start while implementation is running',()=>assert.equal(nextMissionState(run,{status:'claimed'}).status,'waiting'));
test('failed implementation blocks downstream review',()=>assert.equal(nextMissionState(run,{status:'failed'}).status,'blocked'));
test('missing job cannot be redispatched automatically',()=>assert.equal(nextMissionState(run,null).status,'blocked'));
test('successful implementation releases review',()=>assert.equal(nextMissionState(run,{status:'succeeded'}).status,'ready'));
test('agent success cannot assert verified mission completion',()=>assert.equal(nextMissionState({...run,step:2},{status:'succeeded'}).status,'awaiting_verification'));
