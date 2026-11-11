import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canReplyToFeedback} from '../src/lib/feedback-reply-authorization.ts';
test('reply controls require an explicit current database grant and fail closed',async()=>{
 for(const value of [{data:false,error:null},{data:null,error:null},{data:'true',error:null},{data:true,error:{message:'unavailable'}}])assert.equal(await canReplyToFeedback({rpc:async name=>{assert.equal(name,'can_reply_to_feedback');return value;}}),false);
 assert.equal(await canReplyToFeedback({rpc:async()=>({data:true,error:null})}),true);
});
