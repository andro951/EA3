"""Memory UI with an explicit scripted AI transport. Native mode retains real browser storage."""
import argparse,json,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native browser with scripted AI transport' if args.native else 'offline DOM / scripted AI transport and MemoryRepository','liveAI':False,'assertions':[],'screenshots':[],'errors':[]}
def check(s):report['assertions'].append(s)
def shot(name):
 path=ROOT/'evidence/screenshots'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(path));report['screenshots'].append(path.relative_to(ROOT).as_posix())
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  context,page=start_page(browser,args.native,args.url);page.set_default_timeout(8000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.evaluate('''()=>{const original=globalThis.fetch;globalThis.fetch=async(...args)=>{if(args[0]==='/api/generate/author'){const input=JSON.parse(args[1].body),draft=input.request.draft;return new Response(JSON.stringify({text:JSON.stringify({memories:[{subject:'rhea',text:'Rhea is investigating the missing western road.',sourceEvent:draft.transcript[0].id,quote:'That road is still there',rating:'sfw'}]}),provider:'scripted-test-fixture'}),{headers:{'Content-Type':'application/json'}});}return original(...args);};}''')
  page.locator('.menu-action[data-action="stories"]').first.click();page.locator('.card-art-button[data-id="the-ember-road"]').click();page.locator('[data-action="detail-begin"]').click();page.locator('button[form="setup-form"]').click();expect(page.locator('.game')).to_be_visible()
  page.locator('[data-action="settings"]').first.click();page.locator('#settings-form [name="textProvider"]').select_option('http');page.locator('button[form="settings-form"]').click()
  page.locator('[data-action="memory"]').first.click();page.locator('[data-action="suggest-memory"]').click();expect(page.get_by_role('heading',name='Find important memories')).to_be_visible();expect(page.locator('dialog').last).to_contain_text('additional request');check('Memory review is explicit and discloses a separate provider request')
  page.locator('[data-action="memory-review-start"]').click();expect(page.locator('.memory-quote')).to_contain_text('That road is still there');expect(page.locator('[data-action="accept-memory"]')).to_be_visible();shot('ea3-memory-review-desktop-pass1');check('Suggestion is shown with its exact supporting quote before being kept')
  page.set_viewport_size({'width':390,'height':844});shot('ea3-memory-review-mobile-pass1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');check('Memory review fits a phone viewport')
  page.locator('[data-action="accept-memory"]').click();expect(page.locator('[data-action="accept-memory"]')).to_have_count(0);expect(page.locator('.memory-card')).to_contain_text('Rhea is investigating the missing western road');check('Keeping a suggestion records a durable fact without generating another story turn')
  page.locator('[data-action="forget-memory"]').click();expect(page.locator('.memory-card')).to_have_count(0);check('The user can remove a recorded fact explicitly')
  browser.close()
except Exception as e:report['failure']=str(e);report['traceback']=traceback.format_exc()
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-memory-native.json' if args.native else 'ui-memory-offline.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
