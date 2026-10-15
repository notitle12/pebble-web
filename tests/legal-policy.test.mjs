import test from 'node:test';
import assert from 'node:assert/strict';
import {getLegalPolicyConfig,legalVersions} from '../src/features/legal/policy.ts';
test('정식 공개 선언과 실제 운영자·문의·처리 정보가 모두 있어야 동의를 받는다',()=>{
 assert.equal(getLegalPolicyConfig({}).ready,false);
 const env={PEBBLE_LEGAL_PUBLISHED:'true',PEBBLE_LEGAL_OPERATOR:'테스트 운영자',PEBBLE_LEGAL_PRIVACY_OFFICER:'테스트 담당자',PEBBLE_LEGAL_CONTACT_EMAIL:'privacy@example.test',PEBBLE_LEGAL_PROCESSING_DETAILS:'테스트 인프라 처리 내역',PEBBLE_LEGAL_RETENTION_DETAILS:'테스트 보관 주기'};
 assert.equal(getLegalPolicyConfig(env).ready,true);
 for(const key of ['PEBBLE_LEGAL_PUBLISHED','PEBBLE_LEGAL_CONTACT_EMAIL','PEBBLE_LEGAL_PROCESSING_DETAILS','PEBBLE_LEGAL_RETENTION_DETAILS'])assert.equal(getLegalPolicyConfig({...env,[key]:''}).ready,false,key);
 const team=getLegalPolicyConfig({...env,PEBBLE_LEGAL_OPERATOR:'',PEBBLE_LEGAL_PRIVACY_OFFICER:''});
 assert.equal(team.operator,'Pebble 운영팀 (개인 운영)');
 assert.equal(team.officer,team.operator);
 assert.equal(team.ready,true);
 assert.equal(getLegalPolicyConfig({...env,PEBBLE_LEGAL_CONTACT_EMAIL:'invalid'}).ready,false);
 assert.deepEqual(legalVersions,{termsVersion:'2026-10-15',privacyVersion:'2026-10-15'});
});

test('테스트 모드는 초안 동의 화면을 열지만 정식 공개를 대신하지 않는다',()=>{
 const draft={PEBBLE_LEGAL_PUBLISHED:'false',PEBBLE_LEGAL_TEST_MODE:'true',PEBBLE_LEGAL_OPERATOR:'테스트 운영자',PEBBLE_LEGAL_CONTACT_EMAIL:'privacy@example.test'};
 const config=getLegalPolicyConfig(draft);
 assert.equal(config.ready,true);assert.equal(config.testMode,true);assert.equal(config.processing,'');assert.equal(config.retention,'');
 assert.equal(getLegalPolicyConfig({...draft,PEBBLE_LEGAL_CONTACT_EMAIL:'invalid'}).ready,false);
 assert.equal(getLegalPolicyConfig({...draft,PEBBLE_LEGAL_TEST_MODE:'false'}).ready,false);
});
