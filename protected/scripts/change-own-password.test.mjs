import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeOwnPassword} from '../src/lib/change-own-password.ts';
const form=(values)=>{const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;};
const valid={current_password:'Current-password-123',password:'New-password-456',confirm_password:'New-password-456',user_id:'another-account'};
test('only sends current/new credentials for the session account',async()=>{
 let payload;const result=await changeOwnPassword({auth:{updateUser:async args=>{payload=args;return{error:null};}}},form(valid),async()=>true);
 assert.equal(result,'success');assert.deepEqual(payload,{password:valid.password,current_password:valid.current_password});
});
test('invalid, reused and mismatched passwords never call Auth',async()=>{
 const client={auth:{updateUser:async()=>{throw Error('Must not call Auth');}}};
 for(const patch of [{current_password:''},{password:'short'},{password:'x'.repeat(1025)},{password:valid.current_password}])assert.equal(await changeOwnPassword(client,form({...valid,...patch}),async()=>{throw Error("Must not verify");}),'invalid');
 assert.equal(await changeOwnPassword(client,form({...valid,confirm_password:'different'}),async()=>true),'mismatch');
});
test('Auth failures return a generic error without reflecting credentials',async()=>{
 assert.equal(await changeOwnPassword({auth:{updateUser:async()=>({error:{message:'Sensitive server details'}})}},form(valid),async()=>true),'failed');
});

test('incorrect current password prevents mutation',async()=>{assert.equal(await changeOwnPassword({auth:{updateUser:async()=>{throw Error('Must not update');}}},form(valid),async()=>false),'failed');});
