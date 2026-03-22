import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function SimpleTerminal(){
  const termRef=(0,o.useRef)(null);
  const wsRef=(0,o.useRef)(null);
  const xtermRef=(0,o.useRef)(null);
  const fitRef=(0,o.useRef)(null);
  const[connected,setConnected]=(0,o.useState)(false);

  (0,o.useEffect)(()=>{
    if(!termRef.current) return;

    // Load xterm dynamically
    const loadXterm=async()=>{
      // Create terminal via API
      const resp=await fetch('/api/terminal/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cwd:'/home/claude'})});
      const{id}=await resp.json();

      // Import xterm
      const{Terminal}=await import('https://cdn.jsdelivr.net/npm/xterm@5.3.0/+esm');
      const{FitAddon}=await import('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/+esm');

      const term=new Terminal({
        cursorBlink:true,fontSize:13,
        fontFamily:"'JetBrains Mono','Fira Code',monospace",
        theme:{background:'#0a0e17',foreground:'#e0e6f0',cursor:'#00e5cc',selectionBackground:'#00e5cc33'},
      });
      const fit=new FitAddon();
      term.loadAddon(fit);
      term.open(termRef.current);
      fit.fit();
      xtermRef.current=term;
      fitRef.current=fit;

      // Connect WebSocket
      const ws=new WebSocket('ws://'+window.location.host+'/ws');
      wsRef.current=ws;

      ws.onopen=()=>{
        ws.send(JSON.stringify({type:'raw-attach',terminalId:id}));
        setConnected(true);
        setTimeout(()=>fit.fit(),300);
      };

      ws.onmessage=(ev)=>{
        try{
          const msg=JSON.parse(ev.data);
          if(msg.type==='output') term.write(msg.data);
        }catch{}
      };

      ws.onclose=()=>setConnected(false);

      term.onData((data)=>{
        if(ws.readyState===1) ws.send(JSON.stringify({type:'raw-input',terminalId:id,data}));
      });

      term.onResize(({cols,rows})=>{
        if(ws.readyState===1) ws.send(JSON.stringify({type:'raw-resize',terminalId:id,cols,rows}));
      });

      // Resize observer
      const ro=new ResizeObserver(()=>{try{fit.fit()}catch{}});
      ro.observe(termRef.current);
    };

    loadXterm().catch(console.error);

    return()=>{
      if(wsRef.current) wsRef.current.close();
      if(xtermRef.current) xtermRef.current.dispose();
    };
  },[]);

  const c=(0,t())
  return c.jsxs('div',{className:'flex flex-col h-full',style:{background:'#0a0e17'},children:[
    c.jsxs('div',{className:'shrink-0',style:{padding:'6px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
      c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'6px'},children:[
        c.jsx('span',{style:{fontSize:'12px',fontWeight:500,color:'#e0e0e0'},children:'Terminal'}),
        c.jsx('span',{style:{fontSize:'9px',color:'#888'},children:'bash @ agent-os'}),
      ]}),
      c.jsx('div',{style:{width:'6px',height:'6px',borderRadius:'50%',background:connected?'#4ade80':'#ff6b6b'}})
    ]}),
    c.jsx('div',{ref:termRef,className:'flex-1',style:{padding:'4px'}})
  ]});
}
export{SimpleTerminal as default};
