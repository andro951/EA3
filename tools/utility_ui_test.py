"""Voice settings, portable backups and independent raw recovery. No audible-output claim."""
import argparse,json,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native' if args.native else 'offline DOM with explicit storage/network doubles','assertions':[],'screenshots':[],'errors':[],'audiblePlaybackVerified':False,'nativeFolderGrantVerified':False}
def check(s):report['assertions'].append(s)
def shot(name):
 path=ROOT/'evidence/screenshots'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(path));report['screenshots'].append(path.relative_to(ROOT).as_posix())
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  context,page=start_page(browser,args.native,args.url);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.locator('.menu-action[data-action="stories"]').first.click();page.locator('.card-art-button[data-id="the-ember-road"]').click();page.locator('[data-action="detail-begin"]').click();page.locator('button[form="setup-form"]').click();expect(page.locator('.game')).to_be_visible()
  page.locator('[data-action="settings"]').first.click();page.locator('[data-action="settings-voice"]').click();expect(page.get_by_role('heading',name='Voice & playback')).to_be_visible();page.get_by_label('Reading speed',exact=True).fill('1.2');page.locator('#voice-form button[type="submit"]').click();expect(page.locator('#toasts')).to_contain_text('Voice assignments saved');check('Voice assignments and speed save through settings');shot('ea3-voice-desktop-pass1');page.locator('dialog [data-action="dialog-close"]').last.click()
  page.locator('[data-action="settings-backups"]').click();page.locator('[data-action="folder-backup"]').click();expect(page.get_by_role('heading',name='Backups you own')).to_be_visible();expect(page.locator('dialog').last).to_contain_text('No folder backup verified yet');check('Backup status does not claim a copy before verification');shot('ea3-backup-desktop-pass1')
  if args.native:
   with page.expect_download() as pending:page.locator('[data-action="backup-export"]').click()
   path=ROOT/'evidence/test-complete-backup.json';pending.value.save_as(str(path));value=json.loads(path.read_text());assert value['schema']=='ea3/envelope/1';assert len(value['payload']['tables']['saves'])==1;check('Complete native backup download contains the adventure')
   recovery=context.new_page();recovery.goto(args.url+'/recovery.html',wait_until='networkidle');recovery.locator('#inspect').click();expect(recovery.locator('#export')).to_be_enabled();assert 'saves' in recovery.locator('#report').inner_text()
   with recovery.expect_download() as pending:recovery.locator('#export').click()
   path=ROOT/'evidence/test-raw-rescue.json';pending.value.save_as(str(path));raw=json.loads(path.read_text());assert raw['schema']=='ea3/rescue/1';assert len(raw['tables']['saves'])==1;assert 'handles' not in raw['tables'];check('Independent recovery reads and exports existing IndexedDB without deleting it')
   recovery.close()
  page.set_viewport_size({'width':390,'height':844});shot('ea3-backup-mobile-pass1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');check('Phone backup controls fit without horizontal overflow')
  browser.close()
except Exception as e:report['failure']=str(e);report['traceback']=traceback.format_exc()
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-utilities'+('-native' if args.native else '')+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
