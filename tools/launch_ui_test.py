"""Play every authored ending via the real UI; no model or state-injection shortcut."""
import argparse, json, subprocess, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from ui_support import ROOT, start_page

parser=argparse.ArgumentParser()
parser.add_argument('--native', action='store_true')
parser.add_argument('--url', default='http://127.0.0.1:4173')
args=parser.parse_args()
report={'mode':'native IndexedDB' if args.native else 'offline DOM / explicit MemoryRepository',
        'liveAI':False,'assertions':[],'endings':[],'screenshots':[],'errors':[]}
source="""import {playthroughs} from './content/playthroughs.mjs';
import {collectionStories} from './content/collection.mjs';
import {starterStory} from './content/seed.mjs';
console.log(JSON.stringify({routes:playthroughs,stories:[starterStory,...collectionStories]}));"""
fixtures=json.loads(subprocess.check_output(['node','--input-type=module','-e',source],cwd=ROOT,text=True))
stories={s['id']:s for s in fixtures['stories']}

def check(message): report['assertions'].append(message)
def shot(page,name):
    path=ROOT/'evidence/screenshots'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(path));report['screenshots'].append(path.relative_to(ROOT).as_posix())
def fits(page,context):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), context+' horizontal overflow'
    assert page.evaluate('Array.from(document.images).filter(i=>!i.hidden).every(i=>i.complete&&i.naturalWidth>0)'), context+' missing image'
def ready(page):
    expect(page.locator('#save-status-text')).to_have_text('Saved locally',timeout=15000)

browser=None
try:
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    context,page=start_page(browser,args.native,args.url);page.set_default_timeout(10000)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.locator('.menu-action[data-action="stories"]').first.click()
    expect(page.locator('.card-art-button[data-kind="story"]')).to_have_count(7)
    for w,h in [(1920,1080),(1366,768),(768,1024),(390,844),(320,720)]:
        page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(150)
        fits(page,f'Library {w}');shot(page,f'ea3-launch-library-{w}')
    check('Seven-story library renders without missing art or overflow at five viewport sizes')
    page.set_viewport_size({'width':1440,'height':1000})
    for index,route in enumerate(fixtures['routes']):
        if index:
            page.locator('[data-action="home"]').first.click()
            page.locator('.menu-action[data-action="stories"]').first.click()
        story=stories[route['storyId']]
        page.locator('.card-art-button[data-id="'+story['id']+'"]').click()
        page.locator('[data-action="detail-begin"]').click()
        page.get_by_label('Adventure title',exact=True).fill(story['title']+' · '+route['ending'])
        page.locator('button[form="setup-form"]').click()
        expect(page.locator('.game')).to_be_visible();ready(page)
        if story['id'] in ['table-seven','low-tide'] and route['ending'] in ['music','breakfast']:
            for w,h in [(1920,1080),(1366,768),(768,1024),(390,844),(320,720)]:
                page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
                fits(page,f"{story['id']} {w}");shot(page,f"ea3-{story['id']}-opening-{w}")
            page.set_viewport_size({'width':1440,'height':1000})
        turns=1
        for action in route['actions']:
            if action['kind']=='choice':
                page.locator('#story-choices [data-action="choose"][data-id="'+action['choiceId']+'"]').click()
            elif action['kind']=='travel':
                page.locator('[data-action="map"]').first.click()
                page.locator('[data-action="travel-location"][data-id="'+action['location']+'"]').click()
            elif action['kind']=='offer':
                page.locator('[data-action="offers"]').first.click()
                if action['offerId']=='potting':shot(page,'ea3-copper-work-offers-desktop')
                page.locator('[data-action="take-offer"][data-id="'+action['offerId']+'"]').click()
            else:raise AssertionError('Unknown acceptance action')
            turns+=1;expect(page.locator('.turn')).to_have_count(turns,timeout=15000);ready(page)
        ending=next(n['ending'] for n in story['nodes'] if n['id']==route['ending'])
        expect(page.locator('.ending-banner h3')).to_have_text(ending)
        report['endings'].append(story['id']+':'+route['ending'])
        if route['ending'] in ['cooperative','record','small-lights']:shot(page,'ea3-ending-'+route['ending'])
    check('All twenty authored endings reached through choices, travel and paid transactions')
    if args.native:
        data=page.evaluate("""async()=>{const{Repository}=await import('/app/storage/repository.mjs');const r=await new Repository().open();
        const saves=await r.listSaves();return{count:saves.length,endings:saves.filter(s=>s.ending).length};}""")
        assert data=={'count':20,'endings':20};check('Native IndexedDB retains all twenty complete adventures')
        page.reload(wait_until='networkidle');page.locator('[data-action="continue-save"]').click()
        expect(page.locator('.ending-banner h3')).to_have_text('An old light pointed somewhere new')
        check('Latest complete adventure survives native reload')
    else:
        data=page.evaluate('async()=>{const s=await __offlineRepo.listSaves();return{count:s.length,endings:s.filter(x=>x.ending).length};}')
        assert data=={'count':20,'endings':20};check('Explicit test repository retains all twenty complete adventures')
    browser.close();browser=None
except Exception as error:
    report['failure']=str(error);report['traceback']=traceback.format_exc()
    try:shot(page,'failure-launch-collection')
    except Exception:pass
finally:
    if browser:
        try:browser.close()
        except Exception:pass
    report['passed']='failure' not in report and not report['errors']
    report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (ROOT/'evidence').mkdir(exist_ok=True)
    (ROOT/'evidence'/('ui-launch-native.json' if args.native else 'ui-launch-offline.json')).write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
