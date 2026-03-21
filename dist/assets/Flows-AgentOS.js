import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function Flows(){
  const[flows,setFlows]=(0,o.useState)([]);
  const[templates,setTemplates]=(0,o.useState)([]);
  const[agents,setAgents]=(0,o.useState)([]);
  const[selected,setSelected]=(0,o.useState)(null);
  const[selectedFlow,setSelectedFlow]=(0,o.useState)(null);
  const[showCreate,setShowCreate]=(0,o.useState)(false);
  const[threadEvents,setThreadEvents]=(0,o.useState)([]);
  const[viewMode,setViewMode]=(0,o.useState)('kanban');
  const[chatOpen,setChatOpen]=(0,o.useState)(false);
  const[chatInput,setChatInput]=(0,o.useState)('');
  const[chatMessages,setChatMessages]=(0,o.useState)([]);
  const[chatSending,setChatSending]=(0,o.useState)(false);
  const chatRef=(0,o.useRef)(null);
  const[loading,setLoading]=(0,o.useState)(true);
  // Create form state
  const[cTemplate,setCTemplate]=(0,o.useState)('');
  const[cInput,setCInput]=(0,o.useState)('');
  const[cName,setCName]=(0,o.useState)('');
  const[cSchedule,setCSchedule]=(0,o.useState)('none');
  const[cInterval,setCInterval]=(0,o.useState)(60);
  const[cSteps,setCSteps]=(0,o.useState)([]);
  const[cMode,setCMode]=(0,o.useState)('template'); // template or custom
  const[cPlan,setCPlan]=(0,o.useState)(false);
  const[cPlanResult,setCPlanResult]=(0,o.useState)('');
  const[cPlanning,setCPlanning]=(0,o.useState)(false);

  const columns=[
    {id:'backlog',label:'Backlog',color:'#888'},
    {id:'running',label:'Running',color:'#00e5cc'},
    {id:'scheduled',label:'Scheduled',color:'#9382ff'},
    {id:'completed',label:'Done',color:'#4ade80'},
    {id:'failed',label:'Failed',color:'#ff6b6b'},
  ];

  (0,o.useEffect)(()=>{loadData();const iv=setInterval(loadData,5000);return()=>clearInterval(iv)},[]);
  (0,o.useEffect)(()=>{if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight},[chatMessages]);
  (0,o.useEffect)(()=>{
    if(!selectedFlow?.thread_id) return;
    const poll=()=>{fetch('/api/threads/'+selectedFlow.thread_id+'/events').then(r=>r.json()).then(setThreadEvents).catch(()=>{})};
    poll();const iv=setInterval(poll,3000);return()=>clearInterval(iv);
  },[selectedFlow?.thread_id,viewMode]);

  function loadData(){
    Promise.all([fetch('/api/flows').then(r=>r.json()),fetch('/api/flow-templates').then(r=>r.json()),fetch('/api/db/agents').then(r=>r.json())])
    .then(([f,t,a])=>{setFlows(f);setTemplates(t);setAgents(a);setLoading(false);
      if(selected){fetch('/api/flows/'+selected).then(r=>r.json()).then(setSelectedFlow).catch(()=>{})}
    }).catch(()=>setLoading(false));
  }

  function selectFlow(f){setSelected(f.id);setViewMode('kanban');fetch('/api/flows/'+f.id).then(r=>r.json()).then(d=>{setSelectedFlow(d);if(d.thread_id) fetch('/api/threads/'+d.thread_id+'/events').then(r=>r.json()).then(setThreadEvents).catch(()=>{})}).catch(()=>{})}
  function openThread(){if(!selectedFlow?.thread_id) return;setViewMode('thread');fetch('/api/threads/'+selectedFlow.thread_id+'/events').then(r=>r.json()).then(setThreadEvents).catch(()=>{})}

  function selectTemplate(tid){
    setCTemplate(tid);
    const t=templates.find(x=>x.id===tid);
    if(t){setCSteps(JSON.parse(t.steps));setCName(t.name)}
  }

  function addCustomStep(){setCSteps(prev=>[...prev,{name:'Nova etapa',agent_id:'gestor',prompt:'{{input}}'}])}
  function removeStep(i){setCSteps(prev=>prev.filter((_,idx)=>idx!==i))}
  function updateStep(i,field,val){setCSteps(prev=>prev.map((s,idx)=>idx===i?{...s,[field]:val}:s))}

  async function generatePlan(){
    setCPlanning(true);setCPlanResult('');
    try{
      const resp=await fetch('/api/smol/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Planeje um flow para: '+cInput+'. Liste as etapas necessarias com agente ideal pra cada uma (coder=Claude Code, gestor=Gestor, sql=SQL Agent). Responda em formato lista.',stream:true})});
      const text=await resp.text();const lines=text.split('\n');
      for(const line of lines){if(!line.startsWith('data: ')) continue;const data=line.slice(6).trim();if(data==='[DONE]') continue;
        try{const ev=JSON.parse(data);if(ev.event==='done') setCPlanResult(ev.result||'')}catch{}}
    }catch{}
    setCPlanning(false);
  }

  async function createFlow(){
    if(!cInput.trim()||cSteps.length===0) return;
    const body={input:cInput,name:cName||cInput.substring(0,50)};
    if(cMode==='template'&&cTemplate) body.template_id=cTemplate;
    else body.steps=cSteps;
    const resp=await fetch('/api/flows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    // Schedule if needed
    if(cSchedule!=='none'&&data.id){
      await fetch('/api/flows/'+data.id+'/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schedule:cSchedule,interval_minutes:cInterval})});
    }
    setShowCreate(false);setCInput('');setCName('');setCTemplate('');setCSteps([]);setCSchedule('none');setCPlanResult('');
    loadData();
  }

  async function startFlow(id){
    await fetch('/api/flows/'+id+'/start',{method:'POST'});
    setChatOpen(true);setChatMessages(prev=>[...prev,{role:'assistant',text:'Flow iniciado! Monitorando...'}]);
    const monId=setInterval(async()=>{try{const r=await fetch('/api/flows/'+id);const f=await r.json();const rs=(f.steps||[]).find(s=>s.status==='running');
      if(rs){setChatMessages(prev=>{const l=prev[prev.length-1];if(l?.text?.includes(rs.name)) return prev;return[...prev,{role:'assistant',text:'Etapa '+(rs.step_index+1)+'/'+f.total_steps+': '+rs.name+' (@'+agentLabel(rs.agent_id)+')'}]})}
      if(f.status==='completed'){clearInterval(monId);setChatMessages(prev=>[...prev,{role:'assistant',text:'Flow concluido!'}]);loadData()}
      if(f.status==='failed'){clearInterval(monId);setChatMessages(prev=>[...prev,{role:'assistant',text:'Flow falhou: '+(f.output||'')}]);loadData()}
    }catch{}},4000);loadData();
  }
  async function cancelFlow(id){await fetch('/api/flows/'+id+'/cancel',{method:'POST'});loadData()}

  async function sendChat(){
    const msg=chatInput.trim();if(!msg||chatSending) return;setChatInput('');setChatSending(true);
    setChatMessages(prev=>[...prev,{role:'user',text:msg}]);
    try{const resp=await fetch('/api/smol/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Sobre flows: '+msg,stream:true,threadId:selectedFlow?.thread_id})});
      const reader=resp.body?.getReader();const decoder=new TextDecoder();let buffer='',result='';
      while(true){const{done,value}=await reader.read();if(done) break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){if(!line.startsWith('data: ')) continue;const data=line.slice(6).trim();if(data==='[DONE]') continue;try{const ev=JSON.parse(data);if(ev.event==='done') result=ev.result||''}catch{}}}
      if(result) setChatMessages(prev=>[...prev,{role:'assistant',text:result}]);
    }catch(err){setChatMessages(prev=>[...prev,{role:'system',text:'Erro: '+err.message}])}
    setChatSending(false);
  }

  const statusDot=s=>({backlog:'#888',running:'#00e5cc',paused:'#ffb84d',completed:'#4ade80',failed:'#ff6b6b',cancelled:'#666',scheduled:'#9382ff'}[s]||'#888');
  const agentLabel=a=>({coder:'Claude Code',sql:'SQL Agent',gestor:'Gestor'}[a]||a||'');
  const tIcon=t=>({status:'\u{1F4CA}',agent_response:'\u{2705}',error:'\u{274C}'}[t]||'\u{2022}');

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
            c.jsx('button',{onClick:()=>{setShowCreate(!showCreate);if(!showCreate){setCMode('template');setCSteps([]);setCPlanResult('')}},style:{padding:'4px 12px',borderRadius:'6px',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',fontSize:'11px',cursor:'pointer',fontWeight:500},children:showCreate?'\u2715 Fechar':'+ Novo Flow'})
          ]})
        ]}),

        // CREATE MODAL (overlay)
        showCreate&&c.jsx('div',{style:{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'},children:
          c.jsxs('div',{style:{width:'600px',maxHeight:'500px',background:'#0d1117',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.1)',overflow:'auto',padding:'20px'},children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'16px'},children:[
              c.jsx('span',{style:{fontSize:'14px',fontWeight:600,color:'#00e5cc'},children:'Criar Novo Flow'}),
              c.jsx('button',{onClick:()=>setShowCreate(false),style:{border:'none',background:'none',color:'#888',cursor:'pointer',fontSize:'14px'},children:'\u2715'})
            ]}),
            // Mode selector
            c.jsxs('div',{style:{display:'flex',gap:'4px',marginBottom:'12px'},children:[
              c.jsx('button',{onClick:()=>setCMode('template'),style:{padding:'4px 12px',borderRadius:'6px',border:'none',background:cMode==='template'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:cMode==='template'?'#00e5cc':'#888',fontSize:'11px',cursor:'pointer'},children:'Template'}),
              c.jsx('button',{onClick:()=>setCMode('custom'),style:{padding:'4px 12px',borderRadius:'6px',border:'none',background:cMode==='custom'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:cMode==='custom'?'#00e5cc':'#888',fontSize:'11px',cursor:'pointer'},children:'Custom'}),
            ]}),
            // Template selector
            cMode==='template'&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'10px',color:'#888',marginBottom:'4px'},children:'Template'}),
              c.jsx('div',{style:{display:'flex',gap:'4px',flexWrap:'wrap'},children:
                templates.map(t=>c.jsxs('button',{key:t.id,onClick:()=>selectTemplate(t.id),style:{padding:'6px 12px',borderRadius:'8px',border:'1px solid '+(cTemplate===t.id?'#00e5cc':'rgba(255,255,255,0.1)'),background:cTemplate===t.id?'rgba(0,229,204,0.1)':'transparent',color:cTemplate===t.id?'#00e5cc':'#ccc',fontSize:'11px',cursor:'pointer',textAlign:'left'},children:[
                  c.jsx('div',{style:{fontWeight:500},children:t.name}),
                  c.jsx('div',{style:{fontSize:'9px',color:'#888',marginTop:'2px'},children:t.description})
                ]}))
              })
            ]}),
            // Input
            c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'10px',color:'#888',marginBottom:'4px'},children:'Descricao da tarefa'}),
              c.jsx('textarea',{value:cInput,onChange:ev=>setCInput(ev.target.value),placeholder:'Descreva o que quer fazer em detalhes...',rows:3,style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'8px',color:'#e0e0e0',fontSize:'11px',outline:'none',resize:'vertical',fontFamily:'inherit'}})
            ]}),
            // Plan button
            cInput.trim()&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsxs('div',{style:{display:'flex',gap:'6px',alignItems:'center'},children:[
                c.jsx('button',{onClick:generatePlan,disabled:cPlanning,style:{padding:'4px 12px',borderRadius:'6px',border:'1px solid rgba(147,130,255,0.3)',background:'rgba(147,130,255,0.1)',color:'#9382ff',fontSize:'10px',cursor:'pointer'},children:cPlanning?'Planejando...':'\u{1F9ED} Gerar Plano com IA'}),
              ]}),
              cPlanResult&&c.jsx('div',{style:{marginTop:'6px',padding:'8px',borderRadius:'6px',background:'rgba(147,130,255,0.05)',border:'1px solid rgba(147,130,255,0.1)',fontSize:'11px',color:'#ccc',whiteSpace:'pre-wrap',maxHeight:'120px',overflow:'auto'},children:cPlanResult})
            ]}),
            // Steps (for custom mode or after template selected)
            cSteps.length>0&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'10px',color:'#888',marginBottom:'4px'},children:'Etapas'}),
              cSteps.map((s,i)=>c.jsxs('div',{key:i,style:{display:'flex',gap:'4px',marginBottom:'4px',alignItems:'center'},children:[
                c.jsx('span',{style:{fontSize:'10px',color:'#666',width:'16px'},children:(i+1)+'.'}),
                c.jsx('input',{value:s.name,onChange:ev=>updateStep(i,'name',ev.target.value),style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'4px 6px',color:'#e0e0e0',fontSize:'10px',outline:'none'}}),
                c.jsx('select',{value:s.agent_id,onChange:ev=>updateStep(i,'agent_id',ev.target.value),style:{background:'#0d1117',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'4px',color:'#00e5cc',fontSize:'10px'},children:
                  agents.map(a=>c.jsx('option',{key:a.id,value:a.id,children:a.name}))
                }),
                cMode==='custom'&&c.jsx('button',{onClick:()=>removeStep(i),style:{border:'none',background:'rgba(255,77,77,0.1)',color:'#ff6b6b',padding:'2px 6px',borderRadius:'4px',fontSize:'10px',cursor:'pointer'},children:'\u2715'})
              ]})),
              cMode==='custom'&&c.jsx('button',{onClick:addCustomStep,style:{padding:'3px 10px',borderRadius:'4px',border:'1px dashed rgba(255,255,255,0.1)',background:'transparent',color:'#888',fontSize:'10px',cursor:'pointer',marginTop:'4px'},children:'+ Adicionar etapa'})
            ]}),
            // Schedule
            c.jsxs('div',{style:{marginBottom:'16px'},children:[
              c.jsx('div',{style:{fontSize:'10px',color:'#888',marginBottom:'4px'},children:'Recorrencia'}),
              c.jsxs('div',{style:{display:'flex',gap:'4px',alignItems:'center'},children:[
                c.jsx('select',{value:cSchedule,onChange:ev=>setCSchedule(ev.target.value),style:{background:'#0d1117',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'4px 8px',color:'#e0e0e0',fontSize:'10px'},children:[
                  c.jsx('option',{value:'none',children:'Executar uma vez'}),
                  c.jsx('option',{value:'interval',children:'Repetir a cada...'}),
                  c.jsx('option',{value:'daily',children:'Diariamente'}),
                  c.jsx('option',{value:'hourly',children:'A cada hora'}),
                ]}),
                cSchedule==='interval'&&c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'4px'},children:[
                  c.jsx('input',{type:'number',value:cInterval,onChange:ev=>setCInterval(parseInt(ev.target.value)||60),min:5,style:{width:'60px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'4px',color:'#e0e0e0',fontSize:'10px',outline:'none'}}),
                  c.jsx('span',{style:{fontSize:'10px',color:'#888'},children:'minutos'})
                ]}),
                cSchedule==='daily'&&c.jsx('span',{style:{fontSize:'9px',color:'#9382ff'},children:'A cada 24h'}),
                cSchedule==='hourly'&&c.jsx('span',{style:{fontSize:'9px',color:'#9382ff'},children:'A cada 60min'}),
              ]})
            ]}),
            // Create button
            c.jsxs('div',{style:{display:'flex',justifyContent:'flex-end',gap:'6px'},children:[
              c.jsx('button',{onClick:()=>setShowCreate(false),style:{padding:'6px 16px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#888',fontSize:'11px',cursor:'pointer'},children:'Cancelar'}),
              c.jsx('button',{onClick:createFlow,disabled:!cInput.trim()||(cMode==='template'&&!cTemplate)||cSteps.length===0,style:{padding:'6px 16px',borderRadius:'6px',border:'none',background:cInput.trim()&&cSteps.length>0?'#00e5cc':'rgba(255,255,255,0.06)',color:cInput.trim()&&cSteps.length>0?'#0a0e17':'#666',fontSize:'11px',cursor:'pointer',fontWeight:500},children:'Criar Flow'})
            ]})
          ]})
        }),

        // CONTENT
        viewMode==='thread'&&selectedFlow?.thread_id?
          c.jsx('div',{className:'flex-1 overflow-y-auto',style:{padding:'12px 16px'},children:
            threadEvents.filter(ev=>(ev.type==='status'&&ev.agent_id==='flow-agent')||ev.type==='agent_response'||ev.type==='error').map(ev=>c.jsxs('div',{key:ev.id,style:{padding:'8px 12px',marginBottom:'6px',borderRadius:'6px',background:ev.type==='error'?'rgba(255,77,77,0.08)':ev.type==='status'?'rgba(0,229,204,0.05)':'rgba(255,255,255,0.03)',borderLeft:'3px solid '+(ev.type==='error'?'#ff6b6b':ev.type==='status'?'#00e5cc':'#4ade80')},children:[
              c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'},children:[
                c.jsxs('span',{style:{color:'#ccc',fontWeight:500},children:[tIcon(ev.type),' ',ev.type.replace(/_/g,' '),ev.agent_id?' \u00B7 '+agentLabel(ev.agent_id):'']}),
                c.jsx('span',{style:{color:'#666'},children:new Date(ev.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})})
              ]}),
              ev.content&&c.jsx('div',{style:{fontSize:'11px',color:'#ddd',whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:'150px',overflow:'auto',lineHeight:1.4},children:ev.content.substring(0,800)})
            ]}))
          }):
          // KANBAN
          c.jsxs('div',{className:'flex flex-1 overflow-hidden',children:[
            c.jsx('div',{className:'flex flex-1 overflow-x-auto',style:{padding:'10px 8px',gap:'8px'},children:
              columns.map(col=>{
                const colFlows=flows.filter(f=>f.status===col.id||(col.id==='failed'&&(f.status==='cancelled'||f.status==='failed')));
                return c.jsxs('div',{key:col.id,style:{minWidth:'140px',flex:1,display:'flex',flexDirection:'column'},children:[
                  c.jsxs('div',{className:'shrink-0',style:{padding:'4px 8px',marginBottom:'6px',display:'flex',justifyContent:'space-between'},children:[
                    c.jsx('span',{style:{fontSize:'9px',fontWeight:600,color:col.color,textTransform:'uppercase',letterSpacing:'0.5px'},children:col.label}),
                    colFlows.length>0&&c.jsx('span',{style:{fontSize:'8px',color:'#666',background:'rgba(255,255,255,0.06)',padding:'1px 4px',borderRadius:'6px'},children:colFlows.length})
                  ]}),
                  c.jsx('div',{className:'flex-1 overflow-y-auto',style:{display:'flex',flexDirection:'column',gap:'5px'},children:
                    colFlows.map(f=>c.jsxs('div',{key:f.id,onClick:()=>selectFlow(f),style:{padding:'9px 10px',borderRadius:'8px',background:selected===f.id?'rgba(0,229,204,0.08)':'rgba(255,255,255,0.03)',border:'1px solid '+(selected===f.id?'rgba(0,229,204,0.2)':'rgba(255,255,255,0.04)'),cursor:'pointer'},children:[
                      c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'},children:[
                        c.jsx('span',{style:{fontSize:'11px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'},children:f.name}),
                        c.jsx('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:statusDot(f.status)}})
                      ]}),
                      f.total_steps>0&&c.jsx('div',{style:{height:'3px',borderRadius:'2px',background:'rgba(255,255,255,0.06)',marginBottom:'3px'},children:
                        c.jsx('div',{style:{height:'100%',borderRadius:'2px',background:col.color,width:Math.round(((f.current_step||0)/f.total_steps)*100)+'%'}})
                      }),
                      c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'9px',color:'#888'},children:[
                        c.jsx('span',{children:(f.current_step||0)+'/'+f.total_steps}),
                        f.schedule&&c.jsx('span',{style:{color:'#9382ff'},children:'\u{1F504}'}),
                      ]})
                    ]}))
                  })
                ]});
              })
            }),
            // Detail
            selected&&selectedFlow&&c.jsxs('div',{className:'flex flex-col shrink-0 overflow-y-auto',style:{width:'250px',borderLeft:'1px solid rgba(255,255,255,0.06)',padding:'10px'},children:[
              c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'8px'},children:[
                c.jsx('span',{style:{fontSize:'11px',fontWeight:600,color:'#00e5cc'},children:'Detalhes'}),
                c.jsx('button',{onClick:()=>{setSelected(null);setSelectedFlow(null)},style:{border:'none',background:'rgba(255,255,255,0.06)',color:'#888',padding:'2px 6px',borderRadius:'4px',fontSize:'9px',cursor:'pointer'},children:'\u2715'})
              ]}),
              c.jsx('div',{style:{fontSize:'11px',fontWeight:500,marginBottom:'3px'},children:selectedFlow.name}),
              c.jsxs('div',{style:{fontSize:'9px',color:'#888',marginBottom:'6px'},children:[selectedFlow.status,' \u00B7 ',selectedFlow.current_step||0,'/',selectedFlow.total_steps]}),
              selectedFlow.schedule&&c.jsx('div',{style:{fontSize:'9px',color:'#9382ff',marginBottom:'6px',padding:'3px 6px',borderRadius:'4px',background:'rgba(147,130,255,0.08)'},children:'\u{1F504} Recorrente: '+selectedFlow.schedule}),
              c.jsxs('div',{style:{display:'flex',gap:'3px',marginBottom:'8px',flexWrap:'wrap'},children:[
                selectedFlow.status==='backlog'&&c.jsx('button',{onClick:()=>startFlow(selectedFlow.id),style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:'#00e5cc',color:'#0a0e17',fontSize:'9px',cursor:'pointer',fontWeight:500},children:'Iniciar'}),
                ['running','backlog','scheduled'].includes(selectedFlow.status)&&c.jsx('button',{onClick:()=>cancelFlow(selectedFlow.id),style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:'rgba(255,77,77,0.15)',color:'#ff6b6b',fontSize:'9px',cursor:'pointer'},children:'Cancelar'}),
                selectedFlow.thread_id&&c.jsx('button',{onClick:openThread,style:{padding:'3px 8px',borderRadius:'4px',border:'none',background:'rgba(255,255,255,0.06)',color:'#888',fontSize:'9px',cursor:'pointer'},children:'Ver Thread'}),
              ]}),
              c.jsx('div',{style:{fontSize:'9px',fontWeight:600,color:'#aaa',marginBottom:'4px'},children:'Etapas'}),
              (selectedFlow.steps||[]).map((s,i)=>c.jsxs('div',{key:i,style:{padding:'5px 7px',marginBottom:'3px',borderRadius:'4px',background:s.status==='completed'?'rgba(74,222,128,0.06)':s.status==='running'?'rgba(0,229,204,0.06)':'rgba(255,255,255,0.02)',borderLeft:'2px solid '+(s.status==='completed'?'#4ade80':s.status==='running'?'#00e5cc':'#444')},children:[
                c.jsxs('div',{style:{display:'flex',justifyContent:'space-between'},children:[
                  c.jsxs('span',{style:{fontSize:'10px',fontWeight:500},children:[(i+1),'. ',s.name]}),
                  c.jsx('span',{style:{fontSize:'8px',color:statusDot(s.status)},children:s.status})
                ]}),
                c.jsx('span',{style:{fontSize:'8px',padding:'0 4px',borderRadius:'6px',background:'rgba(0,229,204,0.08)',color:'#00e5cc'},children:'@'+agentLabel(s.agent_id)}),
                s.duration_ms&&c.jsx('span',{style:{fontSize:'8px',color:'#666',marginLeft:'4px'},children:Math.round(s.duration_ms/1000)+'s'})
              ]}))
            ]})
          ]})
      ]}),
      // BRAIN
      chatOpen&&c.jsxs('div',{className:'flex flex-col shrink-0',style:{width:'260px',borderLeft:'1px solid rgba(255,255,255,0.06)'},children:[
        c.jsxs('div',{className:'shrink-0',style:{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between'},children:[
          c.jsx('span',{style:{fontSize:'11px',fontWeight:600,color:'#00e5cc'},children:'Flow Agent'}),
          c.jsx('button',{onClick:()=>setChatOpen(false),style:{border:'none',background:'none',color:'#888',cursor:'pointer'},children:'\u2715'})
        ]}),
        c.jsx('div',{ref:chatRef,className:'flex-1 overflow-y-auto',style:{padding:'8px'},children:
          chatMessages.length===0?c.jsx('div',{style:{padding:'16px',textAlign:'center',color:'#555',fontSize:'10px'},children:'Flow Agent monitora execucao'}):
          chatMessages.map((m,i)=>c.jsx('div',{key:i,style:{marginBottom:'5px',display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'},children:
            c.jsx('div',{style:{maxWidth:'90%',padding:'5px 8px',borderRadius:'8px',background:m.role==='user'?'rgba(0,229,204,0.12)':'rgba(255,255,255,0.04)',fontSize:'10px',lineHeight:1.4,whiteSpace:'pre-wrap',wordBreak:'break-word'},children:m.text?.substring(0,500)})
          }))
        }),
        c.jsxs('div',{className:'shrink-0',style:{padding:'6px 8px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:'3px'},children:[
          c.jsx('input',{value:chatInput,onChange:ev=>setChatInput(ev.target.value),onKeyDown:ev=>{if(ev.key==='Enter'){ev.preventDefault();sendChat()}},placeholder:'Perguntar...',style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'4px 6px',color:'#e0e0e0',fontSize:'10px',outline:'none'}}),
          c.jsx('button',{onClick:sendChat,style:{padding:'4px 8px',borderRadius:'6px',border:'none',background:chatInput.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:chatInput.trim()?'#0a0e17':'#666',fontSize:'10px',cursor:'pointer'},children:'\u{27A4}'})
        ]})
      ]}),
      !chatOpen&&c.jsx('div',{className:'shrink-0',style:{padding:'10px 6px'},children:
        c.jsx('button',{onClick:()=>setChatOpen(true),title:'Flow Agent',style:{width:'32px',height:'32px',borderRadius:'50%',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',cursor:'pointer',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center'},children:'\u{1F9E0}'})
      })
    ]})
  });
}
export{Flows as default};
