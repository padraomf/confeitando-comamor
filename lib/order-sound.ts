// Short cash-register clink, created locally with no audio download.
export function cashRegister(ctx:AudioContext,volume=.6){
 if(ctx.state!=='running')return false;
 const start=ctx.currentTime;
 for(const [offset,frequency,duration] of [[0,1800,.09],[.085,2400,.1],[.19,1318.51,.7],[.19,2637.02,.5]]){
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,start+offset);gain.gain.exponentialRampToValueAtTime(.13*volume,start+offset+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+offset+duration);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(start+offset);osc.stop(start+offset+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect()};
 }
 return true;
}

export function newOrderChime(ctx:AudioContext,volume=.6){if(ctx.state!=='running')return false;const now=ctx.currentTime;for(const [offset,freq]of [[0,523.25],[.2,659.25]]){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.0001,now+offset);g.gain.exponentialRampToValueAtTime(.15*volume,now+offset+.02);g.gain.exponentialRampToValueAtTime(.0001,now+offset+.35);o.connect(g);g.connect(ctx.destination);o.start(now+offset);o.stop(now+offset+.4);o.onended=()=>{o.disconnect();g.disconnect()}}return true}
