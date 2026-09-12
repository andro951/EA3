"""Shared browser harness: offline mode explicitly substitutes storage and transport.
Native mode uses ordinary navigation and the application's real IndexedDB repository.
"""
import hashlib, base64
from pathlib import Path
from offline_bundle import Bundler, ROOT, styles
from playwright.sync_api import expect

def start_page(browser, native=False, url='http://127.0.0.1:4173', width=1440, height=1000):
    context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
    page=context.new_page()
    if native:
        page.goto(url,wait_until='networkidle')
    else:
        bundle=Bundler(); code=bundle.code()
        page.expose_function('__digest',lambda encoded:list(hashlib.sha256(base64.b64decode(encoded,validate=True)).digest()))
        page.set_content('<!doctype html><html><head><meta charset="utf-8"><style>'+styles()+'</style></head><body><div id="app"></div><div id="toasts" class="toasts"></div></body></html>')
        page.evaluate('''art=>{
          globalThis.__offlineArt=art;globalThis.__offlineDownloads=[];
          Object.defineProperty(crypto,'randomUUID',{value:()=>{const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;return Array.from(a,(b,i)=>([4,6,8,10].includes(i)?'-':'')+b.toString(16).padStart(2,'0')).join('');},configurable:true});
          Object.defineProperty(crypto,'subtle',{value:{digest:async(_alg,data)=>{const bytes=new Uint8Array(data.buffer||data,data.byteOffset||0,data.byteLength),parts=[];for(let i=0;i<bytes.length;i+=16384)parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));return new Uint8Array(await __digest(btoa(parts.join('')))).buffer;}},configurable:true});
          globalThis.fetch=async url=>{if(url==='/api/providers')return new Response(JSON.stringify({text:{demo:true,configured:false},image:{configured:false}}));throw new Error('Offline fixture has no route for '+url);};
        }''',bundle.art())
        page.add_script_tag(content=code)
    expect(page.locator('.home')).to_be_visible(timeout=15000)
    return context,page
