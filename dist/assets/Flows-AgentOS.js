import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function Flows(){
  const[flows,setFlows]=(0,o.useState)([]);
  const[templates,setTemplates]=(0,o.useState)([]);
  const[selected,setSelected]=(0,o.useState)(null);
  const[selectedFlow,setSelectedFlow]=(0,o.useState)(null);
  const[showCreate,setShowCreate]=(0,o.useState)(false);
  const[newInput,setNewInput]=(0,o.useState)('');
  const[newTemplate,setNewTemplate]=(0,o.useState)('');
  const[threadEvents,setThreadEvents]=(0,o.useState)([]);
  const[viewMode,setViewMode]=(0,o.useState)('kanban'); // kanban or thread
  const[chatOpen,setChatOpen]=(0,o.useState)(false);
  const[chatInput,setChatInput]=(0,o.useState)('');
  const[chatMessages,setChatMessages]=(0,o.useState)([]);
  const[chatSending,setChatSending]=(0,o.useState)(false);
  const chatRef=(0,o.useRef)(null);
  const[loading,setLoading]=(0,o.useState)(true);

  const columns=[
    {id:'backlog',label:'Backlog',color:'#888'},
    {id:'running',label:'Running',color:'#00e5cc'},
    {id:'paused',label:'Paused',color:'#ffb84d'},
    {id:'completed',label:'Done',color:'#4ade80'},
    {id:'failed',label:'Failed',color:'#ff6b6b'},
  ];

  (0,o.useEffect)(()=>{loadData();const iv=setInterval(loadData,5000);return()=>clearInterval(iv)},[]);
  // Auto-poll thread events when viewing running flow
  (0,o.useEffect)(()=>{
    if(!selectedFlow?.thread_id) return;
    const pollThread=()=>{fetch('/api/threads/'+selectedFlow.thread_id+'/events').then(r=>r.json()).then(setThreadEvents).catch(()=>{})};
    pollThread();
    const iv2=setInterval(pollThread,3000);
    return()=>clearInterval(iv2);
  },[selectedFlow?.thread_id,viewMode]);
  (0,o.useEffect)(()=>{if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight},[chatMessages]);

  function loadData(){
    Promise.all([fetch('/api/flows').then(r=>r.json()),fetch('/api/flow-templates').then(r=>r.json())])
    .then(([f,t])=>{setFlows(f);setTemplates(t);setLoading(false);
      // Refresh selected flow
      if(selected){const upd=f.find(x=>x.id===selected);if(upd&&selectedFlow){
        fetch('/api/flows/'+selected).then(r=>r.json()).then(setSelectedFlow).catch(()=>{})}}
    }).catch(()=>setLoading(false));
  }

  function selectFlow(f){
    setSelected(f.id);setViewMode('kanban');
    fetch('/api/flows/'+f.id).then(r=>r.json()).then(d=>{setSelectedFlow(d);
      if(d.thread_id) fetch('/api/threads/'+d.thread_id+'/events').then(r=>r.json()).then(setThreadEvents).catch(()=>{})
    }).catch(()=>{});
  }

  function openThread(){
    if(!selectedFlow?.thread_id) return;
    setViewMode('thread');
    fetch('/api/threads/'+selectedFlow.thread_id+'/events').then(r=>r.json()).then(setThreadEvents).catch(()=>{});
  }

  async function createFlow(){
    if(!newTemplate||!newInput.trim()) return;
    await fetch('/api/flows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template_id:newTemplate,input:newInput})});
    setShowCreate(false);setNewInput('');setNewTemplate('');loadData();
  }

  async function startFlow(id){
    await fetch('/api/flows/'+id+'/start',{method:'POST'});
    setChatOpen(true);
    setChatMessages(prev=>[...prev,{role:'assistant',text:'Flow iniciado! Vou monitorar a execucao...'}]);
    // Start monitoring
    const monitorId=setInterval(async()=>{
      try{
        const resp=await fetch('/api/flows/'+id);
        const f=await resp.json();
        const runningStep=(f.steps||[]).find(s=>s.status==='running');
        if(runningStep){
          setChatMessages(prev=>{
            const last=prev[prev.length-1];
            if(last?.text?.includes(runningStep.name)) return prev;
            return[...prev,{role:'assistant',text:'Etapa '+(runningStep.step_index+1)+'/'+f.total_steps+': '+runningStep.name+' (@'+agentLabel(runningStep.agent_id)+') em andamento...'}];
          });
        }
        if(f.status==='completed'){
          clearInterval(monitorId);
          setChatMessages(prev=>[...prev,{role:'assistant',text:'Flow concluido com sucesso! Todas as '+f.total_steps+' etapas foram executadas.'}]);
          loadData();
        }
        if(f.status==='failed'){
          clearInterval(monitorId);
          setChatMessages(prev=>[...prev,{role:'assistant',text:'Flow falhou: '+(f.output||'erro desconhecido')}]);
          loadData();
        }
      }catch{}
    },4000);
    loadData();
  }
  async function cancelFlow(id){await fetch('/api/flows/'+id+'/cancel',{method:'POST'});loadData()}

  async function sendChat(){
    const msg=chatInput.trim();if(!msg||chatSending) return;
    setChatInput('');setChatSending(true);
    setChatMessages(prev=>[...prev,{role:'user',text:msg}]);
    try{
      const resp=await fetch('/api/smol/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Sobre o flow "'+selectedFlow?.name+'": '+msg,stream:true,threadId:selectedFlow?.thread_id})});
      const reader=resp.body?.getReader();const decoder=new TextDecoder();let buffer='',result='';
      while(true){const{done,value}=await reader.read();if(done) break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){if(!line.startsWith('data: ')) continue;const data=line.slice(6).trim();if(data==='[DONE]') continue;
          try{const ev=JSON.parse(data);if(ev.event==='done') result=ev.result||''}catch{}}}
      if(result) setChatMessages(prev=>[...prev,{role:'assistant',text:result}]);
    }catch(err){setChatMessages(prev=>[...prev,{role:'system',text:'Erro: '+err.message}])}
    setChatSending(false);
  }

  const statusDot=s=>({backlog:'#888',running:'#00e5cc',paused:'#ffb84d',completed:'#4ade80',failed:'#ff6b6b',cancelled:'#666'}[s]||'#888');
  const agentLabel=a=>({coder:'Claude Code',sql:'SQL Agent',gestor:'Gestor'}[a]||a||'');
  const tIcon=t=>({user_message:'\u{1F4AC}',routing:'\u{1F500}',agent_response:'\u{2705}',status:'\u{1F4CA}',error:'\u{274C}',tool_call:'\u{26A1}'}[t]||'\u{2022}');

  // Find current agent for running flows
  function getCurrentAgent(f){
    if(f.status!=='running') return null;
    const steps=selectedFlow?.steps||[];
    const running=steps.find(s=>s.status==='running');
    return running?.agent_id||null;
  }

  const c=(0,t())
  return c.jsx('div',{className:'flex flex-col h-full',style:{background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:
    c.jsxs('div',{className:'flex h-full overflow-hidden',children:[
      // MAIN
      c.jsxs('div',{className:'flex flex-col flex-1 overflow-hidden',children:[
        // Header
        c.jsxs('div',{className:'shrink-0',style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
          c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'8px'},children:[
            c.jsx('span',{style:{fontSize:'13px',fontWeight:600,color:'#00e5cc'},children:'Flows'}),
            c.jsx('span',{style:{fontSize:'10px',color:'#888'},children:flows.length+' flows'})
          ]}),
          c.jsxs('div',{style:{display:'flex',gap:'4px'},children:[
            selected&&c.jsxs('div',{style:{display:'flex',gap:'3px'},children:[
              c.jsx('button',{onClick:()=>setViewMode('kanban'),style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:viewMode==='kanban'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:viewMode==='kanban'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Kanban'}),
              c.jsx('button',{onClick:openThread,style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:viewMode==='thread'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:viewMode==='thread'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Thread'}),
            ]}),
            c.jsx('button',{onClick:()=>setShowCreate(!showCreate),style:{padding:'4px 12px',borderRadius:'6px',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',fontSize:'11px',cursor:'pointer',fontWeight:500},children:showCreate?'Cancelar':'+ Novo Flow'})
          ]})
        ]}),
        // Create form
        showCreate&&c.jsxs('div',{className:'shrink-0',style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,229,204,0.03)'},children:[
          c.jsxs('div',{style:{display:'flex',gap:'4px',marginBottom:'6px',flexWrap:'wrap'},children:
            templates.map(t=>c.jsx('button',{key:t.id,onClick:()=>setNewTemplate(t.id),style:{padding:'3px 8px',borderRadius:'10px',border:'1px solid '+(newTemplate===t.id?'#00e5cc':'rgba(255,255,255,0.1)'),background:newTemplate===t.id?'rgba(0,229,204,0.12)':'transparent',color:newTemplate===t.id?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:t.name}))
          }),
          c.jsxs('div',{style:{display:'flex',gap:'6px'},children:[
            c.jsx('input',{type:'text',value:newInput,onChange:ev=>setNewInput(ev.target.value),onKeyDown:ev=>{if(ev.key==='Enter') createFlow()},placeholder:'Descreva o que quer fazer...',style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}}),
            c.jsx('button',{onClick:createFlow,disabled:!newTemplate||!newInput.trim(),style:{padding:'6px 14px',borderRadius:'6px',border:'none',background:newTemplate&&newInput.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:newTemplate&&newInput.trim()?'#0a0e17':'#666',fontSize:'11px',cursor:'pointer',fontWeight:500},children:'Criar'})
          ]})
        ]}),
        // Content
        viewMode==='thread'&&selectedFlow?.thread_id?
          // THREAD VIEW
          c.jsx('div',{className:'flex-1 overflow-y-auto',style:{padding:'12px 16px'},children:
            threadEvents.length===0?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#555',fontSize:'11px'},children:'Carregando eventos...'}):
            threadEvents.filter(ev=>(ev.type==='status'&&ev.agent_id==='flow-agent')||ev.type==='agent_response'||ev.type==='error').map(ev=>c.jsxs('div',{key:ev.id,style:{padding:'8px 12px',marginBottom:'6px',borderRadius:'6px',background:ev.type==='error'?'rgba(255,77,77,0.08)':ev.type==='status'?'rgba(0,229,204,0.05)':'rgba(255,255,255,0.03)',borderLeft:'3px solid '+(ev.type==='error'?'#ff6b6b':ev.type==='status'?'#00e5cc':ev.type==='agent_response'?'#4ade80':'rgba(255,255,255,0.1)')},children:[
              c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'},children:[
                c.jsxs('span',{style:{color:'#ccc',fontWeight:500},children:[tIcon(ev.type),' ',ev.type.replace(/_/g,' '),ev.agent_id?' \u00B7 '+agentLabel(ev.agent_id):'']}),
                c.jsx('span',{style:{color:'#666'},children:new Date(ev.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})})
              ]}),
              ev.content&&c.jsx('div',{style:{fontSize:'11px',color:'#ddd',whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:'150px',overflow:'auto',lineHeight:1.4},children:ev.content.substring(0,800)})
            ]}))
          }):
          // KANBAN VIEW
          c.jsxs('div',{className:'flex flex-1 overflow-hidden',children:[
            c.jsx('div',{className:'flex flex-1 overflow-x-auto',style:{padding:'10px 8px',gap:'8px'},children:
              columns.map(col=>{
                const colFlows=flows.filter(f=>f.status===col.id||(col.id==='failed'&&f.status==='cancelled'));
                return c.jsxs('div',{key:col.id,style:{minWidth:'150px',flex:1,display:'flex',flexDirection:'column'},children:[
                  c.jsxs('div',{className:'shrink-0',style:{padding:'4px 8px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
                    c.jsx('span',{style:{fontSize:'9px',fontWeight:600,color:col.color,textTransform:'uppercase',letterSpacing:'0.5px'},children:col.label}),
                    colFlows.length>0&&c.jsx('span',{style:{fontSize:'8px',color:'#666',background:'rgba(255,255,255,0.06)',padding:'1px 4px',borderRadius:'6px'},children:colFlows.length})
                  ]}),
                  c.jsx('div',{className:'flex-1 overflow-y-auto',style:{display:'flex',flexDirection:'column',gap:'5px'},children:
                    colFlows.map(f=>{
                      // Find current running step agent
                      let currentAgent=null;
                      if(f.status==='running'&&selectedFlow?.id===f.id){
                        const rs=(selectedFlow.steps||[]).find(s=>s.status==='running');
                        currentAgent=rs?.agent_id;
                      }
                      return c.jsxs('div',{key:f.id,onClick:()=>selectFlow(f),style:{padding:'9px 10px',borderRadius:'8px',background:selected===f.id?'rgba(0,229,204,0.08)':'rgba(255,255,255,0.03)',border:'1px solid '+(selected===f.id?'rgba(0,229,204,0.2)':'rgba(255,255,255,0.04)'),cursor:'pointer'},children:[
                        c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'},children:[
                          c.jsx('span',{style:{fontSize:'11px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'110px'},children:f.name}),
                          c.jsx('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:statusDot(f.status)}})
                        ]}),
                        // Progress bar
                        f.total_steps>0&&c.jsx('div',{style:{height:'3px',borderRadius:'2px',background:'rgba(255,255,255,0.06)',marginBottom:'3px'},children:
                          c.jsx('div',{style:{height:'100%',borderRadius:'2px',background:col.color,width:Math.round((f.current_step/f.total_steps)*100)+'%',transition:'width 0.3s'}})
                        }),
                        c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
                          c.jsxs('span',{style:{fontSize:'9px',color:'#888'},children:[f.current_step||0,'/',f.total_steps||0]}),
                          // Current agent badge
                          currentAgent&&c.jsx('span',{style:{fontSize:'8px',padding:'1px 5px',borderRadius:'8px',background:'rgba(0,229,204,0.12)',color:'#00e5cc'},children:'@'+agentLabel(currentAgent)})
                        ]}),
                        // Show agent for non-selected flows too
                        f.status==='running'&&!currentAgent&&c.jsx('div',{style:{fontSize:'8px',color:'#00e5cc',marginTop:'2px'},children:'\u{23F3} processando...'})
                      ]})
                    })
                  })
                ]});
              })
            }),
            // Detail panel
            selected&&selectedFlow&&c.jsxs('div',{className:'flex flex-col shrink-0 overflow-y-auto',style:{width:'260px',borderLeft:'1px solid rgba(255,255,255,0.06)',padding:'10px'},children:[
              c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'},children:[
                c.jsx('span',{style:{fontSize:'11px',fontWeight:600,color:'#00e5cc'},children:'Detalhes'}),
                c.jsx('button',{onClick:()=>{setSelected(null);setSelectedFlow(null)},style:{border:'none',background:'rgba(255,255,255,0.06)',color:'#888',padding:'2px 6px',borderRadius:'4px',fontSize:'9px',cursor:'pointer'},children:'\u2715'})
              ]}),
              c.jsx('div',{style:{fontSize:'11px',fontWeight:500,marginBottom:'3px'},children:selectedFlow.name}),
              c.jsxs('div',{style:{fontSize:'9px',color:'#888',marginBottom:'8px'},children:[selectedFlow.status,' \u00B7 ',selectedFlow.current_step,'/',selectedFlow.total_steps,' etapas']}),
              // Actions
              c.jsxs('div',{style:{display:'flex',gap:'3px',marginBottom:'8px',flexWrap:'wrap'},children:[
                selectedFlow.status==='backlog'&&c.jsx('button',{onClick:()=>startFlow(selectedFlow.id),style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:'#00e5cc',color:'#0a0e17',fontSize:'9px',cursor:'pointer',fontWeight:500},children:'Iniciar'}),
                ['running','backlog'].includes(selectedFlow.status)&&c.jsx('button',{onClick:()=>cancelFlow(selectedFlow.id),style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:'rgba(255,77,77,0.15)',color:'#ff6b6b',fontSize:'9px',cursor:'pointer'},children:'Cancelar'}),
                selectedFlow.thread_id&&c.jsx('button',{onClick:openThread,style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:'rgba(255,255,255,0.06)',color:'#888',fontSize:'9px',cursor:'pointer'},children:'Ver Thread'}),
              ]}),
              // Steps
              c.jsx('div',{style:{fontSize:'9px',fontWeight:600,color:'#aaa',marginBottom:'4px'},children:'Etapas'}),
              (selectedFlow.steps||[]).map((s,i)=>c.jsxs('div',{key:i,style:{padding:'5px 7px',marginBottom:'3px',borderRadius:'4px',background:s.status==='completed'?'rgba(74,222,128,0.06)':s.status==='running'?'rgba(0,229,204,0.06)':s.status==='failed'?'rgba(255,77,77,0.06)':'rgba(255,255,255,0.02)',borderLeft:'2px solid '+(s.status==='completed'?'#4ade80':s.status==='running'?'#00e5cc':s.status==='failed'?'#ff6b6b':'#444')},children:[
                c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
                  c.jsxs('span',{style:{fontSize:'10px',fontWeight:500},children:[(i+1),'. ',s.name]}),
                  c.jsx('span',{style:{fontSize:'8px',color:statusDot(s.status)},children:s.status})
                ]}),
                c.jsxs('div',{style:{fontSize:'8px',color:'#888',display:'flex',gap:'4px',alignItems:'center'},children:[
                  c.jsx('span',{style:{padding:'0px 4px',borderRadius:'6px',background:'rgba(0,229,204,0.08)',color:'#00e5cc'},children:'@'+agentLabel(s.agent_id)}),
                  s.duration_ms&&c.jsx('span',{children:Math.round(s.duration_ms/1000)+'s'})
                ]}),
                s.output&&c.jsx('div',{style:{fontSize:'9px',color:'#aaa',marginTop:'2px',maxHeight:'40px',overflow:'hidden'},children:s.output.substring(0,100)+'...'})
              ]})),
              selectedFlow.input&&c.jsxs('div',{style:{marginTop:'6px'},children:[
                c.jsx('div',{style:{fontSize:'9px',fontWeight:600,color:'#aaa',marginBottom:'3px'},children:'Input'}),
                c.jsx('div',{style:{fontSize:'9px',color:'#ccc',background:'rgba(0,0,0,0.2)',padding:'5px',borderRadius:'4px'},children:selectedFlow.input})
              ]})
            ]})
          ]})
      ]}),
      // BRAIN CHAT
      chatOpen&&c.jsxs('div',{className:'flex flex-col shrink-0',style:{width:'280px',borderLeft:'1px solid rgba(255,255,255,0.06)'},children:[
        c.jsxs('div',{className:'shrink-0',style:{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
          c.jsx('span',{style:{fontSize:'11px',fontWeight:600,color:'#00e5cc'},children:'Flow Agent'}),
          c.jsx('button',{onClick:()=>setChatOpen(false),style:{border:'none',background:'none',color:'#888',cursor:'pointer',fontSize:'12px'},children:'\u2715'})
        ]}),
        c.jsx('div',{ref:chatRef,className:'flex-1 overflow-y-auto',style:{padding:'8px 10px'},children:
          chatMessages.length===0?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#555',fontSize:'11px'},children:'Pergunte sobre flows e tarefas'}):
          chatMessages.map((m,i)=>c.jsx('div',{key:i,style:{marginBottom:'6px',display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'},children:
            c.jsx('div',{style:{maxWidth:'90%',padding:'6px 10px',borderRadius:'10px',background:m.role==='user'?'rgba(0,229,204,0.12)':'rgba(255,255,255,0.04)',fontSize:'11px',lineHeight:1.4,whiteSpace:'pre-wrap',wordBreak:'break-word'},children:m.text?.substring(0,800)})
          }))
        }),
        c.jsxs('div',{className:'shrink-0',style:{padding:'6px 10px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:'4px'},children:[
          c.jsx('input',{type:'text',value:chatInput,onChange:ev=>setChatInput(ev.target.value),onKeyDown:ev=>{if(ev.key==='Enter'){ev.preventDefault();sendChat()}},placeholder:'Perguntar...',style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'5px 8px',color:'#e0e0e0',fontSize:'10px',outline:'none'}}),
          c.jsx('button',{onClick:sendChat,style:{padding:'5px 10px',borderRadius:'6px',border:'none',background:chatInput.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:chatInput.trim()?'#0a0e17':'#666',fontSize:'10px',cursor:'pointer'},children:'\u{27A4}'})
        ]})
      ]}),
      // Brain toggle
      !chatOpen&&c.jsx('div',{className:'shrink-0',style:{display:'flex',alignItems:'flex-start',padding:'10px 6px'},children:
        c.jsx('button',{onClick:()=>setChatOpen(true),title:'Flow Agent',style:{width:'32px',height:'32px',borderRadius:'50%',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',cursor:'pointer',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center'},children:'\u{1F9E0}'})
      })
    ]})
  });
}
export{Flows as default};
