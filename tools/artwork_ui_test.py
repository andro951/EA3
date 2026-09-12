"""Owned artwork and cast authoring. Uses bundled illustration, not personal images."""
import argparse,json,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native' if args.native else 'offline DOM / explicit storage and transport doubles','assertions':[],'screenshots':[],'errors':[]}
def check(text):
 report['assertions'].append(text);print('PASS:',text,flush=True)
def shot(name):
 path=ROOT/'evidence/screenshots'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(path));report['screenshots'].append(path.relative_to(ROOT).as_posix())
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  print('Browser started',flush=True)
  context,page=start_page(browser,args.native,args.url);print('Page started',flush=True);page.set_default_timeout(9000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.locator('.menu-action[data-action="stories"]').first.click();page.locator('.card-art-button[data-id="the-ember-road"]').click();page.locator('[data-action="detail-edit"]').click()
  editor=page.locator('.editor-dialog');editor.locator('[data-ed-tab="cast"]').click();expect(editor).to_contain_text('Rhea Ashford');expect(editor).to_contain_text('Calder Voss');expect(editor).to_contain_text('Fen');check('Cast roles show actual reusable-character names rather than undefined metadata');shot('ea3-cast-editor-desktop-pass3')
  editor.locator('[data-action="ed-artwork"]').click();picker=page.locator('.gallery-dialog');expect(picker.get_by_role('heading',name='Artwork for this draft')).to_be_visible()
  print('Uploading artwork',flush=True)
  picker.locator('#artwork-file').set_input_files({'name':'Dawn-scene.png','mimeType':'image/png','buffer':(ROOT/'public/art/daylight.png').read_bytes()})
  expect(picker.locator('[data-action="artwork-use"]')).to_be_enabled();shot('ea3-artwork-picker-desktop-pass3');picker.locator('[data-action="artwork-use"]').click();expect(picker).to_have_count(0);check('Owned artwork upload attaches to a draft without needing an adventure')
  editor.locator('[data-ed-tab="details"]').click();expect(editor.locator('.editor-story-preview')).to_be_visible();editor.locator('[data-action="ed-save"]').click();expect(editor.locator('.editor-status')).to_have_text('Saved to your library');shot('ea3-story-details-editor-desktop-pass3');check('Image selection is previewed and saved explicitly with the library definition')
  editor.locator('[data-action="dialog-close"]').click();page.locator('.card-art-button[data-id="the-ember-road"]').click();expect(page.locator('dialog img.detail-art')).to_have_attribute('src',__import__('re').compile('^data:image/png'));page.locator('[data-action="detail-edit"]').click();editor=page.locator('.editor-dialog');check('Reopened library detail renders the chosen owned artwork')
  page.set_viewport_size({'width':390,'height':844});editor.locator('[data-action="ed-toggle-graph"]').click();expect(editor.locator('.graph-workspace')).to_be_hidden();expect(editor.get_by_label('Narration',exact=True)).to_be_visible();shot('ea3-mobile-expanded-inspector-pass3');assert editor.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');check('Phone inspector expands by collapsing the graph without losing its selected moment')
  browser.close()
except Exception as e:
 report['failure']=str(e);report['traceback']=traceback.format_exc()
 try:shot('failure-artwork')
 except:pass
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-artwork-native.json' if args.native else 'ui-artwork-offline.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
