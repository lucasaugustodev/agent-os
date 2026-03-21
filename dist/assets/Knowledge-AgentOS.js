import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function Knowledge(){
  const[knowledge,setKnowledge]=(0,o.useState)([]);
  const[vault,setVault]=(0,o.useState)([]);
  const[files,setFiles]=(0,o.useState)([]);
  const[selected,setSelected]=(0,o.useState)(null);
  const[tab,setTab]=(0,o.useState)('knowledge');
  const[search,setSearch]=(0,o.useState)('');
  const[loading,setLoading]=(0,o.useState)(true);

  (0,o.useEffect)(()=>{
    Promise.all([
      fetch('/api/memory/knowledge').then(r=>r.json()),
      fetch('/api/memory/vault').then(r=>r.json()),
      fetch('/api/memory/files').then(r=>r.json()),
    ]).then(([k,v,f])=>{setKnowledge(k);setVault(v);setFiles(f);setLoading(false)}).catch(()=>setLoading(false));
  },[]);

  const filtered=search?knowledge.filter(k=>(k.title+k.type+(k.tags||'')).toLowerCase().includes(search.toLowerCase())):knowledge;
  const typeColor=t=>({error_resolution:'#ff6b6b',decision:'#9382ff',pattern:'#00e5cc',info:'#ffb84d',configuracao_importante:'#ff9f43'}[t]||'#888');

  const c=(0,t())
  return c.jsx('div',{className:'flex flex-col h-full',style:{background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:
    c.jsxs('div',{className:'flex flex-col h-full',children:[
      // Header with tabs
      c.jsxs('div',{className:'shrink-0',style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
        c.jsx('div',{style:{fontSize:'13px',fontWeight:600,color:'#00e5cc'},children:'Knowledge Base'}),
        c.jsxs('div',{style:{display:'flex',gap:'3px'},children:[
          c.jsx('button',{onClick:()=>setTab('knowledge'),style:{padding:'3px 10px',borderRadius:'4px',border:'none',background:tab==='knowledge'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:tab==='knowledge'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Knowledge ('+knowledge.length+')'}),
          c.jsx('button',{onClick:()=>setTab('vault'),style:{padding:'3px 10px',borderRadius:'4px',border:'none',background:tab==='vault'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:tab==='vault'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Vault ('+vault.length+')'}),
          c.jsx('button',{onClick:()=>setTab('files'),style:{padding:'3px 10px',borderRadius:'4px',border:'none',background:tab==='files'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:tab==='files'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Memory Files ('+files.length+')'}),
        ]})
      ]}),
      // Search
      tab==='knowledge'&&c.jsx('div',{className:'shrink-0',style:{padding:'8px 16px'},children:
        c.jsx('input',{type:'text',value:search,onChange:e=>setSearch(e.target.value),placeholder:'Buscar conhecimento...',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}})
      }),
      // Content
      c.jsx('div',{className:'flex-1 overflow-y-auto',style:{padding:'8px 16px'},children:
        loading?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#666',fontSize:'12px'},children:'Carregando...'}):

        tab==='knowledge'?
          filtered.length===0?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#555',fontSize:'12px'},children:'Nenhum conhecimento registrado'}):
          filtered.map(k=>c.jsxs('div',{key:k.id,onClick:()=>setSelected(selected===k.id?null:k.id),style:{padding:'10px 14px',marginBottom:'6px',borderRadius:'8px',background:selected===k.id?'rgba(0,229,204,0.08)':'rgba(255,255,255,0.03)',borderLeft:'3px solid '+typeColor(k.type),cursor:'pointer'},children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'},children:[
              c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:k.title}),
              c.jsxs('div',{style:{display:'flex',gap:'4px',alignItems:'center'},children:[
                c.jsx('span',{style:{fontSize:'9px',padding:'1px 6px',borderRadius:'8px',background:'rgba(255,255,255,0.06)',color:typeColor(k.type)},children:k.type||'info'}),
                k.agent_id&&c.jsx('span',{style:{fontSize:'9px',color:'#888'},children:k.agent_id})
              ]})
            ]}),
            k.tags&&c.jsx('div',{style:{display:'flex',gap:'3px',flexWrap:'wrap',marginBottom:'4px'},children:
              JSON.parse(k.tags||'[]').map((tag,i)=>c.jsx('span',{key:i,style:{fontSize:'9px',padding:'1px 5px',borderRadius:'6px',background:'rgba(255,255,255,0.06)',color:'#aaa'},children:tag}))
            }),
            selected===k.id&&k.content&&c.jsx('div',{style:{marginTop:'8px',padding:'8px',borderRadius:'4px',background:'rgba(0,0,0,0.2)',fontSize:'11px',lineHeight:1.5,whiteSpace:'pre-wrap',maxHeight:'200px',overflow:'auto',color:'#ccc'},children:k.content}),
            c.jsx('div',{style:{fontSize:'9px',color:'#555',marginTop:'3px'},children:new Date(k.created_at).toLocaleString('pt-BR')})
          ]})):

        tab==='vault'?
          vault.length===0?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#555',fontSize:'12px'},children:'Nenhuma key no vault'}):
          vault.map(v=>c.jsxs('div',{key:v.id,style:{padding:'10px 14px',marginBottom:'6px',borderRadius:'8px',background:'rgba(255,255,255,0.03)',borderLeft:'3px solid #ff9f43'},children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'},children:[
              c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:v.key_name}),
              c.jsx('span',{style:{fontSize:'9px',padding:'1px 6px',borderRadius:'8px',background:'rgba(255,184,77,0.15)',color:'#ffb84d'},children:v.category})
            ]}),
            v.description&&c.jsx('div',{style:{fontSize:'11px',color:'#aaa',marginBottom:'3px'},children:v.description}),
            c.jsxs('div',{style:{fontSize:'9px',color:'#555'},children:['Detectado: ',new Date(v.detected_at).toLocaleString('pt-BR'),' · ',v.source]})
          ]})):

        // Files tab
        files.length===0?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#555',fontSize:'12px'},children:'Nenhum arquivo de memoria'}):
        files.map((f,i)=>c.jsxs('div',{key:i,onClick:()=>{fetch('/api/memory/files/'+f.file).then(r=>r.json()).then(d=>setSelected(selected===f.file?null:f.file))},style:{padding:'8px 14px',marginBottom:'4px',borderRadius:'6px',background:selected===f.file?'rgba(0,229,204,0.08)':'rgba(255,255,255,0.03)',borderLeft:'3px solid #00e5cc',cursor:'pointer'},children:[
          c.jsxs('div',{style:{display:'flex',justifyContent:'space-between'},children:[
            c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:f.title}),
            c.jsx('span',{style:{fontSize:'9px',color:'#888'},children:f.type})
          ]}),
          f.tags&&c.jsx('div',{style:{display:'flex',gap:'3px',marginTop:'3px'},children:
            f.tags.map((tag,j)=>c.jsx('span',{key:j,style:{fontSize:'9px',padding:'1px 5px',borderRadius:'6px',background:'rgba(255,255,255,0.06)',color:'#aaa'},children:tag}))
          })
        ]}))
      })
    ]})
  });
}
export{Knowledge as default};
