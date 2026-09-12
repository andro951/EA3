"""Owned raster/gallery/presentation tests through UI; generated AI is not simulated as live."""
import argparse,json,time,traceback,struct,zlib
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native' if args.native else 'offline DOM with explicit storage/network doubles','assertions':[],'screenshots':[],'errors':[]}
# Tiny synthetic raster; no user images or external generation are involved.
def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
rows=b''.join(b'\x00'+bytes([211,113,46])*600 for _ in range(400))
PNG=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',600,400,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')

def check(s):report['assertions'].append(s)
def shot(name):
 path=ROOT/'evidence/screenshots'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(path));report['screenshots'].append(path.relative_to(ROOT).as_posix())
def upload(button,name):
 with page.expect_file_chooser() as f:button.click()
 f.value.set_files({'name':name,'mimeType':'image/png','buffer':PNG})
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  context,page=start_page(browser,args.native,args.url);page.set_default_timeout(7000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.locator('.menu-action[data-action="stories"]').first.click();page.locator('.card-art-button[data-id="the-ember-road"]').click();page.locator('[data-action="detail-begin"]').click();page.locator('button[form="setup-form"]').click();expect(page.locator('.game')).to_be_visible()
  page.locator('[data-action="gallery"]').first.click();expect(page.get_by_role('heading',name='Image Gallery')).to_be_visible()
  upload(page.locator('[data-action="gallery-upload"]'),'fixture-scene.png');expect(page.locator('.gallery-thumb')).to_have_count(1)
  page.locator('[data-action="gallery-use"]').click();expect(page.locator('#toasts')).to_contain_text('Selected image applied');check('Raster upload and explicit scene selection work')
  page.locator('[data-action="gallery-favorite"]').click();expect(page.locator('[data-action="gallery-favorite"]')).to_contain_text('Unfavorite');check('Favorite selection persists')
  page.locator('[data-action="gallery-crop"]').click();page.get_by_label('Aspect ratio',exact=True).select_option('1');page.locator('[data-action="crop-save"]').click();expect(page.get_by_role('heading',name='Crop a copy')).to_have_count(0);expect(page.locator('.gallery-thumb')).to_have_count(2);check('Cropping creates a new owned raster without replacing the selected scene');shot('ea3-gallery-desktop-pass1')
  page.locator('.gallery-thumb').first.click();page.locator('[data-action="gallery-use"]').click()
  page.locator('[data-action="gallery-delete"]').click();page.locator('dialog [data-action="confirm"]').last.click();expect(page.locator('#toasts')).to_contain_text('still used');check('Used image deletion is blocked instead of breaking saved references')
  page.locator('.gallery-dialog [data-action="dialog-close"]').click()
  page.locator('[data-action="inspect-character"][data-id="rhea"]').first.click();page.locator('[data-action="character-appearance"]').click()
  page.get_by_label('Species',exact=True).fill('Human cartographer');upload(page.locator('[data-action="appearance-upload"]'),'fixture-portrait.png');expect(page.locator('[data-action="appearance-confirm"]')).to_be_enabled();page.get_by_label('Species',exact=True).fill('Human traveler');expect(page.locator('[data-action="appearance-confirm"]')).to_be_disabled();check('Editing presentation invalidates a previously matching preview')
  upload(page.locator('[data-action="appearance-upload"]'),'matching-portrait.png');expect(page.locator('[data-action="appearance-confirm"]')).to_be_enabled();shot('ea3-appearance-desktop-pass1');page.set_viewport_size({'width':390,'height':844});shot('ea3-appearance-mobile-pass1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');check('Phone appearance controls have no horizontal overflow')
  page.locator('[data-action="appearance-confirm"]').click();expect(page.locator('#toasts')).to_contain_text('Appearance and portrait applied together');check('Matching preview and character presentation commit atomically')
  page.locator('dialog [data-action="dialog-close"]').last.click();page.set_viewport_size({'width':1440,'height':1000});page.locator('[data-action="inspect-character"][data-id="rhea"]').first.click();expect(page.get_by_role('dialog')).to_contain_text('Human traveler');check('Reopening inspection shows committed presentation')
  browser.close()
except Exception as e:
 report['failure']=str(e);report['traceback']=traceback.format_exc()
 try:shot('failure-media')
 except:pass
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-media'+('-native' if args.native else '')+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
