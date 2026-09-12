/** Trusted-local administration; never imported into a public page or HTTP route. */
import {resolve} from 'node:path';
import {openDatabase,transaction,audit,userSummary} from '../server/db.mjs';
const [command,username,role]=process.argv.slice(2);
if(!['list','role'].includes(command)||command==='role'&&(!username||!['player','moderator','admin'].includes(role))){console.error('Usage: node tools/admin.mjs list\n       node tools/admin.mjs role USERNAME player|moderator|admin\nSet EA3_DATA_DIR to the private local community database directory.');process.exitCode=2;}
else{
 const db=await openDatabase(process.env.EA3_DATA_DIR||resolve('.runtime/community'),{recoverJobs:false});
 try{if(command==='list')console.log(JSON.stringify(db.prepare('SELECT id,username,role,restricted FROM users ORDER BY username').all().map(userSummary),null,2));
 else{const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);if(!user)throw Error('User not found. Register an account on this instance first.');transaction(db,()=>{db.prepare('UPDATE users SET role=? WHERE id=?').run(role,user.id);audit(db,user,user.id,'trusted-local-role-change',`Local filesystem operator changed role from ${user.role} to ${role}.`);});console.log(`Role updated locally: ${username} → ${role}. No remote or production instance was modified unless EA3_DATA_DIR points to one.`);}}
 finally{db.close();}
}
