import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {readBody,json,fail} from './http-utils.mjs';
import {userSummary} from './db.mjs';
const scrypt=promisify(scryptCallback);
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export async function passwordHash(password,salt) {return (await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024})).toString('hex');}
export function tokenFrom(req) {
  if(req.headers.authorization?.startsWith('Bearer '))return req.headers.authorization.slice(7);
  return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ea3_session='))?.slice(12)||'';
}
export function actorFor(db,req,clock=Date.now) {
  const token=tokenFrom(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?').get(tokenHash(token),clock())||null;
}
export function requireActor(actor) {if(!actor)fail(401,'Sign in to use community services. Local play never requires an account.');if(actor.restricted)fail(403,'This account is restricted from community actions. Contact the instance operator.');return actor;}
export function requireModerator(actor) {requireActor(actor);if(!['moderator','admin'].includes(actor.role))fail(403,'Moderator permission is required.');return actor;}
export async function handleAuth(ctx,req,res,url) {
  const {db,clock,limiter,config}=ctx,path=url.pathname;
  if(path==='/api/session'&&req.method==='GET'){json(res,200,{user:userSummary(actorFor(db,req,clock)),instance:config.instanceName||'Local EmberAdventures community',testInstance:config.testInstance===true});return true;}
  if(['/api/register','/api/login'].includes(path)&&req.method==='POST') {
    limiter.take('auth:'+req.socket.remoteAddress,{limit:12,windowMs:15*60*1000});
    const body=await readBody(req,8192),username=String(body.username||'').trim(),password=body.password;
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}$/.test(username))fail(422,'Use a username of 3–40 letters, digits, dots, underscores or dashes.');
    if(typeof password!=='string'||password.length<12||password.length>1024)fail(422,'Use a password between 12 and 1024 characters.');
    let user;
    if(path==='/api/register') {
      if(config.registration===false)fail(403,'Registration is disabled on this instance.');
      if(db.prepare('SELECT id FROM users WHERE username=?').get(username))fail(409,'That username is already registered.');
      const salt=randomBytes(24).toString('hex'),hash=await passwordHash(password,salt),id=randomUUID();
      try{db.prepare("INSERT INTO users(id,username,salt,hash,role,created_at) VALUES(?,?,?,?,?,?)").run(id,username,salt,hash,'player',clock());}
      catch(e){if(e.code?.includes('CONSTRAINT'))fail(409,'That username is already registered.');throw e;}
      user=db.prepare('SELECT * FROM users WHERE id=?').get(id);
    }else {
      user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
      const derived=await passwordHash(password,user?.salt||'unregistered-account-dummy-salt');
      const expected=user?.hash||'0'.repeat(128);
      if(!user||!timingSafeEqual(Buffer.from(derived,'hex'),Buffer.from(expected,'hex')))fail(401,'The username or password is incorrect.');
      requireActor(user);
    }
    const token=randomBytes(32).toString('hex'),hash=tokenHash(token);
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(clock());
    db.prepare('INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)').run(hash,user.id,clock()+12*60*60*1000);
    const cookie=`ea3_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${config.secureCookies?'; Secure':''}`;
    json(res,path==='/api/register'?201:200,{user:userSummary(user),...(body.tokenMode===true?{token}: {})},{'Set-Cookie':cookie});return true;
  }
  if(path==='/api/logout'&&req.method==='POST') {
    const token=tokenFrom(req);if(token)db.prepare('DELETE FROM sessions WHERE hash=?').run(tokenHash(token));
    json(res,200,{ok:true},{'Set-Cookie':`ea3_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${config.secureCookies?'; Secure':''}`});return true;
  }
  return false;
}
