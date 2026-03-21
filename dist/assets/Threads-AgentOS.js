import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function Threads(){
  const[threads,setThreads]=(0,o.useState)([]);
  const[selected,setSelected]=(0,o.useState)(null);
  const[events,setEvents]=(0,o.useState)([]);
  const[chatMode,setChatMode]=(0,o.useState)(false);
  const[chatMessages,setChatMessages]=(0,o.useState)([]);
  const[inputText,setInputText]=(0,o.useState)('');
  const[sending,setSending]=(0,o.useState)(false);
  const[statusText,setStatusText]=(0,o.useState)('');
  const[agents,setAgents]=(0,o.useState)([]);
  const[selectedAgent,setSelectedAgent]=(0,o.useState)('auto');
  const[loading,setLoading]=(0,o.useState)(true);
  const scrollRef=(0,o.useRef)(null);

  // Load threads
  (0,o.useEffect)(()=>{
    fetch('/api/threads?limit=50').then(r=>r.json()).then(d=>{setThreads(d);setLoading(false)}).catch(()=>setLoading(false));
    fetch('/api/db/agents').then(r=>r.json()).then(setAgents).catch(()=>{});
    const iv=setInterval(()=>{fetch('/api/threads?limit=50').then(r=>r.json()).then(setThreads).catch(()=>{})},8000);
    return()=>clearInterval(iv);
  },[]);

  // Load events when thread selected
  (0,o.useEffect)(()=>{
    if(!selected){setEvents([]);setChatMessages([]);return}
    fetch(`/api/threads/${selected}/events`).then(r=>r.json()).then(evts=>{
      setEvents(evts);
      // Build chat messages from events (filter only user/assistant messages)
      const msgs=[];
      for(const ev of evts){
        if(ev.type==='user_message') msgs.push({role:'user',text:ev.content,time:ev.created_at});
        else if(ev.type==='agent_summary'||ev.type==='agent_response'){
          const agentName=ev.agent_id==='coder'?'Claude Code':ev.agent_id==='sql'?'SQL Agent':ev.agent_id==='gestor'?'Gestor':ev.agent_id||'Agent';
          // Prefer summary over raw response
          if(ev.type==='agent_summary'||(ev.type==='agent_response'&&!evts.find(e2=>e2.type==='agent_summary'&&Math.abs(new Date(e2.created_at)-new Date(ev.created_at))<30000))){
            msgs.push({role:'assistant',agent:agentName,text:ev.content,time:ev.created_at});
          }
        }
      }
      setChatMessages(msgs);
    }).catch(()=>{});
  },[selected]);

  // Auto-scroll
  (0,o.useEffect)(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[chatMessages,statusText]);

  // Send message in thread
  async function sendMessage(){
    const msg=inputText.trim();
    if(!msg||sending) return;
    setInputText('');
    setSending(true);
    setStatusText('Analisando...');
    setChatMessages(prev=>[...prev,{role:'user',text:msg,time:new Date().toISOString()}]);

    try{
      const resp=await fetch('/api/smol/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:msg,stream:true,threadId:selected}),
      });
      const reader=resp.body?.getReader();
      if(!reader) throw new Error('No reader');
      const decoder=new TextDecoder();
      let buffer='',result='';
      while(true){
        const{done,value}=await reader.read();
        if(done) break;
        buffer+=decoder.decode(value,{stream:true});
        const lines=buffer.split('\n');
        buffer=lines.pop()||'';
        for(const line of lines){
          if(!line.startsWith('data: ')) continue;
          const data=line.slice(6).trim();
          if(data==='[DONE]') continue;
          try{
            const ev=JSON.parse(data);
            if(ev.event==='status') setStatusText(ev.text||'Pensando...');
            else if(ev.event==='tool_call') setStatusText('⚡ '+ev.tool);
            else if(ev.event==='done'){result=ev.result||'';setStatusText('')}
          }catch{}
        }
      }
      if(result){
        setChatMessages(prev=>[...prev,{role:'assistant',agent:selectedAgent==='auto'?'Agent OS':agents.find(a=>a.id===selectedAgent)?.name||selectedAgent,text:result,time:new Date().toISOString()}]);
      }
      // Refresh events
      fetch(`/api/threads/${selected}/events`).then(r=>r.json()).then(setEvents).catch(()=>{});
      fetch('/api/threads?limit=50').then(r=>r.json()).then(setThreads).catch(()=>{});
    }catch(err){
      setChatMessages(prev=>[...prev,{role:'system',text:'Erro: '+err.message,time:new Date().toISOString()}]);
    }
    setSending(false);
    setStatusText('');
  }

  const statusColor=(s)=>s==='active'?'#00e5cc':s==='completed'?'#666':'#444';
  const typeIcon=(t)=>({user_message:'💬',routing:'🔀',agent_intro:'🤖',agent_response:'✅',agent_summary:'📝',tool_call:'⚡',error:'❌',file_created:'📄'}[t]||'•');
  const typeColor=(t)=>({user_message:'rgba(0,229,204,0.15)',routing:'rgba(147,130,255,0.12)',tool_call:'rgba(255,184,77,0.15)',error:'rgba(255,77,77,0.15)'}[t]||'rgba(255,255,255,0.04)');

  const c=(0,t())
  return c.jsxs('div',{style:{display:'flex',height:'100%',background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:[
    // Left panel - thread list
    c.jsxs('div',{style:{width:'280px',borderRight:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column'},children:[
      c.jsx('div',{style:{padding:'16px',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:'13px',fontWeight:600,color:'var(--os-accent,#00e5cc)'},children:'Threads'}),
      c.jsx('div',{style:{flex:1,overflowY:'auto'},children:
        loading?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#666',fontSize:'12px'},children:'Carregando...'}):
        threads.length===0?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#666',fontSize:'12px'},children:'Nenhuma thread ainda. Mande algo no Agent OS.'}):
        threads.map(t=>c.jsxs('div',{
          key:t.id,
          onClick:()=>{setSelected(t.id);setChatMode(false)},
          style:{padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.04)',background:selected===t.id?'rgba(0,229,204,0.08)':'transparent',borderLeft:selected===t.id?'2px solid #00e5cc':'2px solid transparent'},
          children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'},children:[
              c.jsx('span',{style:{fontSize:'12px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'180px'},children:t.title}),
              c.jsx('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:statusColor(t.status),flexShrink:0}})
            ]}),
            c.jsxs('div',{style:{display:'flex',gap:'8px',fontSize:'10px',color:'#888'},children:[
              c.jsx('span',{children:t.primary_agent_id||'gestor'}),
              c.jsx('span',{children:`${t.event_count||0} eventos`}),
              t.file_count>0&&c.jsx('span',{children:`${t.file_count} arq`})
            ]}),
            c.jsx('div',{style:{fontSize:'10px',color:'#555',marginTop:'2px'},children:new Date(t.created_at).toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})})
          ]
        }))
      })
    ]}),
    // Right panel
    c.jsx('div',{style:{flex:1,display:'flex',flexDirection:'column'},children:
      !selected?
        c.jsxs('div',{style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#555'},children:[
          c.jsx('div',{style:{fontSize:'32px',marginBottom:'8px'},children:'📋'}),
          c.jsx('div',{style:{fontSize:'13px'},children:'Selecione uma thread'}),
          c.jsx('div',{style:{fontSize:'11px',color:'#444',marginTop:'4px'},children:'para ver o historico ou continuar a conversa'})
        ]}):
        c.jsxs('div',{style:{flex:1,display:'flex',flexDirection:'column'},children:[
          // Thread header with tabs
          c.jsxs('div',{style:{padding:'10px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
            c.jsxs('div',{children:[
              c.jsx('div',{style:{fontSize:'13px',fontWeight:600},children:threads.find(t=>t.id===selected)?.title||'Thread'}),
              c.jsxs('div',{style:{fontSize:'10px',color:'#888',marginTop:'2px'},children:[threads.find(t=>t.id===selected)?.primary_agent_id||'',' · ',events.length,' eventos']})
            ]}),
            c.jsxs('div',{style:{display:'flex',gap:'4px'},children:[
              c.jsx('button',{onClick:()=>setChatMode(false),style:{background:!chatMode?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',border:'none',color:!chatMode?'#00e5cc':'#888',padding:'4px 12px',borderRadius:'4px',fontSize:'11px',cursor:'pointer',fontWeight:500},children:'Timeline'}),
              c.jsx('button',{onClick:()=>setChatMode(true),style:{background:chatMode?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',border:'none',color:chatMode?'#00e5cc':'#888',padding:'4px 12px',borderRadius:'4px',fontSize:'11px',cursor:'pointer',fontWeight:500},children:'Chat'}),
            ]})
          ]}),
          // Content area
          chatMode?
            // CHAT MODE - clean messages + input
            c.jsxs('div',{style:{flex:1,display:'flex',flexDirection:'column'},children:[
              c.jsx('div',{ref:scrollRef,style:{flex:1,overflowY:'auto',padding:'16px 20px'},children:
                chatMessages.map((msg,i)=>c.jsx('div',{key:i,style:{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:'10px'},children:
                  c.jsxs('div',{style:{maxWidth:'75%',padding:'10px 14px',borderRadius:'16px',borderBottomRightRadius:msg.role==='user'?'4px':undefined,borderBottomLeftRadius:msg.role!=='user'?'4px':undefined,background:msg.role==='user'?'rgba(0,229,204,0.12)':msg.role==='system'?'rgba(255,184,77,0.1)':'rgba(255,255,255,0.04)'},children:[
                    msg.role!=='user'&&c.jsx('div',{style:{fontSize:'10px',color:'#00e5cc',marginBottom:'4px',fontWeight:500},children:msg.agent||'Agent'}),
                    c.jsx('div',{style:{fontSize:'12px',lineHeight:1.5,whiteSpace:'pre-wrap',wordBreak:'break-word',color:msg.role==='system'?'#ffb84d':'#e0e0e0'},children:msg.text?.substring(0,2000)}),
                    c.jsx('div',{style:{fontSize:'9px',color:'#555',marginTop:'4px',textAlign:'right'},children:new Date(msg.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})})
                  ]})
                }))
              }),
              // Status indicator
              sending&&c.jsx('div',{style:{padding:'4px 20px'},children:
                c.jsxs('div',{style:{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 12px',borderRadius:'12px',background:'rgba(0,229,204,0.08)',border:'1px solid rgba(0,229,204,0.15)'},children:[
                  c.jsx('div',{style:{width:'8px',height:'8px',borderRadius:'50%',border:'2px solid #00e5cc',borderTopColor:'transparent',animation:'spin 1s linear infinite'}}),
                  c.jsx('span',{style:{fontSize:'11px',color:'#00e5cc'},children:statusText||'Pensando...'})
                ]})
              }),
              // Input area with agent selector
              c.jsxs('div',{style:{padding:'10px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',gap:'6px'},children:[
                // Agent selector
                c.jsxs('div',{style:{display:'flex',gap:'4px',flexWrap:'wrap'},children:[
                  c.jsx('button',{onClick:()=>setSelectedAgent('auto'),style:{padding:'2px 8px',borderRadius:'10px',border:'1px solid '+(selectedAgent==='auto'?'#00e5cc':'rgba(255,255,255,0.1)'),background:selectedAgent==='auto'?'rgba(0,229,204,0.12)':'transparent',color:selectedAgent==='auto'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Auto'}),
                  ...agents.map(a=>c.jsx('button',{key:a.id,onClick:()=>setSelectedAgent(a.id),style:{padding:'2px 8px',borderRadius:'10px',border:'1px solid '+(selectedAgent===a.id?'#00e5cc':'rgba(255,255,255,0.1)'),background:selectedAgent===a.id?'rgba(0,229,204,0.12)':'transparent',color:selectedAgent===a.id?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:a.name}))
                ]}),
                // Input
                c.jsxs('div',{style:{display:'flex',gap:'8px',alignItems:'center'},children:[
                  c.jsx('input',{type:'text',value:inputText,onChange:e=>setInputText(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}},placeholder:'Continuar conversa nesta thread...',disabled:sending,style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',padding:'8px 12px',color:'#e0e0e0',fontSize:'12px',outline:'none'}}),
                  c.jsx('button',{onClick:sendMessage,disabled:sending||!inputText.trim(),style:{padding:'8px 16px',borderRadius:'8px',border:'none',background:inputText.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:inputText.trim()?'#0a0e17':'#666',fontSize:'12px',cursor:'pointer',fontWeight:500},children:'Enviar'})
                ]})
              ]})
            ]}):
            // TIMELINE MODE - all events with details
            c.jsx('div',{style:{flex:1,overflowY:'auto',padding:'16px 20px'},children:
              events.length===0?
                c.jsx('div',{style:{textAlign:'center',color:'#555',fontSize:'12px',padding:'20px'},children:'Sem eventos'}):
                c.jsxs('div',{children:[
                  events.map(ev=>c.jsxs('div',{
                    key:ev.id,
                    style:{padding:'10px 14px',marginBottom:'8px',borderRadius:'8px',background:typeColor(ev.type),borderLeft:`3px solid ${ev.type==='user_message'?'#00e5cc':ev.type==='routing'?'#9382ff':ev.type==='tool_call'?'#ffb84d':ev.type==='error'?'#ff4d4d':'rgba(255,255,255,0.1)'}`},
                    children:[
                      c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'},children:[
                        c.jsxs('span',{style:{fontSize:'11px',fontWeight:500,color:'#ccc'},children:[typeIcon(ev.type),' ',ev.type.replace(/_/g,' '),ev.agent_id?' · '+ev.agent_id:'']}),
                        c.jsx('span',{style:{fontSize:'9px',color:'#666'},children:new Date(ev.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})})
                      ]}),
                      ev.content&&c.jsx('div',{style:{fontSize:'12px',color:'#ddd',whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:'200px',overflow:'auto',lineHeight:1.5},children:ev.content.substring(0,1000)}),
                      ev.metadata&&ev.metadata!=='{}'&&c.jsx('details',{style:{marginTop:'4px'},children:c.jsxs('div',{children:[
                        c.jsx('summary',{style:{fontSize:'10px',color:'#666',cursor:'pointer'},children:'metadata'}),
                        c.jsx('pre',{style:{fontSize:'9px',color:'#888',marginTop:'4px',background:'rgba(0,0,0,0.3)',padding:'6px',borderRadius:'4px',overflow:'auto',maxHeight:'100px'},children:JSON.stringify(JSON.parse(ev.metadata||'{}'),null,2)})
                      ]})})
                    ]
                  })),
                  // Open Chat button at bottom of timeline
                  c.jsx('div',{style:{textAlign:'center',padding:'16px'},children:
                    c.jsx('button',{onClick:()=>setChatMode(true),style:{padding:'8px 20px',borderRadius:'8px',border:'1px solid rgba(0,229,204,0.3)',background:'rgba(0,229,204,0.08)',color:'#00e5cc',fontSize:'12px',cursor:'pointer',fontWeight:500},children:'Abrir Chat nesta Thread'})
                  })
                ]})
            })
        ]})
    })
  ]});
}
export{Threads as default};
