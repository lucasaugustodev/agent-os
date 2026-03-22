import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function AgentManager(){
  const[agents,setAgents]=(0,o.useState)([]);
  const[models,setModels]=(0,o.useState)([]);
  const[providers,setProviders]=(0,o.useState)([]);
  const[selected,setSelected]=(0,o.useState)(null);
  const[showCreate,setShowCreate]=(0,o.useState)(false);
  const[editMode,setEditMode]=(0,o.useState)(false);
  const[providerStatus,setProviderStatus]=(0,o.useState)({});
  const[loading,setLoading]=(0,o.useState)(true);
  // Create/edit form
  const[fId,setFId]=(0,o.useState)('');
  const[fName,setFName]=(0,o.useState)('');
  const[fDesc,setFDesc]=(0,o.useState)('');
  const[fType,setFType]=(0,o.useState)('smol');
  const[fModel,setFModel]=(0,o.useState)('');
  const[fIcon,setFIcon]=(0,o.useState)('bot');
  const[fPrompt,setFPrompt]=(0,o.useState)('');
  const[fAcpx,setFAcpx]=(0,o.useState)('');
  const[fCaps,setFCaps]=(0,o.useState)('');

  (0,o.useEffect)(()=>{loadAll()},[]);

  async function loadAll(){
    const[a,m,p]=await Promise.all([
      fetch('/api/db/agents').then(r=>r.json()),
      fetch('/api/db/models').then(r=>r.json()),
      fetch('/api/db/providers').then(r=>r.json()),
    ]);
    setAgents(a);setModels(m);setProviders(p);setLoading(false);
    // Check provider status
    for(const pr of p){
      fetch('/api/db/providers/'+pr.id+'/status').then(r=>r.json()).then(s=>setProviderStatus(prev=>({...prev,[pr.id]:s}))).catch(()=>{});
    }
  }

  function selectAgent(a){
    setSelected(a.id);setEditMode(false);
  }

  function startEdit(a){
    setFId(a.id);setFName(a.name);setFDesc(a.description||'');setFType(a.agent_type);
    setFModel(a.model_id||'');setFIcon(a.icon||'bot');setFPrompt(a.system_prompt||'');
    setFAcpx(a.acpx_command||'');setFCaps(JSON.parse(a.capabilities||'[]').join(', '));
    setEditMode(true);
  }

  function startCreate(){
    setFId('');setFName('');setFDesc('');setFType('smol');setFModel('');setFIcon('bot');setFPrompt('');setFAcpx('');setFCaps('');
    setShowCreate(true);setEditMode(false);setSelected(null);
  }

  async function saveAgent(){
    const caps=fCaps.split(',').map(s=>s.trim()).filter(Boolean);
    const body={id:fId||fName.toLowerCase().replace(/\s+/g,'-'),name:fName,description:fDesc,agent_type:fType,model_id:fModel||null,icon:fIcon,system_prompt:fPrompt||null,acpx_command:fAcpx||null,capabilities:caps};
    if(showCreate){
      await fetch('/api/db/agents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }else{
      body.active=1;
      await fetch('/api/db/agents/'+fId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }
    setShowCreate(false);setEditMode(false);await loadAll();
  }

  async function changeModel(agentId,modelId){
    await fetch('/api/db/agents/'+agentId+'/model',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({model_id:modelId})});
    await loadAll();
  }

  async function deleteAgent(id){
    await fetch('/api/db/agents/'+id,{method:'DELETE'});
    setSelected(null);await loadAll();
  }

  async function testAgent(a){
    const resp=await fetch('/api/smol/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'diz oi em 3 palavras',stream:true})});
    const text=await resp.text();
    const lines=text.split('\n');
    for(const l of lines){if(!l.startsWith('data: ')) continue;try{const ev=JSON.parse(l.slice(6));if(ev.event==='done') alert('Resposta: '+(ev.result||'').substring(0,100))}catch{}}
  }

  const typeColor=t=>({smol:'#00e5cc',cli:'#9382ff',acpx:'#9382ff',api:'#ffb84d',local:'#4ade80'}[t]||'#888');
  const typeLabel=t=>({smol:'SmolAI',cli:'CLI (ACPX)',acpx:'CLI (ACPX)',api:'API',local:'Local'}[t]||t);
  const statusIcon=s=>s?.authenticated?'\u{2705}':s?.installed?'\u{1F7E1}':'\u{26AA}';

  const sel=agents.find(a=>a.id===selected);

  const c=(0,t())
  return c.jsx('div',{className:'flex flex-col h-full',style:{background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:
    c.jsxs('div',{className:'flex h-full overflow-hidden',children:[
      // LEFT: Agent list grouped by type
      c.jsxs('div',{className:'flex flex-col shrink-0',style:{width:'280px',borderRight:'1px solid rgba(255,255,255,0.06)'},children:[
        c.jsxs('div',{className:'shrink-0',style:{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
          c.jsxs('div',{children:[
            c.jsx('div',{style:{fontSize:'13px',fontWeight:600,color:'#00e5cc'},children:'Agent Manager'}),
            c.jsx('div',{style:{fontSize:'10px',color:'#888'},children:agents.length+' agents \u00B7 '+models.length+' models'})
          ]}),
          c.jsx('button',{onClick:startCreate,style:{padding:'3px 10px',borderRadius:'6px',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',fontSize:'10px',cursor:'pointer'},children:'+ Novo'})
        ]}),
        c.jsx('div',{className:'flex-1 overflow-y-auto',style:{padding:'8px'},children:
          loading?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#666',fontSize:'11px'},children:'Carregando...'}):
          // Group by type
          ['smol','cli','acpx','api','local'].map(type=>{
            const typeAgents=agents.filter(a=>a.agent_type===type||(type==='cli'&&a.agent_type==='acpx'));
            if(typeAgents.length===0&&type!=='smol'&&type!=='cli') return null;
            return c.jsxs('div',{key:type,style:{marginBottom:'12px'},children:[
              c.jsxs('div',{style:{fontSize:'9px',fontWeight:600,color:typeColor(type),textTransform:'uppercase',letterSpacing:'0.5px',padding:'4px 8px',display:'flex',justifyContent:'space-between'},children:[
                c.jsx('span',{children:typeLabel(type)+' Agents'}),
                c.jsx('span',{style:{color:'#666'},children:typeAgents.length})
              ]}),
              typeAgents.map(a=>c.jsxs('div',{key:a.id,onClick:()=>selectAgent(a),style:{padding:'8px 10px',borderRadius:'6px',marginBottom:'3px',cursor:'pointer',background:selected===a.id?'rgba(0,229,204,0.08)':'transparent',borderLeft:'2px solid '+(selected===a.id?'#00e5cc':'transparent')},children:[
                c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
                  c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:a.name}),
                  c.jsx('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:a.provider_auth==='authenticated'?'#4ade80':'#666'}})
                ]}),
                c.jsxs('div',{style:{fontSize:'9px',color:'#888',marginTop:'2px'},children:[
                  a.model_name||'sem modelo',
                  a.provider_name?' \u00B7 '+a.provider_name:''
                ]})
              ]})),
              type==='cli'&&typeAgents.length===0&&c.jsx('div',{style:{padding:'6px 10px',fontSize:'10px',color:'#555',fontStyle:'italic'},children:'Nenhum CLI agent. Instale Claude, Gemini, etc.'})
            ]});
          })
        })
      ]}),
      // RIGHT: Detail or Create/Edit
      c.jsx('div',{className:'flex flex-col flex-1 overflow-hidden',children:
        showCreate||editMode?
          // CREATE/EDIT FORM
          c.jsx('div',{className:'flex-1 overflow-y-auto',style:{padding:'16px'},children:
            c.jsxs('div',{style:{maxWidth:'500px'},children:[
              c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'16px'},children:[
                c.jsx('span',{style:{fontSize:'14px',fontWeight:600,color:'#00e5cc'},children:showCreate?'Criar Novo Agente':'Editar '+fName}),
                c.jsx('button',{onClick:()=>{setShowCreate(false);setEditMode(false)},style:{border:'none',background:'none',color:'#888',cursor:'pointer'},children:'\u2715'})
              ]}),
              // Type selector
              c.jsxs('div',{style:{marginBottom:'12px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Tipo do Agente'}),
                c.jsxs('div',{style:{display:'flex',gap:'4px'},children:
                  ['smol','cli','api','local'].map(t=>c.jsx('button',{key:t,onClick:()=>setFType(t),style:{padding:'4px 12px',borderRadius:'6px',border:'1px solid '+(fType===t?typeColor(t):'rgba(255,255,255,0.1)'),background:fType===t?typeColor(t)+'22':'transparent',color:fType===t?typeColor(t):'#888',fontSize:'10px',cursor:'pointer'},children:typeLabel(t)}))
                })
              ]}),
              // Name + ID
              c.jsxs('div',{style:{display:'flex',gap:'8px',marginBottom:'12px'},children:[
                c.jsxs('div',{style:{flex:1},children:[
                  c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Nome'}),
                  c.jsx('input',{value:fName,onChange:ev=>{setFName(ev.target.value);if(showCreate) setFId(ev.target.value.toLowerCase().replace(/\s+/g,'-'))},style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}})
                ]}),
                c.jsxs('div',{style:{width:'120px'},children:[
                  c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'ID'}),
                  c.jsx('input',{value:fId,onChange:ev=>setFId(ev.target.value),disabled:!showCreate,style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:showCreate?'#e0e0e0':'#666',fontSize:'11px',outline:'none'}})
                ]})
              ]}),
              // Description
              c.jsxs('div',{style:{marginBottom:'12px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Descricao'}),
                c.jsx('input',{value:fDesc,onChange:ev=>setFDesc(ev.target.value),placeholder:'O que este agente faz...',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}})
              ]}),
              // Model selector
              c.jsxs('div',{style:{marginBottom:'12px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Modelo'}),
                c.jsx('select',{value:fModel,onChange:ev=>setFModel(ev.target.value),style:{width:'100%',background:'#0d1117',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px'},children:[
                  c.jsx('option',{value:'',children:'Selecionar modelo...'}),
                  ...models.map(m=>c.jsx('option',{key:m.id,value:m.id,children:m.name+' ('+m.provider_name+')'}))
                ]})
              ]}),
              // ACPX command (for CLI type)
              (fType==='cli'||fType==='acpx')&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Comando ACPX'}),
                c.jsx('input',{value:fAcpx,onChange:ev=>setFAcpx(ev.target.value),placeholder:'npx -y @zed-industries/claude-agent-acp',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}})
              ]}),
              // System prompt
              c.jsxs('div',{style:{marginBottom:'12px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'System Prompt'}),
                c.jsx('textarea',{value:fPrompt,onChange:ev=>setFPrompt(ev.target.value),placeholder:'Instrucoes para o agente...',rows:4,style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'8px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none',resize:'vertical',fontFamily:'inherit'}})
              ]}),
              // Capabilities
              c.jsxs('div',{style:{marginBottom:'12px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Capacidades (separadas por virgula)'}),
                c.jsx('input',{value:fCaps,onChange:ev=>setFCaps(ev.target.value),placeholder:'code, analysis, sql, text',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}})
              ]}),
              // Icon
              c.jsxs('div',{style:{marginBottom:'16px'},children:[
                c.jsx('label',{style:{fontSize:'10px',color:'#888',display:'block',marginBottom:'4px'},children:'Icone'}),
                c.jsxs('div',{style:{display:'flex',gap:'4px'},children:
                  ['bot','code','database','brain','terminal','globe','zap','search','file-text','git-branch'].map(icon=>
                    c.jsx('button',{key:icon,onClick:()=>setFIcon(icon),style:{padding:'4px 8px',borderRadius:'4px',border:'1px solid '+(fIcon===icon?'#00e5cc':'rgba(255,255,255,0.08)'),background:fIcon===icon?'rgba(0,229,204,0.1)':'transparent',color:fIcon===icon?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:icon})
                  )
                })
              ]}),
              // Actions
              c.jsxs('div',{style:{display:'flex',gap:'6px'},children:[
                c.jsx('button',{onClick:()=>{setShowCreate(false);setEditMode(false)},style:{padding:'6px 16px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#888',fontSize:'11px',cursor:'pointer'},children:'Cancelar'}),
                c.jsx('button',{onClick:saveAgent,disabled:!fName.trim(),style:{padding:'6px 16px',borderRadius:'6px',border:'none',background:fName.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:fName.trim()?'#0a0e17':'#666',fontSize:'11px',cursor:'pointer',fontWeight:500},children:showCreate?'Criar Agente':'Salvar'})
              ]})
            ]})
          }):
        sel?
          // DETAIL VIEW
          c.jsxs('div',{className:'flex-1 overflow-y-auto',style:{padding:'16px'},children:[
            // Header
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'},children:[
              c.jsxs('div',{children:[
                c.jsx('div',{style:{fontSize:'16px',fontWeight:600},children:sel.name}),
                c.jsx('div',{style:{fontSize:'11px',color:'#888',marginTop:'2px'},children:sel.description||'Sem descricao'}),
              ]}),
              c.jsxs('div',{style:{display:'flex',gap:'4px'},children:[
                c.jsx('button',{onClick:()=>startEdit(sel),style:{padding:'4px 10px',borderRadius:'4px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#888',fontSize:'10px',cursor:'pointer'},children:'Editar'}),
                c.jsx('button',{onClick:()=>deleteAgent(sel.id),style:{padding:'4px 10px',borderRadius:'4px',border:'none',background:'rgba(255,77,77,0.1)',color:'#ff6b6b',fontSize:'10px',cursor:'pointer'},children:'Remover'}),
              ]})
            ]}),
            // Info cards
            c.jsxs('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'},children:[
              c.jsxs('div',{style:{padding:'10px',borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'},children:[
                c.jsx('div',{style:{fontSize:'9px',color:'#888',marginBottom:'4px'},children:'TIPO'}),
                c.jsx('div',{style:{fontSize:'12px',fontWeight:500,color:typeColor(sel.agent_type)},children:typeLabel(sel.agent_type)})
              ]}),
              c.jsxs('div',{style:{padding:'10px',borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'},children:[
                c.jsx('div',{style:{fontSize:'9px',color:'#888',marginBottom:'4px'},children:'PROVIDER'}),
                c.jsxs('div',{style:{fontSize:'12px'},children:[
                  statusIcon(providerStatus[sel.provider_name?.toLowerCase?.()]),' ',sel.provider_name||'N/A'
                ]})
              ]}),
            ]}),
            // Model selector
            c.jsxs('div',{style:{padding:'12px',borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'9px',color:'#888',marginBottom:'6px'},children:'MODELO'}),
              c.jsx('div',{style:{fontSize:'13px',fontWeight:500,marginBottom:'8px'},children:sel.model_name||'Nenhum'}),
              c.jsx('select',{value:sel.model_id||'',onChange:ev=>changeModel(sel.id,ev.target.value),style:{width:'100%',background:'#0d1117',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#00e5cc',fontSize:'11px'},children:[
                c.jsx('option',{value:'',children:'Selecionar modelo...'}),
                ...models.map(m=>c.jsx('option',{key:m.id,value:m.id,children:m.name+' ('+m.provider_name+')'}))
              ]})
            ]}),
            // Capabilities
            sel.capabilities&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'9px',color:'#888',marginBottom:'4px'},children:'CAPACIDADES'}),
              c.jsx('div',{style:{display:'flex',gap:'4px',flexWrap:'wrap'},children:
                JSON.parse(sel.capabilities||'[]').map((cap,i)=>c.jsx('span',{key:i,style:{padding:'2px 8px',borderRadius:'10px',background:'rgba(0,229,204,0.1)',color:'#00e5cc',fontSize:'10px'},children:cap}))
              })
            ]}),
            // ACPX command
            sel.acpx_command&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'9px',color:'#888',marginBottom:'4px'},children:'COMANDO ACPX'}),
              c.jsx('div',{style:{fontSize:'11px',color:'#9382ff',padding:'6px 10px',borderRadius:'4px',background:'rgba(147,130,255,0.08)',fontFamily:'monospace'},children:sel.acpx_command})
            ]}),
            // System prompt
            sel.system_prompt&&c.jsxs('div',{style:{marginBottom:'12px'},children:[
              c.jsx('div',{style:{fontSize:'9px',color:'#888',marginBottom:'4px'},children:'SYSTEM PROMPT'}),
              c.jsx('div',{style:{fontSize:'11px',color:'#ccc',padding:'8px 10px',borderRadius:'6px',background:'rgba(0,0,0,0.2)',whiteSpace:'pre-wrap',maxHeight:'120px',overflow:'auto'},children:sel.system_prompt})
            ]}),
          ]}):
          // EMPTY STATE
          c.jsxs('div',{style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#555'},children:[
            c.jsx('div',{style:{fontSize:'28px',marginBottom:'6px'},children:'\u{1F916}'}),
            c.jsx('div',{style:{fontSize:'12px'},children:'Selecione um agente'}),
            c.jsx('div',{style:{fontSize:'10px',color:'#444',marginTop:'4px'},children:'ou crie um novo'})
          ]})
      })
    ]})
  });
}
export{AgentManager as default};
