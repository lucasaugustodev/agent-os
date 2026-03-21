import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function Flows(){
  const[flows,setFlows]=(0,o.useState)([]);
  const[templates,setTemplates]=(0,o.useState)([]);
  const[selected,setSelected]=(0,o.useState)(null);
  const[selectedFlow,setSelectedFlow]=(0,o.useState)(null);
  const[showCreate,setShowCreate]=(0,o.useState)(false);
  const[newInput,setNewInput]=(0,o.useState)('');
  const[newTemplate,setNewTemplate]=(0,o.useState)('');
  const[loading,setLoading]=(0,o.useState)(true);

  const columns=[
    {id:'backlog',label:'Backlog',color:'#888'},
    {id:'running',label:'Running',color:'#00e5cc'},
    {id:'paused',label:'Paused',color:'#ffb84d'},
    {id:'completed',label:'Done',color:'#4ade80'},
    {id:'failed',label:'Failed',color:'#ff6b6b'},
  ];

  (0,o.useEffect)(()=>{
    loadData();
    const iv=setInterval(loadData,5000);
    return()=>clearInterval(iv);
  },[]);

  function loadData(){
    Promise.all([
      fetch('/api/flows').then(r=>r.json()),
      fetch('/api/flow-templates').then(r=>r.json()),
    ]).then(([f,t])=>{setFlows(f);setTemplates(t);setLoading(false)}).catch(()=>setLoading(false));
  }

  function selectFlow(f){
    setSelected(f.id);
    fetch('/api/flows/'+f.id).then(r=>r.json()).then(setSelectedFlow).catch(()=>{});
  }

  async function createFlow(){
    if(!newTemplate||!newInput.trim()) return;
    const resp=await fetch('/api/flows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template_id:newTemplate,input:newInput})});
    const data=await resp.json();
    setShowCreate(false);setNewInput('');setNewTemplate('');
    loadData();
  }

  async function startFlow(id){
    await fetch('/api/flows/'+id+'/start',{method:'POST'});
    loadData();
  }

  async function cancelFlow(id){
    await fetch('/api/flows/'+id+'/cancel',{method:'POST'});
    loadData();
  }

  const statusDot=s=>({backlog:'#888',running:'#00e5cc',paused:'#ffb84d',completed:'#4ade80',failed:'#ff6b6b',cancelled:'#666'}[s]||'#888');

  const c=(0,t())
  return c.jsx('div',{className:'flex flex-col h-full',style:{background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:
    c.jsxs('div',{className:'flex flex-col h-full',children:[
      // Header
      c.jsxs('div',{className:'shrink-0',style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
        c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'8px'},children:[
          c.jsx('span',{style:{fontSize:'13px',fontWeight:600,color:'#00e5cc'},children:'Flows'}),
          c.jsx('span',{style:{fontSize:'10px',color:'#888'},children:flows.length+' flows'})
        ]}),
        c.jsx('button',{onClick:()=>setShowCreate(!showCreate),style:{padding:'4px 12px',borderRadius:'6px',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',fontSize:'11px',cursor:'pointer',fontWeight:500},children:showCreate?'Cancelar':'+ Novo Flow'})
      ]}),
      // Create flow form
      showCreate&&c.jsxs('div',{className:'shrink-0',style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,229,204,0.03)'},children:[
        c.jsxs('div',{style:{display:'flex',gap:'6px',marginBottom:'6px',flexWrap:'wrap'},children:
          templates.map(t=>c.jsx('button',{key:t.id,onClick:()=>setNewTemplate(t.id),style:{padding:'3px 10px',borderRadius:'10px',border:'1px solid '+(newTemplate===t.id?'#00e5cc':'rgba(255,255,255,0.1)'),background:newTemplate===t.id?'rgba(0,229,204,0.12)':'transparent',color:newTemplate===t.id?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:t.name}))
        }),
        c.jsxs('div',{style:{display:'flex',gap:'6px'},children:[
          c.jsx('input',{type:'text',value:newInput,onChange:ev=>setNewInput(ev.target.value),onKeyDown:ev=>{if(ev.key==='Enter') createFlow()},placeholder:'Descreva o que quer fazer...',style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}}),
          c.jsx('button',{onClick:createFlow,disabled:!newTemplate||!newInput.trim(),style:{padding:'6px 14px',borderRadius:'6px',border:'none',background:newTemplate&&newInput.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:newTemplate&&newInput.trim()?'#0a0e17':'#666',fontSize:'11px',cursor:'pointer',fontWeight:500},children:'Criar'})
        ]})
      ]}),
      // Content: Kanban or Detail
      c.jsxs('div',{className:'flex flex-1 overflow-hidden',children:[
        // Kanban board
        c.jsx('div',{className:'flex flex-1 overflow-x-auto',style:{padding:'10px 8px',gap:'8px'},children:
          columns.map(col=>{
            const colFlows=flows.filter(f=>f.status===col.id||(col.id==='failed'&&f.status==='cancelled'));
            return c.jsxs('div',{key:col.id,style:{minWidth:'160px',flex:1,display:'flex',flexDirection:'column'},children:[
              // Column header
              c.jsxs('div',{className:'shrink-0',style:{padding:'6px 10px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
                c.jsxs('span',{style:{fontSize:'10px',fontWeight:600,color:col.color,textTransform:'uppercase',letterSpacing:'0.5px'},children:[col.label]}),
                colFlows.length>0&&c.jsx('span',{style:{fontSize:'9px',color:'#666',background:'rgba(255,255,255,0.06)',padding:'1px 5px',borderRadius:'6px'},children:colFlows.length})
              ]}),
              // Cards
              c.jsx('div',{className:'flex-1 overflow-y-auto',style:{display:'flex',flexDirection:'column',gap:'6px'},children:
                colFlows.map(f=>c.jsxs('div',{key:f.id,onClick:()=>selectFlow(f),style:{padding:'10px',borderRadius:'8px',background:selected===f.id?'rgba(0,229,204,0.08)':'rgba(255,255,255,0.03)',border:'1px solid '+(selected===f.id?'rgba(0,229,204,0.2)':'rgba(255,255,255,0.04)'),cursor:'pointer'},children:[
                  c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'},children:[
                    c.jsx('span',{style:{fontSize:'11px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'120px'},children:f.name}),
                    c.jsx('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:statusDot(f.status)}})
                  ]}),
                  // Progress bar
                  f.total_steps>0&&c.jsx('div',{style:{height:'3px',borderRadius:'2px',background:'rgba(255,255,255,0.06)',marginBottom:'4px'},children:
                    c.jsx('div',{style:{height:'100%',borderRadius:'2px',background:col.color,width:Math.round((f.current_step/f.total_steps)*100)+'%',transition:'width 0.3s'}})
                  }),
                  c.jsxs('div',{style:{fontSize:'9px',color:'#888'},children:[
                    f.current_step||0,'/',f.total_steps||0,' etapas',
                    f.template_id?' \u00B7 '+f.template_id:''
                  ]})
                ]}))
              })
            ]});
          })
        }),
        // Detail panel
        selected&&selectedFlow&&c.jsxs('div',{className:'flex flex-col shrink-0 overflow-y-auto',style:{width:'280px',borderLeft:'1px solid rgba(255,255,255,0.06)',padding:'12px'},children:[
          c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'},children:[
            c.jsx('span',{style:{fontSize:'12px',fontWeight:600,color:'#00e5cc'},children:'Detalhes'}),
            c.jsx('button',{onClick:()=>{setSelected(null);setSelectedFlow(null)},style:{border:'none',background:'rgba(255,255,255,0.06)',color:'#888',padding:'2px 6px',borderRadius:'4px',fontSize:'9px',cursor:'pointer'},children:'\u2715'})
          ]}),
          c.jsx('div',{style:{fontSize:'12px',fontWeight:500,marginBottom:'4px'},children:selectedFlow.name}),
          c.jsxs('div',{style:{fontSize:'10px',color:'#888',marginBottom:'10px'},children:['Status: ',selectedFlow.status,' \u00B7 ',selectedFlow.current_step,'/',selectedFlow.total_steps]}),
          // Action buttons
          c.jsxs('div',{style:{display:'flex',gap:'4px',marginBottom:'10px'},children:[
            selectedFlow.status==='backlog'&&c.jsx('button',{onClick:()=>startFlow(selectedFlow.id),style:{padding:'4px 10px',borderRadius:'4px',border:'none',background:'#00e5cc',color:'#0a0e17',fontSize:'10px',cursor:'pointer',fontWeight:500},children:'Iniciar'}),
            (selectedFlow.status==='running'||selectedFlow.status==='backlog')&&c.jsx('button',{onClick:()=>cancelFlow(selectedFlow.id),style:{padding:'4px 10px',borderRadius:'4px',border:'none',background:'rgba(255,77,77,0.15)',color:'#ff6b6b',fontSize:'10px',cursor:'pointer'},children:'Cancelar'}),
            selectedFlow.thread_id&&c.jsx('button',{onClick:()=>{/* TODO: open thread */},style:{padding:'4px 10px',borderRadius:'4px',border:'none',background:'rgba(255,255,255,0.06)',color:'#888',fontSize:'10px',cursor:'pointer'},children:'Ver Thread'}),
          ]}),
          // Steps
          c.jsx('div',{style:{fontSize:'10px',fontWeight:600,color:'#aaa',marginBottom:'6px'},children:'Etapas'}),
          (selectedFlow.steps||[]).map((s,i)=>c.jsxs('div',{key:i,style:{padding:'6px 8px',marginBottom:'4px',borderRadius:'4px',background:s.status==='completed'?'rgba(74,222,128,0.08)':s.status==='running'?'rgba(0,229,204,0.08)':s.status==='failed'?'rgba(255,77,77,0.08)':'rgba(255,255,255,0.02)',borderLeft:'2px solid '+(s.status==='completed'?'#4ade80':s.status==='running'?'#00e5cc':s.status==='failed'?'#ff6b6b':'#444')},children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
              c.jsxs('span',{style:{fontSize:'10px',fontWeight:500},children:[(i+1),'. ',s.name]}),
              c.jsx('span',{style:{fontSize:'8px',color:s.status==='completed'?'#4ade80':s.status==='running'?'#00e5cc':'#666'},children:s.status})
            ]}),
            c.jsx('div',{style:{fontSize:'9px',color:'#888'},children:s.agent_id}),
            s.duration_ms&&c.jsx('div',{style:{fontSize:'8px',color:'#555'},children:Math.round(s.duration_ms/1000)+'s'}),
            s.output&&c.jsx('div',{style:{fontSize:'9px',color:'#aaa',marginTop:'3px',maxHeight:'60px',overflow:'hidden',textOverflow:'ellipsis'},children:s.output.substring(0,150)+'...'})
          ]})),
          // Input
          selectedFlow.input&&c.jsxs('div',{style:{marginTop:'8px'},children:[
            c.jsx('div',{style:{fontSize:'10px',fontWeight:600,color:'#aaa',marginBottom:'4px'},children:'Input'}),
            c.jsx('div',{style:{fontSize:'10px',color:'#ccc',background:'rgba(0,0,0,0.2)',padding:'6px',borderRadius:'4px'},children:selectedFlow.input})
          ]})
        ]})
      ]})
    ]})
  });
}
export{Flows as default};
