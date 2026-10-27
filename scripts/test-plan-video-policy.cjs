'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {countPlanVideos}=require('../src/plan-video-policy.cjs');
test('basic monthly video allowance ignores earlier months',()=>{const old={video:'old'},current={video:'new'},text={video:null};assert.equal(countPlanVideos([old,current,text],[current,text],'basic'),1);assert.equal(countPlanVideos([old],[ ],'basic'),0)});
test('premium and VIP count existing videos across posts',()=>{const posts=[{video:'a'},{video:'b'},{video:null}];assert.equal(countPlanVideos(posts,[posts[1]],'premium'),2);assert.equal(countPlanVideos(posts,[posts[1]],'vip'),2)});
