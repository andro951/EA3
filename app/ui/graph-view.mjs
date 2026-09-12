import {GraphIndex,NODE_WIDTH,NODE_HEIGHT} from '../authoring/graph.mjs';
import {esc,$} from './dom.mjs';
/** Canvas overview plus accessible DOM nodes. Rendering is viewport-bounded, not story-truncating. */
export class GraphView {
  constructor(host,story,{select=()=>{},move=()=>{},connect=()=>{},selected=null}={}) {
    this.host=host;this.callbacks={select,move,connect};this.selected=selected;this.view={x:30,y:30,zoom:.85,width:800,height:600};
    host.innerHTML='<canvas class="graph-lines" aria-hidden="true"></canvas><div class="graph-nodes"></div><span class="graph-hint">Drag background to pan · Wheel to zoom · Drag a port to connect</span><span class="graph-count" role="status"></span>';
    this.canvas=$('canvas',host);this.layer=$('.graph-nodes',host);this.drag=null;
    this.events=new AbortController();const signal=this.events.signal;
    host.addEventListener('pointerdown',e=>this.down(e),{signal});host.addEventListener('pointermove',e=>this.motion(e),{signal});host.addEventListener('pointerup',e=>this.up(e),{signal});host.addEventListener('pointercancel',()=>{this.drag=null;this.draw();},{signal});
    host.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY<0?1.12:1/1.12,e.offsetX,e.offsetY);},{passive:false,signal});
    host.addEventListener('click',e=>{const b=e.target.closest('[data-node-id]');if(b && !this.moved){this.selected=b.dataset.nodeId;this.callbacks.select(this.selected);this.draw();}},{signal});
    this.observer=new ResizeObserver(()=>{const box=host.getBoundingClientRect();this.view.width=box.width;this.view.height=box.height;this.draw();});this.observer.observe(host);this.update(story);
  }
  update(story){this.index=new GraphIndex(story);this.draw();}
  down(e){if(e.button!==0)return;this.moved=false;const node=e.target.closest('[data-node-id]'),port=e.target.closest('[data-port]');this.drag={id:node?.dataset.nodeId,type:port?'connect':node?'node':'pan',x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};if(node){this.drag.position={...this.index.positions[node.dataset.nodeId]};}this.host.setPointerCapture(e.pointerId);}
  motion(e){if(!this.drag)return;const d=this.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;this.moved ||= Math.hypot(dx,dy)>4;
    if(d.type==='pan'){this.view.x+=e.clientX-d.lastX;this.view.y+=e.clientY-d.lastY;}
    if(d.type==='node')this.index.move(d.id,d.position.x+dx/this.view.zoom,d.position.y+dy/this.view.zoom);
    d.lastX=e.clientX;d.lastY=e.clientY;this.draw();
  }
  up(e){const d=this.drag;if(!d)return;this.drag=null;this.host.releasePointerCapture(e.pointerId);
    if(d.type==='node'&&this.moved){const p=this.index.positions[d.id];this.callbacks.move(d.id,p);}
    if(d.type==='connect'){const r=this.host.getBoundingClientRect(),p={x:(e.clientX-r.left-this.view.x)/this.view.zoom,y:(e.clientY-r.top-this.view.y)/this.view.zoom};const to=this.index.visible(this.view).nodes.find(n=>{const a=this.index.positions[n.id];return p.x>=a.x && p.x<=a.x+NODE_WIDTH && p.y>=a.y && p.y<=a.y+NODE_HEIGHT;});if(to)this.callbacks.connect(d.id,to.id);}
    this.draw();
  }
  zoom(factor,cx=this.view.width/2,cy=this.view.height/2){const old=this.view.zoom,next=Math.min(1.6,Math.max(.12,old*factor));this.view.x=cx-(cx-this.view.x)*next/old;this.view.y=cy-(cy-this.view.y)*next/old;this.view.zoom=next;this.draw();}
  fit(){const b=this.index.bounds(),v=this.view;v.zoom=Math.min(1.1,Math.max(.12,Math.min((v.width-100)/b.width,(v.height-100)/b.height)));v.x=(v.width-b.width*v.zoom)/2-b.left*v.zoom;v.y=(v.height-b.height*v.zoom)/2-b.top*v.zoom;this.draw();}
  focus(id){const p=this.index.positions[id];if(!p)return;this.selected=id;this.view.x=this.view.width/2-(p.x+NODE_WIDTH/2)*this.view.zoom;this.view.y=this.view.height/2-(p.y+NODE_HEIGHT/2)*this.view.zoom;this.draw();}
  draw(){if(!this.index || !this.host.isConnected)return;const v=this.view,dpr=devicePixelRatio || 1;this.canvas.width=Math.max(1,v.width*dpr);this.canvas.height=Math.max(1,v.height*dpr);this.canvas.style.width=v.width+'px';this.canvas.style.height=v.height+'px';const c=this.canvas.getContext('2d');c.scale(dpr,dpr);c.translate(v.x,v.y);c.scale(v.zoom,v.zoom);c.lineWidth=2/v.zoom;
    const visible=this.index.visible(v),ids=new Set(visible.nodes.map(n=>n.id)),edges=new Map();for(const id of ids)for(const e of this.index.byNode.get(id)||[])edges.set(e.id,e);
    const curve=(a,b)=>{c.beginPath();c.moveTo(a.x,a.y);c.bezierCurveTo(a.x+80,a.y,b.x-80,b.y,b.x,b.y);c.stroke();};
    for(const e of edges.values()){const a=this.index.positions[e.from],b=this.index.positions[e.to];if(!a||!b)continue;c.strokeStyle=e.from===this.selected?'#ed9a53':'#69503c';curve({x:a.x+NODE_WIDTH,y:a.y+NODE_HEIGHT/2},{x:b.x,y:b.y+NODE_HEIGHT/2});c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(b.x,b.y+NODE_HEIGHT/2);c.lineTo(b.x-9,b.y+NODE_HEIGHT/2-5);c.lineTo(b.x-9,b.y+NODE_HEIGHT/2+5);c.fill();}
    if(this.drag?.type==='connect'){const a=this.index.positions[this.drag.id],r=this.host.getBoundingClientRect();c.strokeStyle='#ffc48b';curve({x:a.x+NODE_WIDTH,y:a.y+NODE_HEIGHT/2},{x:(this.drag.lastX-r.left-v.x)/v.zoom,y:(this.drag.lastY-r.top-v.y)/v.zoom});}
    this.layer.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
    this.layer.innerHTML=visible.nodes.map(n=>{const p=this.index.positions[n.id];return `<div class="graph-node ${n.id===this.selected?'selected':''}" style="left:${p.x}px;top:${p.y}px" data-node-id="${esc(n.id)}"><button type="button" class="graph-node-label" data-node-id="${esc(n.id)}" aria-pressed="${n.id===this.selected}"><small>${n.id===this.index.story.start?'OPENING':n.ending?'ENDING':'STORY MOMENT'}</small><strong>${esc(n.title || 'Untitled moment')}</strong><span>${esc(n.text.slice(0,90))}</span><em>${(n.choices || []).length} choices · ${(n.effects || []).length} effects</em></button><button class="graph-port" type="button" data-port="output" aria-label="Connect ${esc(n.title || 'moment')} to another moment" title="Drag to connect"></button></div>`;}).join('');
    $('.graph-count',this.host).textContent=`${Math.round(v.zoom*100)}% · ${this.index.story.nodes.length.toLocaleString()} moments${visible.total>visible.detailLimit?' · Zoom in to see all cards':''}`;
  }
  destroy(){this.events.abort();this.observer.disconnect();this.host.innerHTML='';}
}
