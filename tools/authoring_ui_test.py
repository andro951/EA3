"""Creation, graph editing, draft recovery and responsive authoring, through the UI."""
import argparse,json,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_support import start_page,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
report={'mode':'native' if args.native else 'offline DOM with explicit storage/transport doubles','assertions':[],'screenshots':[],'errors':[]}
OUT=ROOT/'evidence/screenshots';OUT.mkdir(parents=True,exist_ok=True)
def check(text):report['assertions'].append(text)
def shot(name):
    p=OUT/(name+'.png');page.screenshot(path=str(p));report['screenshots'].append(p.relative_to(ROOT).as_posix())
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    context,page=start_page(browser,args.native,args.url);page.set_default_timeout(6000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.locator('.menu-action[data-action="stories"]').first.click()
    page.locator('.card-art-button[data-id="the-ember-road"]').click();page.locator('[data-action="detail-edit"]').click()
    editor=page.locator('.editor-dialog');expect(editor).to_be_visible();expect(editor.locator('.graph-node').first).to_be_visible();shot('ea3-story-editor-desktop-pass2');check('Existing story opens in graph-first editor')
    editor.locator('[data-action="ed-add-node"]').click();editor.get_by_label('Title',exact=True).fill('A hidden courtyard');editor.get_by_label('Narration',exact=True).fill('Warm lanterns hang above a sheltered courtyard.');editor.get_by_label('Narration',exact=True).press('Tab')
    expect(editor.locator('.graph-node.selected strong')).to_have_text('A hidden courtyard');check('Adding and editing a graph node updates its card')
    editor.locator('[data-action="ed-duplicate-node"]').click();expect(editor.get_by_label('Title',exact=True)).to_have_value('A hidden courtyard · copy')
    editor.locator('[data-action="ed-delete-node"]').click();page.locator('dialog [data-action="confirm"]').last.click()
    editor.locator('[data-action="ed-undo"]').click();editor.locator('#editor-search').fill('courtyard');expect(editor.locator('#editor-results')).to_contain_text('A hidden courtyard · copy');check('Delete followed by Undo restores the graph node')
    editor.locator('[data-ed-tab="details"]').click();editor.get_by_label('Story title',exact=True).fill('The Ember Road · workshop');editor.get_by_label('Story title',exact=True).press('Tab')
    editor.locator('[data-action="ed-save"]').click();expect(page.locator('#toasts')).to_contain_text('Saved to your library');check('Validated authoring saves to library')
    editor.get_by_label('Story title',exact=True).fill('Recover this draft');editor.get_by_label('Story title',exact=True).press('Tab');page.wait_for_timeout(500)
    editor.locator('[data-action="dialog-close"]').click();page.locator('.card-art-button[data-id="the-ember-road"]').click();page.locator('[data-action="detail-edit"]').click()
    expect(page.get_by_role('heading',name='Recover your draft?')).to_be_visible();page.locator('dialog [data-action="confirm"]').last.click()
    editor=page.locator('.editor-dialog');editor.locator('[data-ed-tab="details"]').click();expect(editor.get_by_label('Story title',exact=True)).to_have_value('Recover this draft');check('Closing and reopening recovers unsaved authoring draft')
    editor.locator('[data-ed-tab="graph"]').click();page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150);shot('ea3-node-editor-mobile-pass2')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert editor.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');check('Phone graph and inspector fit without horizontal overflow')
    editor.locator('[data-action="dialog-close"]').click();page.set_viewport_size({'width':1440,'height':1000});page.locator('[data-action="home"]').first.click();page.locator('.menu-action[data-action="characters"]').click()
    page.locator('[data-action="new-character"]').click();editor=page.locator('.editor-dialog');editor.get_by_label('Name',exact=True).fill('Arden Vale');editor.get_by_label('Personality and motivations',exact=True).fill('An inquisitive cartographer who asks thoughtful questions.');editor.get_by_label('Opening message',exact=True).fill('Arden looks up from a half-finished map. “Do you know this road?”')
    editor.locator('[data-ed-tab="appearance"]').click();editor.get_by_label('Visual description',exact=True).fill('An adult cartographer with dark curls, a green traveling coat and an ink-stained scarf.')
    editor.locator('[data-action="ed-add"][data-kind="outfit"]').click();editor.get_by_label('Outfit name',exact=True).last.fill('Rain cloak');editor.get_by_label('Outfit name',exact=True).last.press('Tab');shot('ea3-character-editor-desktop-pass2')
    editor.locator('[data-action="ed-save"]').click();expect(editor.locator('.editor-status')).to_have_text('Saved to your library');check('Character personality, opening, appearance and wardrobe save through forms')
    editor.locator('[data-action="ed-play"]').click();expect(page.get_by_role('heading',name='Begin your adventure',exact=True)).to_be_visible();page.locator('button[form="setup-form"]').click();expect(page.locator('.game')).to_be_visible();expect(page.locator('.turn')).to_contain_text('Arden looks up');check('Character playtest uses the current draft and opening')
    if args.native:page.reload(wait_until='networkidle');page.locator('[data-action="continue-save"]').click();expect(page.locator('.turn')).to_contain_text('Arden looks up');check('Authored character adventure survives a native reload')
    browser.close()
except Exception as e:
 report['failure']=str(e);report['traceback']=traceback.format_exc()
 try:shot('failure-authoring')
 except:pass
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-authoring'+('-native' if args.native else '')+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
