"""UI-only community workflow with synthetic data. --native requires an explicitly marked test instance."""
import argparse,json,time,traceback,subprocess,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native isolated service' if args.native else 'offline DOM / explicit scripted community transport','assertions':[],'screenshots':[],'errors':[]}
def check(s):report['assertions'].append(s)
def shot(page,name):
 path=ROOT/'evidence/screenshots'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(path));report['screenshots'].append(path.relative_to(ROOT).as_posix())
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  context,page=start_page(browser,args.native,args.url);page.set_default_timeout(9000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  if args.native:
   assert (page.request.get(args.url+'/api/session').json()).get('testInstance') is True, 'Refusing writes: service is not marked EA3_TEST_INSTANCE=1'
  else:
   page.evaluate('''()=>{
    const oldFetch=globalThis.fetch;let user=null,versions=[];
    const summary=v=>({itemId:v.itemId,versionId:v.versionId,number:v.number,title:v.content.title||v.content.name,description:v.content.description,genre:v.content.genre,tags:v.content.tags||[],rating:v.content.rating,status:'public',kind:v.content.kind,creator:v.content.creator,thumbnail:v.content.image,ownerId:'fixture-user',uploader:'fixture_creator',createdAt:Date.now(),ratings:0});
    globalThis.fetch=async(path,options={})=>{const body=options.body?JSON.parse(options.body):{},url=new URL(path,'https://fixture.invalid');const result=(v,status=200)=>new Response(JSON.stringify(v),{status});
     if(url.pathname==='/api/session')return result({user,instance:'Isolated UI fixture',testInstance:true});
     if(['/api/register','/api/login'].includes(url.pathname)){user={id:'fixture-user',username:body.username,role:'player'};return result({user});}
     if(url.pathname==='/api/logout'){user=null;return result({ok:true});}
     if(url.pathname==='/api/public/items')return result({items:versions.map(summary),total:versions.length,page:0,size:20,genres:['Adventure'],creators:['EmberAdventures'],instance:'Isolated UI fixture'});
     if(url.pathname==='/api/publish'){const v={...body,versionId:'fixture-version-'+(versions.length+1),itemId:'fixture-item',number:versions.length+1};versions.push(v);return result({...summary(v),operationId:body.operationId},201);}
     if(url.pathname.startsWith('/api/versions/')){const v=versions.find(v=>v.versionId===url.pathname.split('/').at(-1));return result({summary:summary(v),content:v.content,characters:v.characters,assets:v.assets});}
     if(url.pathname==='/api/mine')return result({user,versions:versions.map(summary)});
     if(url.pathname==='/api/ratings')return result({ok:true});
     if(url.pathname==='/api/reports')return result({id:'fixture-report',state:'open'});
     return oldFetch(path,options);
    };
   }''')
  page.locator('.menu-action[data-action="stories"]').first.click();page.locator('[data-action="community"]').click();expect(page.get_by_role('heading',name='Community Library')).to_be_visible();check('Community opens without requiring an account')
  page.locator('[data-community-tab="publish"]').click();page.locator('input[name="selection"][value="story:the-ember-road"]').check();page.locator('#community-publish button[type="submit"]').click();expect(page.get_by_role('heading',name='Community account')).to_be_visible()
  username='ui_creator_'+str(int(time.time()))
  page.locator('[data-action="auth-mode"]').click();page.locator('#community-auth [name="username"]').fill(username);page.locator('#community-auth [name="password"]').fill('Synthetic-UI-password-Only-2026');page.locator('#auth-submit').click();expect(page.get_by_role('heading',name='Publish selected content?')).to_be_visible();page.locator('dialog [data-action="confirm"]').last.click();expect(page.locator('#publish-results')).to_contain_text('published version 1');check('Publication requires account and explicit confirmation; story cast is included')
  page.locator('[data-community-tab="discover"]').click();expect(page.locator('.community-card')).to_have_count(1);shot(page,'ea3-community-desktop-pass1')
  page.locator('.community-card [data-action="community-detail"]').last.click();expect(page.locator('[data-action="public-download"]')).to_be_visible();page.locator('[data-action="public-download"]').click();expect(page.locator('#toasts')).to_contain_text('Added to your library with its cast and images');check('Exact publication downloads with complete cast into local library')
  page.locator('[data-action="public-feedback"]').click();page.locator('#rating-form button[type="submit"]').click();expect(page.locator('#feedback-status')).to_contain_text('Rating saved')
  page.locator('#report-form [name="details"]').fill('Synthetic acceptance report for this exact version. No real user content is involved.');page.locator('#report-form button[type="submit"]').click();expect(page.locator('#feedback-status')).to_contain_text('No email was sent');check('Rating and exact-version report submit through explicit forms')
  page.locator('dialog [data-action="dialog-close"]').last.click();page.locator('dialog [data-action="dialog-close"]').last.click();page.set_viewport_size({'width':390,'height':844});shot(page,'ea3-community-mobile-pass1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');check('Phone community layout fits without horizontal overflow')
  if args.native:
   subprocess.run(['node','tools/admin.mjs','role',username,'moderator'],cwd=ROOT,check=True,capture_output=True,env=os.environ)
   operator=context.new_page();operator.on('pageerror',lambda e:report['errors'].append(str(e)));operator.goto(args.url+'/operator.html',wait_until='networkidle');operator.locator('.report-row').first.click();expect(operator.locator('#operator-detail')).to_contain_text('Original hash: verified');shot(operator,'ea3-operator-desktop-pass1');check('Operator reads immutable reported version and its verification status')
   operator.get_by_label('Action',exact=True).select_option('reclassify');operator.get_by_label('Classification for reclassification').select_option('mature');operator.get_by_label('Action explanation / reply draft').fill('Synthetic classification correction for acceptance testing.');operator.locator('#operator-action button[type="submit"]').click();operator.locator('dialog [data-action="confirm"]').last.click();expect(operator.locator('#operator-detail')).to_contain_text('Current classification: mature');check('Moderation action changes classification and retains audit history')
   operator.set_viewport_size({'width':390,'height':844});shot(operator,'ea3-operator-mobile-pass1');assert operator.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   operator.goto(args.url+'/workbench.html',wait_until='networkidle');expect(operator.get_by_role('heading',name='Provider connections')).to_be_visible();shot(operator,'ea3-workbench-pass1');check('Independent Workbench opens local diagnostics')
  browser.close()
except Exception as e:
 report['failure']=str(e);report['traceback']=traceback.format_exc()
 try:shot(page,'failure-community')
 except:pass
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-community-native.json' if args.native else 'ui-community-offline.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
