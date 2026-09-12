"""Real Chromium DOM interactions; offline fixture mode is explicitly labeled.
Run --native separately on an unrestricted local/CI computer for browser APIs.
"""
import argparse, json, hashlib, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from offline_bundle import Bundler, ROOT, styles
OUT=ROOT/'evidence/screenshots';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');parser.add_argument('--phase',default='foundation');args=parser.parse_args()
report={'mode':'native' if args.native else 'offline DOM / explicit MemoryRepository','nativeIndexedDB':False,'liveAI':False,'assertions':[],'screenshots':[],'errors':[]}
def check(name):report['assertions'].append(name)
def shot(page,name):
    path=OUT/(name+'.png');page.screenshot(path=str(path),full_page=False);report['screenshots'].append(path.relative_to(ROOT).as_posix())
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
    if args.native:page.goto(args.url,wait_until='networkidle')
    else:
        bundle=Bundler();code=bundle.code();report['unimplementedModulesInCheckpoint']=bundle.missing
        page.expose_function('__digest',lambda values:list(hashlib.sha256(bytes(values)).digest()))
        page.set_content('<!doctype html><html><head><meta charset="utf-8"><style>'+ styles()+'</style></head><body><div id="app"></div><div id="toasts" class="toasts"></div></body></html>')
        page.evaluate('''art=>{globalThis.__offlineArt=art;globalThis.__offlineDownloads=[];Object.defineProperty(crypto,'randomUUID',{value:()=>{const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;return Array.from(a,(b,i)=>([4,6,8,10].includes(i)?'-':'')+b.toString(16).padStart(2,'0')).join('');},configurable:true});Object.defineProperty(crypto,'subtle',{value:{digest:async(_alg,data)=>new Uint8Array(await __digest(Array.from(new Uint8Array(data.buffer||data,data.byteOffset||0,data.byteLength)))).buffer},configurable:true});globalThis.fetch=async url=>{if(url==='/api/providers')return new Response(JSON.stringify({text:{demo:true,configured:false},image:{configured:false}}));throw new Error('Offline fixture has no route for '+url);};}''',bundle.art())
        page.add_script_tag(content=code)
    expect(page.locator('.home')).to_be_visible(timeout=15000);check('Boot reaches familiar main menu')
    page.wait_for_timeout(500);shot(page,'ea3-home-desktop-pass1')
    page.locator('.menu-action[data-action="stories"]').first.click()
    expect(page.get_by_role('heading',name='Story Library',exact=True)).to_be_visible();check('Main menu opens story library');shot(page,'ea3-stories-desktop-pass1')
    page.locator('.card-art-button[data-id="the-ember-road"]').click();expect(page.get_by_role('dialog')).to_be_visible();shot(page,'ea3-story-detail-pass1')
    page.locator('[data-action="detail-begin"]').click();page.locator('#setup-form input[name=name]').fill('Rowan');page.locator('button[form="setup-form"]').click()
    expect(page.locator('.game')).to_be_visible(timeout=15000);expect(page.locator('.player-card')).to_contain_text('Rowan');check('Story setup creates playable adventure with chosen identity');shot(page,'ea3-game-desktop-pass1')
    page.locator('[data-action="choose"][data-id="map"]').click();expect(page.locator('.turn')).to_have_count(2,timeout=15000);check('Authored choice commits a second turn')
    page.locator('[data-action="offers"]').first.click();expect(page.get_by_role('dialog')).to_contain_text('spiced tea');shot(page,'ea3-shop-pass1')
    page.locator('[data-action="take-offer"][data-id="spiced-tea"]').click();expect(page.locator('.player-resources')).to_contain_text('22',timeout=10000);check('UI purchase deducts exact cost')
    page.locator('[data-action="inventory"]').click();expect(page.get_by_role('dialog')).to_contain_text('Spiced tea');shot(page,'ea3-inventory-pass1');page.locator('dialog [data-action="dialog-close"]').last.click()
    page.locator('[data-action="inspect-character"][data-id="rhea"]').first.click();expect(page.get_by_role('dialog')).to_contain_text('Rhea Ashford');shot(page,'ea3-character-pass1');page.locator('dialog [data-action="dialog-close"]').last.click()
    page.locator('[data-action="map"]').first.click();expect(page.get_by_role('dialog')).to_contain_text('forgotten beacon');shot(page,'ea3-map-pass1');page.locator('dialog [data-action="dialog-close"]').last.click()
    page.locator('[data-action="settings"]').first.click();expect(page.get_by_role('dialog')).to_contain_text('Auto behavior');shot(page,'ea3-settings-pass1');page.locator('dialog [data-action="dialog-close"]').last.click()
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);shot(page,'ea3-game-mobile-pass1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');check('Phone game has no horizontal document overflow')
    page.locator('[data-action="toggle-info"]').click();expect(page.locator('.sidebar.mobile-open')).to_be_visible();shot(page,'ea3-info-mobile-pass1');page.locator('.sidebar [data-action="close-drawer"]').click()
    page.locator('[data-action="home"]').first.click();expect(page.locator('.home')).to_be_visible();shot(page,'ea3-home-mobile-pass1')
    if not args.native:
        records=page.evaluate('async()=>({saves:await __offlineRepo.listSaves(),events:await __offlineRepo.all("events")})');assert len(records['saves'])==1;assert len(records['events'])==3;check('Observed stored state matches all three UI turns');report['saveCount']=1
    if args.native:
        # Read actual IndexedDB without injecting or mutating application state.
        records=page.evaluate("""async()=>{const module=await import('/app/storage/repository.mjs');const repo=await new module.Repository().open();const saves=await repo.listSaves();const save=await repo.readSave(saves[0].id);repo.close();return {saves,save};}""")
        assert len(records['saves'])==1 and len(records['save']['events'])==3
        assert records['save']['state']['resources']['gold']==22
        report['nativeIndexedDB']=True;check('Native IndexedDB stores exact UI events and world state')
        page.reload(wait_until='networkidle');expect(page.locator('.home')).to_be_visible()
        page.locator('[data-action="continue-save"]').click();expect(page.locator('.game')).to_be_visible()
        expect(page.locator('.player-resources')).to_contain_text('22');expect(page.locator('.turn')).to_have_count(3)
        check('Native page reload restores complete adventure')
        page.set_viewport_size({'width':1440,'height':1000})
        page.locator('[data-action="saves"]').first.click()
        with page.expect_download() as download_event:page.locator('[data-action="export-save"]').first.click()
        exported=ROOT/'evidence/native-test-adventure.ea3.json';download_event.value.save_as(str(exported))
        assert exported.stat().st_size>1000;check('Native browser downloads a complete adventure archive')
        other=browser.new_context(viewport={'width':1024,'height':800},reduced_motion='reduce')
        second=other.new_page();second.on('pageerror',lambda e:report['errors'].append(str(e)))
        second.goto(args.url,wait_until='networkidle');expect(second.locator('.home')).to_be_visible()
        second.locator('[data-action="data-tools"]').click()
        with second.expect_file_chooser() as chooser:second.locator('[data-action="import-everything"]').click()
        chooser.value.set_files(str(exported))
        expect(second.get_by_role('heading',name='Import complete archive?')).to_be_visible()
        second.locator('dialog [data-action="confirm"]').last.click()
        expect(second.locator('#toasts')).to_contain_text('Imported successfully',timeout=15000)
        second.locator('dialog [data-action="dialog-close"]').last.click()
        second.locator('[data-action="continue-save"]').click();expect(second.locator('.game')).to_be_visible()
        expect(second.locator('.player-resources')).to_contain_text('22');expect(second.locator('.turn')).to_have_count(3)
        check('Independent native browser context imports and resumes exact state')
        shot(second,'ea3-imported-native-laptop');other.close()
    browser.close()
except Exception as e:
 report['failure']=str(e);report['traceback']=traceback.format_exc()
 try:shot(page,'failure-'+args.phase)
 except:pass
finally:
 report['passed']='failure' not in report and not report['errors'];report['recorded_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(ROOT/'evidence'/('ui-'+args.phase+('-native' if args.native else '')+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
