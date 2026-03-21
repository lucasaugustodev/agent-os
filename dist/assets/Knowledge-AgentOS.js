import{o as e,t}from"./jsx-runtime-9YgKe2Eq.js";import{n}from"./createLucideIcon-w2iZEdg8.js";var o=e(n(),1);

function Knowledge(){
  const[knowledge,setKnowledge]=(0,o.useState)([]);
  const[vault,setVault]=(0,o.useState)([]);
  const[files,setFiles]=(0,o.useState)([]);
  const[selectedItem,setSelectedItem]=(0,o.useState)(null);
  const[selectedContent,setSelectedContent]=(0,o.useState)('');
  const[tab,setTab]=(0,o.useState)('knowledge');
  const[search,setSearch]=(0,o.useState)('');
  const[loading,setLoading]=(0,o.useState)(true);
  const[chatOpen,setChatOpen]=(0,o.useState)(false);
  const[chatInput,setChatInput]=(0,o.useState)('');
  const[chatMessages,setChatMessages]=(0,o.useState)([]);
  const[chatSending,setChatSending]=(0,o.useState)(false);
  const chatRef=(0,o.useRef)(null);

  (0,o.useEffect)(()=>{
    Promise.all([
      fetch('/api/memory/knowledge').then(r=>r.json()),
      fetch('/api/memory/vault').then(r=>r.json()),
      fetch('/api/memory/files').then(r=>r.json()),
    ]).then(([k,v,f])=>{setKnowledge(k);setVault(v);setFiles(f);setLoading(false)}).catch(()=>setLoading(false));
  },[]);

  (0,o.useEffect)(()=>{if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight},[chatMessages]);

  function selectKnowledge(k){
    if(selectedItem===k.id){setSelectedItem(null);setSelectedContent('');return}
    setSelectedItem(k.id);
    if(k.content){setSelectedContent(k.content)}
    else{fetch('/api/memory/knowledge/'+k.id).then(r=>r.json()).then(d=>setSelectedContent(d.content||'')).catch(()=>{})}
  }

  function selectFile(f){
    if(selectedItem===f.file){setSelectedItem(null);setSelectedContent('');return}
    setSelectedItem(f.file);
    fetch('/api/memory/files/'+f.file).then(r=>r.json()).then(d=>setSelectedContent(d.content||'')).catch(()=>{})
  }

  async function sendChat(){
    const msg=chatInput.trim();if(!msg||chatSending) return;
    setChatInput('');setChatSending(true);
    setChatMessages(prev=>[...prev,{role:'user',text:msg}]);
    try{
      const resp=await fetch('/api/smol/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Busca na base de conhecimento e responde: '+msg,stream:true})});
      const reader=resp.body?.getReader();const decoder=new TextDecoder();let buffer='',result='';
      while(true){const{done,value}=await reader.read();if(done) break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){if(!line.startsWith('data: ')) continue;const data=line.slice(6).trim();if(data==='[DONE]') continue;
          try{const ev=JSON.parse(data);if(ev.event==='done') result=ev.result||''}catch{}}}
      if(result) setChatMessages(prev=>[...prev,{role:'assistant',text:result}]);
    }catch(err){setChatMessages(prev=>[...prev,{role:'system',text:'Erro: '+err.message}])}
    setChatSending(false);
  }

  const filtered=search?knowledge.filter(k=>(k.title+(k.type||'')+(k.tags||'')).toLowerCase().includes(search.toLowerCase())):knowledge;
  const typeColor=t=>({error_resolution:'#ff6b6b',decision:'#9382ff',pattern:'#00e5cc',info:'#ffb84d',configuracao_importante:'#ff9f43'}[t]||'#888');
  const typeEmoji=t=>({error_resolution:'\u{274C}',decision:'\u{1F9ED}',pattern:'\u{1F504}',info:'\u{1F4A1}',configuracao_importante:'\u{1F511}'}[t]||'\u{1F4D6}');

  const c=(0,t())
  return c.jsx('div',{className:'flex flex-col h-full',style:{background:'#0a0e17',color:'#e0e0e0',fontFamily:'Inter,sans-serif'},children:
    c.jsxs('div',{className:'flex h-full overflow-hidden',children:[
      // MAIN CONTENT
      c.jsxs('div',{className:'flex flex-col flex-1 overflow-hidden',children:[
        // Header
        c.jsxs('div',{className:'shrink-0',style:{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
          c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'8px'},children:[
            c.jsx('span',{style:{fontSize:'13px',fontWeight:600,color:'#00e5cc'},children:'Knowledge Base'}),
            c.jsx('span',{style:{fontSize:'10px',color:'#888'},children:knowledge.length+' docs \u00B7 '+vault.length+' keys \u00B7 '+files.length+' files'})
          ]}),
          c.jsxs('div',{style:{display:'flex',gap:'3px'},children:[
            c.jsx('button',{onClick:()=>{setTab('knowledge');setSelectedItem(null)},style:{padding:'3px 10px',borderRadius:'4px',border:'none',background:tab==='knowledge'?'rgba(0,229,204,0.15)':'rgba(255,255,255,0.06)',color:tab==='knowledge'?'#00e5cc':'#888',fontSize:'10px',cursor:'pointer'},children:'Knowledge'}),
            c.jsx('button',{onClick:()=>{setTab('vault');setSelectedItem(null)},style:{padding:'3px 10px',borderRadius:'4px',border:'none',background:tab==='vault'?'rgba(255,184,77,0.15)':'rgba(255,255,255,0.06)',color:tab==='vault'?'#ffb84d':'#888',fontSize:'10px',cursor:'pointer'},children:'Vault'}),
            c.jsx('button',{onClick:()=>{setTab('files');setSelectedItem(null)},style:{padding:'3px 10px',borderRadius:'4px',border:'none',background:tab==='files'?'rgba(147,130,255,0.15)':'rgba(255,255,255,0.06)',color:tab==='files'?'#9382ff':'#888',fontSize:'10px',cursor:'pointer'},children:'Memory'}),
          ]})
        ]}),
        // Search
        c.jsx('div',{className:'shrink-0',style:{padding:'6px 16px'},children:
          c.jsx('input',{type:'text',value:search,onChange:ev=>setSearch(ev.target.value),placeholder:tab==='knowledge'?'Buscar conhecimento...':tab==='vault'?'Buscar keys...':'Buscar arquivos...',style:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 10px',color:'#e0e0e0',fontSize:'11px',outline:'none'}})
        }),
        // Content split: list + detail
        c.jsxs('div',{className:'flex flex-1 overflow-hidden',children:[
          // List
          c.jsx('div',{className:'overflow-y-auto',style:{width:selectedItem?'45%':'100%',borderRight:selectedItem?'1px solid rgba(255,255,255,0.06)':'none',transition:'width 0.2s'},children:
            loading?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#666',fontSize:'12px'},children:'Carregando...'}):

            tab==='knowledge'?(filtered.length===0?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#555',fontSize:'11px'},children:'Nenhum conhecimento'}):
              filtered.map(k=>c.jsxs('div',{key:k.id,onClick:()=>selectKnowledge(k),style:{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.03)',background:selectedItem===k.id?'rgba(0,229,204,0.06)':'transparent',cursor:'pointer',borderLeft:'3px solid '+typeColor(k.type)},children:[
                c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'},children:[
                  c.jsx('span',{style:{fontSize:'12px'},children:typeEmoji(k.type)}),
                  c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:k.title}),
                ]}),
                c.jsxs('div',{style:{display:'flex',gap:'4px',alignItems:'center'},children:[
                  c.jsx('span',{style:{fontSize:'9px',padding:'1px 5px',borderRadius:'8px',background:typeColor(k.type)+'22',color:typeColor(k.type)},children:k.type||'info'}),
                  k.agent_id&&c.jsx('span',{style:{fontSize:'9px',color:'#666'},children:k.agent_id}),
                  c.jsx('span',{style:{fontSize:'9px',color:'#555'},children:new Date(k.created_at).toLocaleDateString('pt-BR')}),
                ]}),
                k.tags&&!selectedItem&&c.jsx('div',{style:{display:'flex',gap:'2px',marginTop:'3px',flexWrap:'wrap'},children:
                  JSON.parse(k.tags||'[]').slice(0,4).map((tag,i)=>c.jsx('span',{key:i,style:{fontSize:'8px',padding:'1px 4px',borderRadius:'4px',background:'rgba(255,255,255,0.05)',color:'#999'},children:tag}))
                }),
              ]}))):

            tab==='vault'?(vault.length===0?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#555',fontSize:'11px'},children:'Vault vazio'}):
              vault.map(v=>c.jsxs('div',{key:v.id,onClick:()=>{setSelectedItem(selectedItem===v.id?null:v.id);setSelectedContent(JSON.stringify(v,null,2))},style:{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.03)',background:selectedItem===v.id?'rgba(255,184,77,0.06)':'transparent',cursor:'pointer',borderLeft:'3px solid #ff9f43'},children:[
                c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'},children:[
                  c.jsx('span',{children:'\u{1F511}'}),
                  c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:v.key_name}),
                ]}),
                c.jsx('div',{style:{fontSize:'10px',color:'#aaa'},children:v.description||v.category}),
                c.jsxs('div',{style:{fontSize:'9px',color:'#555',marginTop:'2px'},children:[v.source,' \u00B7 ',new Date(v.detected_at).toLocaleDateString('pt-BR')]})
              ]}))):

            // Files
            (files.length===0?c.jsx('div',{style:{padding:'20px',textAlign:'center',color:'#555',fontSize:'11px'},children:'Sem arquivos'}):
              files.map((f,i)=>c.jsxs('div',{key:i,onClick:()=>selectFile(f),style:{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.03)',background:selectedItem===f.file?'rgba(147,130,255,0.06)':'transparent',cursor:'pointer',borderLeft:'3px solid #9382ff'},children:[
                c.jsxs('div',{style:{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'},children:[
                  c.jsx('span',{children:'\u{1F4C4}'}),
                  c.jsx('span',{style:{fontSize:'12px',fontWeight:500},children:f.title}),
                ]}),
                c.jsxs('div',{style:{display:'flex',gap:'4px',alignItems:'center'},children:[
                  c.jsx('span',{style:{fontSize:'9px',padding:'1px 5px',borderRadius:'8px',background:'rgba(147,130,255,0.15)',color:'#9382ff'},children:f.type}),
                  f.tags&&f.tags.map((tag,j)=>c.jsx('span',{key:j,style:{fontSize:'8px',padding:'1px 4px',borderRadius:'4px',background:'rgba(255,255,255,0.05)',color:'#999'},children:tag}))
                ]})
              ]})))
          }),
          // Detail panel (shown when item selected)
          selectedItem&&c.jsxs('div',{className:'flex-1 overflow-y-auto',style:{padding:'14px 16px'},children:[
            c.jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'},children:[
              c.jsx('span',{style:{fontSize:'12px',fontWeight:600,color:'#00e5cc'},children:'Detalhes'}),
              c.jsx('button',{onClick:()=>{setSelectedItem(null);setSelectedContent('')},style:{border:'none',background:'rgba(255,255,255,0.06)',color:'#888',padding:'2px 8px',borderRadius:'4px',fontSize:'10px',cursor:'pointer'},children:'\u2715 Fechar'})
            ]}),
            c.jsx('div',{style:{fontSize:'11px',lineHeight:1.6,whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#ccc',background:'rgba(0,0,0,0.2)',padding:'12px',borderRadius:'6px'},children:selectedContent||'Carregando...'})
          ]})
        ]})
      ]}),
      // CHAT PANEL (toggle with brain button)
      chatOpen&&c.jsxs('div',{className:'flex flex-col shrink-0',style:{width:'300px',borderLeft:'1px solid rgba(255,255,255,0.06)'},children:[
        c.jsxs('div',{className:'shrink-0',style:{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'},children:[
          c.jsx('span',{style:{fontSize:'11px',fontWeight:600,color:'#00e5cc'},children:'Perguntar ao Knowledge'}),
          c.jsx('button',{onClick:()=>setChatOpen(false),style:{border:'none',background:'none',color:'#888',cursor:'pointer',fontSize:'12px'},children:'\u2715'})
        ]}),
        c.jsx('div',{ref:chatRef,className:'flex-1 overflow-y-auto',style:{padding:'8px 10px'},children:
          chatMessages.length===0?c.jsx('div',{style:{textAlign:'center',padding:'20px',color:'#555',fontSize:'11px'},children:'Pergunte sobre o conhecimento salvo'}):
          chatMessages.map((m,i)=>c.jsx('div',{key:i,style:{marginBottom:'6px',display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'},children:
            c.jsx('div',{style:{maxWidth:'90%',padding:'6px 10px',borderRadius:'10px',background:m.role==='user'?'rgba(0,229,204,0.12)':'rgba(255,255,255,0.04)',fontSize:'11px',lineHeight:1.4,whiteSpace:'pre-wrap',wordBreak:'break-word'},children:m.text?.substring(0,800)})
          }))
        }),
        chatSending&&c.jsx('div',{className:'shrink-0',style:{padding:'4px 10px'},children:
          c.jsx('span',{style:{fontSize:'10px',color:'#00e5cc'},children:'Buscando...'})
        }),
        c.jsxs('div',{className:'shrink-0',style:{padding:'6px 10px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:'4px'},children:[
          c.jsx('input',{type:'text',value:chatInput,onChange:ev=>setChatInput(ev.target.value),onKeyDown:ev=>{if(ev.key==='Enter'){ev.preventDefault();sendChat()}},placeholder:'Perguntar...',style:{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'5px 8px',color:'#e0e0e0',fontSize:'10px',outline:'none'}}),
          c.jsx('button',{onClick:sendChat,style:{padding:'5px 10px',borderRadius:'6px',border:'none',background:chatInput.trim()?'#00e5cc':'rgba(255,255,255,0.06)',color:chatInput.trim()?'#0a0e17':'#666',fontSize:'10px',cursor:'pointer'},children:'\u{27A4}'})
        ]})
      ]}),
      // Brain toggle button (fixed right side)
      !chatOpen&&c.jsx('div',{className:'shrink-0',style:{display:'flex',alignItems:'flex-start',padding:'10px 6px'},children:
        c.jsx('button',{onClick:()=>setChatOpen(true),title:'Perguntar ao Knowledge',style:{width:'32px',height:'32px',borderRadius:'50%',border:'none',background:'rgba(0,229,204,0.15)',color:'#00e5cc',cursor:'pointer',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center'},children:'\u{1F9E0}'})
      })
    ]})
  });
}
export{Knowledge as default};
