import test from 'node:test';import assert from 'node:assert/strict';
import {CommunityClient} from '../app/community.mjs';
import {HttpProvider} from '../app/providers/http.mjs';
test('default transports invoke browser fetch with the global receiver',async()=>{
 const prior=globalThis.fetch;globalThis.fetch=async function(){assert.equal(this,globalThis);return new Response(JSON.stringify({user:null,state:'ready'}));};
 try{assert.equal((await new CommunityClient().session()).user,null);assert.equal((await new HttpProvider().status('test')).state,'ready');}finally{globalThis.fetch=prior;}
});
