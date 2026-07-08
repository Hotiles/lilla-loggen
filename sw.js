const CACHE='lillaloggen-v26';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-180.png'];
// Ingen automatisk self.skipWaiting() här – en ny version ska stanna i
// "waiting"-läge tills appen (checkUpdate) explicit ber om aktivering via
// postMessage. Annars kan uppdateringar tysta ta över sidan i bakgrunden.
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>{
    if(r)return r;
    return fetch(e.request).then(resp=>{
      const copy=resp.clone();
      e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));
      return resp;
    }).catch(()=>caches.match('./index.html'));
  }));
});
