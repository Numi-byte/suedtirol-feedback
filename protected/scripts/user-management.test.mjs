import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPortalAccess, portalHome, portalLinks, PORTAL_OWNER_ID } from '../src/lib/portal-access.ts';
import { readAccountFields, readAccessFields, readUserId, createPortalUser, changePortalCredentials, saveUserAccess } from '../src/lib/user-management.ts';
const id = '99999999-9999-4999-8999-999999999999';
function form(values) { const data = new FormData(); for (const [k,v] of Object.entries(values)) data.set(k,v); return data; }
const valid = () => form({ email:' Operator@Example.test ',password:'Synthetic-password-123',active:'on',stops:'on',database:'on' });

test('section checks fail closed and landing/menu use only explicitly granted sections', async () => {
  const access = await getPortalAccess({ rpc: async () => ({ data:{ stops:true,database:'true',feedback:false,users:false },error:null }) });
  assert.equal(portalHome(access),'/stops');
  assert.deepEqual(portalLinks(access),[{ href:'/stops',section:'stops' }]);
  assert.equal(portalHome(await getPortalAccess({ rpc:async()=>({data:{users:true},error:{message:'offline'}}) })),null);
});

test('credentials validate lengths and email; access never defaults to feedback or owner', () => {
  assert.equal(readAccountFields(valid(),true).email,'operator@example.test');
  assert.deepEqual(readAccessFields(valid()),{p_active:true,p_stops:true,p_database:true,p_feedback:false,p_feedback_settings:false,p_reply_feedback:false});
  assert.throws(()=>readAccountFields(form({email:'bad',password:'weak'}),true));
  assert.throws(()=>readAccountFields(form({email:'a@example.test',password:'short'}),true));
  assert.equal(readAccountFields(form({email:'a@example.test',password:''})).password,'');
  assert.throws(()=>readAccessFields(form({active:'on'})),/at least one/);
  assert.throws(()=>readUserId(form({user_id:'not-a-uuid'})));
});

test('creating an account uses Auth Admin and explicit RPC rights without echoing a password', async () => {
  const calls=[];
  const admin={auth:{admin:{createUser:async fields=>{calls.push(fields);return{data:{user:{id}},error:null};}}}};
  const client={rpc:async(name,args)=>{calls.push({name,args});return{error:null};}};
  const result=await createPortalUser(client,admin,valid());
  assert.equal(result.success,true);
  assert.equal(calls[0].email_confirm,true);
  assert.equal(calls[0].password,'Synthetic-password-123');
  assert.equal(calls.find(x=>x.name==='set_portal_user_access').args.p_feedback,false);
  assert.ok(!JSON.stringify(result).includes('Synthetic-password'));
});

test('partial account creation cannot silently claim permissions were granted', async () => {
  const admin={auth:{admin:{createUser:async()=>({data:{user:{id}},error:null})}}};
  const result=await createPortalUser({rpc:async name=>({error:name==='set_portal_user_access'?{message:'offline'}:null})},admin,valid());
  assert.match(result.error,/account was created/i);
  assert.ok(!result.success);
});

test('blank reset password is omitted; failed audit prevents credential mutation', async () => {
  let mutation;
  const admin={auth:{admin:{updateUserById:async(userId,fields)=>{mutation={userId,fields};return{error:null};}}}};
  const fields=form({user_id:id,email:'updated@example.test',password:''});
  const result=await changePortalCredentials({rpc:async()=>({error:null})},admin,fields);
  assert.equal(result.success,true);
  assert.ok(!('password' in mutation.fields));
  mutation=null;
  await assert.rejects(changePortalCredentials({rpc:async()=>({error:{message:'offline'}})},admin,fields),/record/);
  assert.equal(mutation,null);
});

test('owner access cannot be disabled through the application service', async () => {
  let called=false;
  await assert.rejects(saveUserAccess({rpc:async()=>{called=true;}},form({user_id:PORTAL_OWNER_ID})),/Owner access/);
  assert.equal(called,false);
});

test('feedback management must be granted explicitly and can be the only section', async () => {
 const fields=form({active:'on',feedback_settings:'on'});
 assert.deepEqual(readAccessFields(fields),{p_active:true,p_stops:false,p_database:false,p_feedback:false,p_feedback_settings:true,p_reply_feedback:false});
 const access=await getPortalAccess({rpc:async()=>({data:{feedbackSettings:true},error:null})});
 assert.equal(portalHome(access),'/feedback-settings');
 assert.deepEqual(portalLinks(access),[{href:'/feedback-settings',section:'feedbackSettings'}]);
 let args;
 await saveUserAccess({rpc:async(_name,value)=>{args=value;return {error:null};}},form({user_id:id,active:'on',feedback_settings:'on'}));
 assert.equal(args.p_feedback_settings,true);
 assert.equal(args.p_feedback,false);
});

test('reply permission is subordinate to inbox access',()=>{
 assert.equal(readAccessFields(form({active:'on',feedback:'on',reply_feedback:'on'})).p_reply_feedback,true);
 assert.equal(readAccessFields(form({active:'on',stops:'on',reply_feedback:'on'})).p_reply_feedback,false);
});
