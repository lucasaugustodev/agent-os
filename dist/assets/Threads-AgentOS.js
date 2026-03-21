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

  (0,o.useEffect)(()=>{
    fetch('/api/threads?limit=50').then(r=>r.json()).then(d=>{setThreads(d);setLoading(false)}).catch(()=>setLoading(false));
    fetch('/api/db/agents').then(r=>r.json()).then(setAgents).catch(()=>{});
    const iv=setInterval(()=>{fetch('/api/threads?limit=50').then(r=>r.json()).then(setThreads).catch(()=>{})},8000);
    return()=>clearInterval(iv);
  },[]);

  (0,o.useEffect)(()=>{
    if(!selected){setEvents([]);setChatMessages([]);return}
    fetch(`/api/threads/${selected}/events`).then(r=>r.json()).then(evts=>{
      setEvents(evts);
      const msgs=[];
      for(const ev of evts){
        if(ev.type==='user_message') msgs.push({role:'user',text:ev.content,time:ev.created_at});
        else if(ev.type==='agent_summary'||ev.type==='agent_response'){
          const agentName=ev.agent_id==='coder'?'Claude Code':ev.agent_id==='sql'?'SQL Agent':ev.agent_id==='gestor'?'Gestor':ev.agent_id||'Agent';
          if(ev.type==='agent_summary'||(ev.type==='agent_response'&&!evts.find(e2=>e2.type==='agent_summary'&&Math.abs(new Date(e2.created_at)-new Date(ev.created_at))<30000))){
            msgs.push({role:'assistant',agent:agentName,text:ev.content,time:ev.created_at});
          }
        }
      }
      setChatMessages(msgs);
    }).catch(()=>{});
  },[selected]);

  (0,o.useEffect)(()=>{if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[chatMessages,statusText]);

  async function sendMessage(){
    const msg=inputText.trim();if(!msg||sending) return;
    setInputText('');setSending(true);setStatusText('Analisando...');
    setChatMessages(prev=>[...prev,{role:'user',text:msg,time:new Date().toISOString()}]);
    try{
      const resp=await fetch('/api/smol/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,stream:true,threadId:selected})});
      const reader=resp.body?.getReader();if(!reader) throw new Error('No reader');
      const decoder=new TextDecoder();let buffer='',result='';
      while(true){const{done,value}=await reader.read();if(done) break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){if(!line.startsWith('data: ')) continue;const data=line.slice(6).trim();if(data==='[DONE]') continue;
          try{const ev=JSON.parse(data);if(ev.event==='status') setStatusText(ev.text||'Pensando...');else if(ev.event==='done'){result=ev.result||'';setStatusText('')}}catch{}}}
      if(result) setChatMessages(prev=>[...prev,{role:'assistant',agent:selectedAgent==='auto'?'Agent OS':agents.find(a=>a.id===selectedAgent)?.name||selectedAgent,text:result,time:new Date().toISOString()}]);
      fetch(`/api/threads/${selected}/events`).then(r=>r.json()).then(setEvents).catch(()=>{});
      fetch('/api/threads?limit=50').then(r=>r.json()).then(setThreads).catch(()=>{});
    }catch(err){setChatMessages(prev=>[...prev,{role:'system',text:'Erro: '+err.message,time:new Date().toISOString()}])}
    setSending(false);setStatusText('');
  }

  const sColor=s=>s==='active'?'#00e5cc':'#666';
  const tIcon=t=>({user_message:'\u{1F4AC}',routing:'\u{1F500}',agent_intro:'\u{1F916}',agent_response:'\u{2705}',agent_summary:'\u{1F4DD}',tool_call:'\u{26A1}',error:'\u{274C}',file_created:'\u{1F4C4}'}[t]||'\u{2022}');
  const tColor=t=>({user_message:'rgba(0,229,204,0.15)',routing:'rgba(147,130,255,0.12)',tool_call:'rgba(255,184,77,0.15)',error:'rgba(255,77,77,0.15)'}[t]||'rgba(255,255,255,0.04)');

  const c=(0,t())
  // Use flex flex-col h-full exactly like SmolChat
  return c.jsx('div',{className:'flex flex-col h-full',style:{background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:
    c.jsxs('div',{className:'flex flex-1 overflow-hidden',children:[
      // LEFT: thread list
      c.jsxs('div',{className:'flex flex-col shrink-0',style:{width:'260px',borderRight:'1px solid rgba(255,255,255,0.06)'},children:[
        c.jsx('div',{className:'shrink-0',style:{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:'13px',fontWeight:600,color:'#00e5cc'},children:'Threads'}),
        c.jsx('div',{className:'flex-1 overflow-y-auto',children:
          loading?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#666',fontSize:'12px'},children:'Carregando...'}):
          threads.length===0?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#666',fontSize:'12px'},children:'Nenhuma thread ainda.'}):
          threads.map(th=>c.jsxs('div',{key:th.id,onClick:()=>{setSelected(th.id);setChatMode(false)},style:{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.04)',background:selected===th.id?'rgba(0,229,204,0.08)':'transparent',borderLeft:selected===th.id?'2px solid #00e5cc':'2px solid transparent'},children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'},children:[
              c.jsx('span',{style:{fontSize:'11px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'170px'},children:th.title}),
              c.jsx('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:sColor(th.status),flexShrink:0}})
            ]}),
            c.jsxs('div',{style:{display:'flex',gap:'6px',fontSize:'10px',color:'#888'},children:[
              c.jsx('span',{children:th.primary_agent_id||'gestor'}),
              c.jsx('span',{children:(th.event_count||0)+' ev'}),
              th.file_count>0&&c.jsx('span',{children:th.file_count+' arq'})
            ]})
          ]}))
        })
      ]}),
      // RIGHT: detail
      c.jsx('div',{className:'flex flex-col flex-1 overflow-hidden',children:
        !selected?
          c.jsxs('div',{style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#555'},children:[
            c.jsx('div',{style:{fontSize:'28px',marginBottom:'6px'},children:'\u{1F4CB}'}),
            c.jsx('div',{style:{fontSize:'12px'},children:'Selecione uma thread'})
          ]}):
          c.jsxs('div',{className:'flex flex-col h-full',children:[
            // Header + tabs (fixed height)
            c.jsxs('div',{className:'shrink-0',style:{padding:'8px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
              c.jsxs('div',{children:[
                c.jsx('div',{style:{fontSize:'12px',fontWeight:600},children:threads.find(t=>t.id===selected)?.title||'Thread'}),
                c.jsxs('div',{style:{fontSize:'10px',color:'#888'},children:[threads.find(t=>t.id===selected)?.primary_agent_id||'',' \u00B7 ',events.length,' eventos']})
              ]}),
              c.jsxs('div',{style:{display:'flex',gap:'3px'},children:[
                c.jsx('button',{onClick:()=>setChatMode(false),style:{background:!chatMode?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',border:'none',color:!chatMode?'#00e5cc':'#888',padding:'3px 10px',borderRadius:'4px',fontSize:'10px',cursor:'pointer'},children:'Timeline'}),
                c.jsx('button',{onClick:()=>setChatMode(true),style:{background:chatMode?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',border:'none',color:chatMode?'#00e5cc':'#888',padding:'3px 10px',borderRadius:'4px',fontSize:'10px',cursor:'pointer'},children:'Chat'})
              ]})
            ]}),
            // Content (scrollable, takes remaining space)
            chatMode?
              // CHAT
              c.jsxs('div',{className:'flex flex-col flex-1 overflow-hidden',children:[
                c.jsx('div',{ref:scrollRef,className:'flex-1 overflow-y-auto',style:{padding:'12px 16px'},children:
                  chatMessages.map((msg,i)=>c.jsx('div',{key:i,style:{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:'8px'},children:
                    c.jsxs('div',{style:{maxWidth:'75%',padding:'8px 12px',borderRadius:'14px',borderBottomRightRadius:msg.role==='user'?'4px':undefined,borderBottomLeftRadius:msg.role!=='user'?'4px':undefined,background:msg.role==='user'?'rgba(0,229,204,0.12)':'rgba(255,255,255,0.04)'},children:[
                      msg.role!=='user'&&c.jsx('div',{style:{fontSize:'10px',color:'#00e5cc',marginBottom:'3px',fontWeight:500},children:msg.agent||'Agent'}),
                      c.jsx('div',{style:{fontSize:'12px',lineHeight:1.4,whiteSpace:'pre-wrap',wordBreak:'break-word'},children:msg.text?.substring(0,1500)}),
                      c.jsx('div',{style:{fontSize:'9px',color:'#555',marginTop:'3px',textAlign:'right'},children:new Date(msg.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})})
                    ]})
                  }))
                }),
                sending&&c.jsx('div',{className:'shrink-0',style:{padding:'4px 16px'},children:
                  c.jsxs('div',{style:{display:'inline-flex',alignItems:'center',gap:'5px',padding:'5px 10px',borderRadius:'10px',background:'rgba(0,229,204,0.08)',border:'1px solid rgba(0,229,204,0.15)'},children:[
                    c.jsx('span',{style:{fontSize:'10px',color:'#00e5cc'},children:statusText||'Pensando...'})
                  ]})
                }),
                // Input + agent selector (fixed at bottom)
                c.jsxs('div',{className:'shrink-0',style:{padding:'8px 12px',borderTop:'1px solid rgba(255,255,255,0.06)'},children:[
                  c.jsxs('div',{style:{display:'flex',gap:'3px',marginBottom:'6px',flexWrap:'wrap'},children:[
                    c.jsx('button',{onClick:()=>setSelectedAgent('auto'),style:{padding:'2px 7px',borderRadius:'10px',border:'1px solid '+(selectedAgent==='auto'?'#00e5cc':'rgba(255,255,255,0.1)'),background:selectedAgent==='auto'?'rgba(0,229,204,0.12)':'transparent',color:selectedAgent==='auto'?'#00e5cc':'#888',fontSize:'9px',cursor:'pointer'},children:'Auto'}),
                    ...agents.map(a=>c.jsx('button',{key:a.id,onClick:()=>setSelectedAgent(a.id),style:{padding:'2px 7px',borderRadius:'10px',border:'1px solid '+(selectedAgent===a.id?'#00e5cc':'rgba(255,255,255,0.1)'),background:selectedAgent===a.id?'rgba(0,229,204,0.12)':'transparent',color:selectedAgent===a.id?'#00e5cc':'#888',fontSize:'9px',cursor:'pointer'},children:a.name}))
                  ]}),
                  c.jsxs('div',{style:{display:'flex',gap:'6px'},children:[
                    c.jsx('input',{type:'text',value:inputText,onChange:ev=>setInputText(ev.target.value),onKeyDown:ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();sendMessage()}},placeholder:'Continuar conversa...',disabled:sending,style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}}),
                    c.jsx('button',{onClick:sendMessage,disabled:sending||!inputText.trim(),style:{padding:'6px 12px',borderRadius:'6px',border:'none',background:inputText.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:inputText.trim()?'#0a0e17':'#666',fontSize:'11px',cursor:'pointer',fontWeight:500},children:'Enviar'})
                  ]})
                ]})
              ]}):
              // TIMELINE
              c.jsx('div',{className:'flex-1 overflow-y-auto',style:{padding:'12px 16px'},children:
                events.length===0?c.jsx('div',{style:{textAlign:'center',color:'#555',fontSize:'11px',padding:'20px'},children:'Sem eventos'}):
                c.jsxs('div',{children:[
                  events.map(ev=>c.jsxs('div',{key:ev.id,style:{padding:'8px 12px',marginBottom:'6px',borderRadius:'6px',background:tColor(ev.type),borderLeft:'3px solid '+(ev.type==='user_message'?'#00e5cc':ev.type==='routing'?'#9382ff':ev.type==='tool_call'?'#ffb84d':'rgba(255,255,255,0.1)')},children:[
                    c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'},children:[
                      c.jsxs('span',{style:{fontSize:'10px',fontWeight:500,color:'#ccc'},children:[tIcon(ev.type),' ',ev.type.replace(/_/g,' '),ev.agent_id?' \u00B7 '+ev.agent_id:'']}),
                      c.jsx('span',{style:{fontSize:'9px',color:'#666'},children:new Date(ev.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})})
                    ]}),
                    ev.content&&c.jsx('div',{style:{fontSize:'11px',color:'#ddd',whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:'150px',overflow:'auto',lineHeight:1.4},children:ev.content.substring(0,800)}),
                    ev.metadata&&ev.metadata!=='{}'&&c.jsx('details',{style:{marginTop:'3px'},children:c.jsxs('div',{children:[c.jsx('summary',{style:{fontSize:'9px',color:'#666',cursor:'pointer'},children:'metadata'}),c.jsx('pre',{style:{fontSize:'8px',color:'#888',marginTop:'3px',background:'rgba(0,0,0,0.3)',padding:'4px',borderRadius:'3px',overflow:'auto',maxHeight:'80px'},children:JSON.stringify(JSON.parse(ev.metadata||'{}'),null,2)})]})})
                  ]})),
                  c.jsx('div',{style:{textAlign:'center',padding:'12px'},children:
                    c.jsx('button',{onClick:()=>setChatMode(true),style:{padding:'6px 16px',borderRadius:'6px',border:'1px solid rgba(0,229,204,0.3)',background:'rgba(0,229,204,0.08)',color:'#00e5cc',fontSize:'11px',cursor:'pointer'},children:'Abrir Chat nesta Thread'})
                  })
                ]})
              })
          ]})
      })
    ]})
  });
}
export{Threads as default};
