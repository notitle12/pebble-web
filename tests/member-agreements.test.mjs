import test from 'node:test';
import assert from 'node:assert/strict';
import {isCurrentMemberAgreement,memberAgreementAcceptance,memberAgreementVersions,parseMemberAgreementState} from '../src/features/member/agreements-model.ts';
import {MemberApiError} from '../src/lib/member-api.ts';
const state={termsVersion:memberAgreementVersions.termsVersion,privacyVersion:memberAgreementVersions.privacyVersion,accepted:true,acceptedAt:'2026-10-22T00:00:00Z',available:true};

test('agreement state requires a valid acceptance timestamp and published documents',()=>{
 assert.deepEqual(parseMemberAgreementState({data:state}),state);
 assert.equal(isCurrentMemberAgreement(state),true);
 assert.equal(isCurrentMemberAgreement({...state,available:false}),true);
 assert.equal(parseMemberAgreementState({data:{...state,available:false}}).available,false);
 assert.throws(()=>parseMemberAgreementState({data:{...state,acceptedAt:'yesterday'}}),MemberApiError);
 assert.throws(()=>parseMemberAgreementState({data:{...state,accepted:'true'}}),MemberApiError);
});

test('acceptance request has only the explicit required version and confirmation fields',()=>{
 assert.deepEqual(Object.keys(memberAgreementAcceptance).sort(),['ageConfirmed','privacyAccepted','privacyVersion','termsAccepted','termsVersion'].sort());
 assert.deepEqual(memberAgreementAcceptance,{termsVersion:'2026-10-22',privacyVersion:'2026-10-22',termsAccepted:true,privacyAccepted:true,ageConfirmed:true});
});
