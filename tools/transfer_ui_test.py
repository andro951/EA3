"""Native two-context, manually paired WebRTC handoff through UI. No relay/STUN."""
import argparse,json,time,traceback,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native two independent browser contexts','assertions':[],'errors':[],'realPhysicalDevices':False}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  c1,s=start_page(browser,True,args.url);c2,r=start_page(browser,True,args.url)
  for page in [s,r]:page.on('pageerror',lambda e:report['errors'].append(str(e)))
  s.locator('.menu-action[data-action="stories"]').first.click();s.locator('.card-art-button[data-id="the-ember-road"]').click();s.locator('[data-action="detail-begin"]').click();s.locator('button[form="setup-form"]').click();expect(s.locator('.game')).to_be_visible();s.locator('[data-action="home"]').first.click()
  for page in [s,r]:page.locator('[data-action="data-tools"]').click();page.locator('[data-action="send-adventure"]').click()
  s.locator('[data-action="transfer-offer"]').click();expect(s.get_by_label('Your pairing message to copy')).to_have_value(re.compile('ea3/pair/1'),timeout=20000)
  r.get_by_label('Pairing message from the other device').fill(s.get_by_label('Your pairing message to copy').input_value());r.locator('[data-action="transfer-answer"]').click();expect(r.get_by_label('Your pairing message to copy')).to_have_value(re.compile('ea3/pair/1'),timeout=20000)
  s.get_by_label('Pairing message from the other device').fill(r.get_by_label('Your pairing message to copy').input_value());s.locator('[data-action="transfer-connect"]').click()
  expect(r.get_by_role('heading',name='Receive this adventure?',exact=True)).to_be_visible(timeout=20000);report['assertions'].append('Connection requires explicit archive approval on receiving device');r.locator('dialog [data-action="confirm"]').last.click()
  expect(r.locator('#transfer-status')).to_contain_text('Transfer verified and imported',timeout=30000);expect(s.locator('#transfer-status')).to_contain_text('Transfer acknowledged',timeout=15000);report['assertions'].append('Direct native RTC delivers an integrity-checked archive between independent contexts')
  for page in [s,r]:
   while page.locator('dialog[open]').count():page.locator('dialog [data-action="dialog-close"]').last.click()
   page.locator('[data-action="saves"]').first.click();expect(page.locator('dialog').last).to_contain_text('The Ember Road')
  report['assertions'].append('Both sending and receiving devices retain the adventure')
  browser.close()
except Exception as e:report['failure']=str(e);report['traceback']=traceback.format_exc()
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence/ui-transfer-native.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
