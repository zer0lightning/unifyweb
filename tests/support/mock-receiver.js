// Simulated WebHID: a Unifying receiver with an HID++ 4.5 mouse in slot 1. Injected into the page by the e2e tests.
// Exposes window.__mock for assertions (device state, memory, writes).
// Fake WebHID: a Unifying receiver with an HID++ 4.5 mouse in slot 1.
(() => {
  const S = window.__mock = { regs: {}, slots: {}, sent: [] };
  const FEATS = [0x0000,0x0001,0x0003,0x0005,0x1004,0x2201,0x2121,0x2111,0x1b04,0x1814,0x2150,0x8100,0x8070,0x1982,0x8040];
  function crc(a){let c=0xffff;for(const x of a){c^=x<<8;for(let i=0;i<8;i++)c=c&0x8000?((c<<1)^0x1021)&0xffff:(c<<1)&0xffff;}return c;}
  S.crc=crc;
  function mkProfile(name,dpis){ const b=new Array(255).fill(0xff); b[0]=1;b[1]=1;b[2]=0; dpis.forEach((v,i)=>{b[3+2*i]=v&255;b[4+2*i]=v>>8;}); for(let i=dpis.length;i<5;i++){b[3+2*i]=0;b[4+2*i]=0;}
    b[13]=0;b[14]=0x80;b[15]=0xff; const btns=[[0x80,1,0,1],[0x80,1,0,2],[0x80,1,0,4],[0x80,1,0,8],[0x80,1,0,16],[0x90,3,0,0],[0x90,4,0,0],[0x80,2,1,0x06]];
    btns.forEach((x,i)=>x.forEach((v,j)=>b[32+4*i+j]=v)); for(let i=0;i<48;i++) b[160+i]=0; [...name].forEach((ch,i)=>{b[160+2*i]=ch.charCodeAt(0);b[161+2*i]=0;});
    const c=crc(b.slice(0,253)); b[253]=c>>8; b[254]=c&255; return b; }
  S.mem = { 0x0000:new Array(255).fill(0xff), 0x0100:(()=>{const d=new Array(255).fill(0xff); d.splice(0,8,1,1,1,0,1,2,1,0); return d;})(), 0x0101:mkProfile('Default',[800,1600,3200]), 0x0102:mkProfile('Gaming',[400,800])};
  function mkMouse(name){ return { name, wpid:[0x40,0x82], online:true, dpi:1000, wheel:0x00, ss:[2,10,50], remap:{}, divert:{}, thumb:[0,0], active:0x0101, led:[], bl:[1,0x18,0x08,0,0,3,6,0,6,0,30,0], bright:80 }; }
  S.slots[1] = mkMouse('MX Master 3');
  const KEYS = [[0x0050,0x01,1,0,0],[0x0053,0x30,2,0x02,0],[0x0056,0x30,2,0x02,0],[0x00c3,0x30,3,0,1]];
  class Dev extends EventTarget {
    constructor(){ super(); this.vendorId=0x046d; this.productId=0xc52b; this.productName='USB Receiver'; this.opened=false;
      const r=[{reportId:0x10},{reportId:0x11}]; this.collections=[{usagePage:0xff00,usage:1,inputReports:r,outputReports:r}]; }
    async open(){ this.opened=true; } async close(){ this.opened=false; }
    emit(bytes){ const id = bytes.length>6?0x11:0x10; const len=id===0x11?19:6; const b=new Uint8Array(len); b.set(bytes.slice(0,len));
      setTimeout(()=>{ const e=new Event('inputreport'); e.reportId=id; e.data=new DataView(b.buffer); this.dispatchEvent(e); },5); }
    async sendReport(id, data){
      const b=Array.from(data); S.sent.push([id,...b]); const [d,s,a,...p]=b;
      const L = (...x)=>this.emit([d,s,a,...x,...Array(16).fill(0)].slice(0,19));
      const Sh = (...x)=>this.emit([d,s,a,...x,0,0,0].slice(0,6));
      const err10 = c=>this.emit([d,0x8f,s,a,c,0]);
      if (d===0xff){
        if (s===0x80 && a===0x00) return Sh(0,0,0);
        if (s===0x81 && a===0xf1) return p[0]===1?Sh(1,0x12,0x10):Sh(2,0x00,0x42);
        if (s===0x83 && a===0xb5){
          const q=p[0]; if (q===0x03) return L(3,0xaa,0xbb,0xcc,0xdd,0,6);
          const n=(q&0x0f)+1, m=S.slots[n]; if(!m) return err10(3);
          if ((q&0xf0)===0x20) return L(q,0,8,m.wpid[0],m.wpid[1],0,0,0x02);
          if ((q&0xf0)===0x30) return L(q,0x11,0x22,0x33,n);
          if ((q&0xf0)===0x40){ const c=[...m.name].map(x=>x.charCodeAt(0)); return L(q,c.length,...c); }
        }
        if (s===0x80 && a===0x02){ Sh(0,0,0); for(const n in S.slots){ const m=S.slots[n]; this.emit([+n,0x41,0x04,m.online?0:0x40,m.wpid[1],m.wpid[0]]); } return; }
        if (s===0x80 && a===0xb2){
          Sh(0,0,0);
          if (p[0]===1){ this.emit([0xff,0x4a,0x01,0,0,0]); setTimeout(()=>{ S.slots[2]=mkMouse('M720 Triathlon'); S.slots[2].wpid=[0x40,0x5e]; this.emit([2,0x41,0x04,0x00,0x5e,0x40]); setTimeout(()=>this.emit([0xff,0x4a,0x00,0,0,0]),200); },400); }
          if (p[0]===3){ delete S.slots[p[1]]; this.emit([p[1],0x40,0x02,0,0,0]); }
          return;
        }
        return err10(1);
      }
      const m=S.slots[d]; if(!m) return err10(8); if(!m.online) return err10(9);
      const fi=s, fn=a>>4, F=FEATS[fi];
      if (F===undefined) return this.emit([d,0xff,s,a,6,0,0,...Array(14).fill(0)]);
      if (F===0x0000){ if(fn===0){ const id=(p[0]<<8)|p[1]; const i=FEATS.indexOf(id); return L(i<0?0:i,0,0);} if(fn===1) return L(4,5,p[2]); }
      if (F===0x0001){ if(fn===0) return L(FEATS.length-1); if(fn===1){ const id=FEATS[p[0]]; return L(id>>8,id&0xff,0,0);} }
      if (F===0x0003){ if(fn===0) return L(1,1,2,3,4,0,0,0xb0,0x23,0,0,0,0); if(fn===1) return L(0,0x52,0x42,0x4d,0x12,0x03,0x00,0x15); }
      if (F===0x0005){ const c=[...m.name].map(x=>x.charCodeAt(0)); if(fn===0) return L(c.length); if(fn===1) return L(...c.slice(p[0],p[0]+16)); if(fn===2) return L(3); }
      if (F===0x1004 && fn===1) return L(80,4,0,0);
      if (F===0x2201){ if(fn===1) return L(0,0x00,0xc8,0xe0,0x32,0x0f,0xa0,0,0); if(fn===2) return L(0,m.dpi>>8,m.dpi&0xff,0x03,0xe8); if(fn===3){ m.dpi=(p[1]<<8)|p[2]; return L(...p);} }
      if (F===0x2121){ if(fn===1) return L(m.wheel); if(fn===2){ m.wheel=p[0]; return L(p[0]); } }
      if (F===0x2111){ if(fn===1) return L(...m.ss); if(fn===2){ p.slice(0,3).forEach((v,i)=>{ if(v) m.ss[i]=v; }); return L(...m.ss);} }
      if (F===0x1b04){ if(fn===0) return L(KEYS.length); if(fn===1){ const [c,f,g,gm,ad]=KEYS[p[0]]; return L(c>>8,c&0xff,0,0,f,0,g,gm,ad); }
        if(fn===2){ const c=(p[0]<<8)|p[1]; const r=m.remap[c]||0; return L(p[0],p[1],m.divert[c]||0,r>>8,r&0xff); }
        if(fn===3){ const c=(p[0]<<8)|p[1]; const t=(p[3]<<8)|p[4]; const fl=p[2];
          if (fl&0x02) m.divert[c] = (m.divert[c]||0) & ~1 | (fl&1);
          if (fl&0x20) m.divert[c] = (m.divert[c]||0) & ~0x10 | (fl&0x10);
          if (t) m.remap[c]=t===c?0:t; return L(...p.slice(0,5)); } }
      if (F===0x2150){ if(fn===1) return L(...m.thumb); if(fn===2){ m.thumb=[p[0],p[1]]; return L(p[0],p[1]); } }
      if (F===0x8100){
        if(fn===0) return L(1,1,1,2,0,8,16,0x00,0xff,0,0);
        if(fn===2) return L(1); if(fn===1) return L(p[0]);
        if(fn===4) return L(m.active>>8,m.active&255); if(fn===3){ m.active=(p[0]<<8)|p[1]; return L(); }
        if(fn===5){ const sec=(p[0]<<8)|p[1], off=(p[2]<<8)|p[3]; const mem=S.mem[sec]; if(!mem) return this.emit([d,0xff,s,a,2,0,0,...Array(14).fill(0)]); return L(...mem.slice(off,off+16)); }
        if(fn===6){ S.w={sec:(p[0]<<8)|p[1], size:(p[4]<<8)|p[5], buf:[]}; return L(); }
        if(fn===7){ S.w.buf.push(...p.slice(0,16)); return L(); }
        if(fn===8){ S.mem[S.w.sec]=S.w.buf.slice(0,S.w.size); S.writes=(S.writes||[]).concat(S.w.sec); return L(0); }
      }
      if (F===0x8070){ const ids=[0,1,3,0x0a];
        if(fn===0) return L(1); if(fn===1) return L(p[0],0,1,ids.length); if(fn===2) return L(p[0],p[1],0,ids[p[1]],0,0,0x13,0x88);
        if(fn===3){ m.led.push(p.slice(0,13)); return L(); } }
      if (F===0x1982){ if(fn===0) return L(...m.bl); if(fn===1){ m.bl=[p[0],p[1],m.bl[2],0,0,p[3],p[4],p[5],p[6],p[7],p[8],p[9]]; return L(); } if(fn===2) return L(5); }
      if (F===0x8040){ if(fn===0) return L(0,100,0,0); if(fn===1) return L(0,m.bright); if(fn===2){ m.bright=p[1]; return L(); } }
      if (F===0x1814 && fn===0) return L(3,0,0);
      return this.emit([d,0xff,s,a,7,0,0,...Array(14).fill(0)]);
    }
  }
  const rx = new Dev(); S.rx = rx; S.FEATS = FEATS; let granted=false;
  const hid = new EventTarget();
  hid.getDevices = async()=> granted?[rx]:[];
  hid.requestDevice = async()=>{ granted=true; return [rx]; };
  Object.defineProperty(navigator,'hid',{value:hid});
})();
