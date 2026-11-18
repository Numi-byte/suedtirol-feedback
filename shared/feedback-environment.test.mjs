import assert from 'node:assert/strict';
import {test} from 'node:test';
import {feedbackEnvironmentHeaders,parseFeedbackRuntime,feedbackRuntimeChanged} from './feedback-environment.ts';
const id='11111111-1111-4111-8111-111111111111';
test('deployment identity and physical project are bound independently of user input',()=>{
 assert.deepEqual(feedbackEnvironmentHeaders('https://testing-project.supabase.co',id),{'x-feedback-environment':id,'x-feedback-project':'testing-project'});
 assert.deepEqual(feedbackEnvironmentHeaders('https://production.supabase.co'),{});
 assert.throws(()=>feedbackEnvironmentHeaders('https://production.supabase.co',id,'testing-project'));
 assert.throws(()=>feedbackEnvironmentHeaders('https://production.supabase.co','bad-id'));
 assert.throws(()=>feedbackEnvironmentHeaders('http://localhost:5544',id));
 assert.deepEqual(feedbackEnvironmentHeaders('http://localhost:5544',id,'local-fixture'),{'x-feedback-environment':id,'x-feedback-project':'local-fixture'});
});
test('runtime parsing and campaign changes fail closed, including a version-only change',()=>{
 const r={environment_id:id,kind:'testing',label:'Test',project_ref:'testing-project',campaign_id:id,dataset_version_id:id,form_version_id:id,campaign_name:'Pilot',accepting_submissions:true};
 assert.deepEqual(parseFeedbackRuntime(r),r);
 assert.equal(feedbackRuntimeChanged(r,{...r}),false);
 assert.equal(feedbackRuntimeChanged(r,{...r,campaign_id:null}),true);
 assert.equal(feedbackRuntimeChanged(r,{...r,form_version_id:'22222222-2222-4222-8222-222222222222'}),true);
 assert.equal(feedbackRuntimeChanged(undefined,r),true);
 assert.throws(()=>parseFeedbackRuntime({...r,environment_id:'wrong'}));
 assert.throws(()=>parseFeedbackRuntime({...r,kind:'untrusted'}));
 assert.throws(()=>parseFeedbackRuntime({...r,accepting_submissions:undefined}));
});
