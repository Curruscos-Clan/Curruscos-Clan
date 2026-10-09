(function(){
  const items=[
    {href:"index.html",label:"Inicio",icon:"⌂",hint:"Planes para ti"},
    {href:"explorar.html",label:"Buscar",icon:"⌕",hint:"Eventos y grupos"},
    {href:"eventos.html",label:"Mi grupo",icon:"▦",hint:"Actividad del grupo"},
    {href:"perfil.html",label:"Mi perfil",icon:"◉",hint:"Tu cuenta y actividad"}
  ];
  const secondary=[{href:"mis-eventos.html",label:"Mis planes",icon:"✓",hint:"Tu agenda personal"}];

  function init(){
    const header=document.querySelector(".navbar");
    if(!header)return;
    const nav=document.getElementById("mainNav");
    const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
    const current=page==="mis-eventos.html"?"mis-eventos.html":page;
    if(nav){
      nav.innerHTML=items.map(i=>'<a href="'+i.href+'"'+(i.href===current?' class="active" aria-current="page"':'')+'>'+i.label+'</a>').join("");
    }

    let button=document.getElementById("menuButton")||header.querySelector(".menu-button");
    if(!button){
      button=document.createElement("button");
      button.id="menuButton";button.className="menu-button";button.type="button";
      button.textContent="☰";button.setAttribute("aria-label","Abrir menú de navegación");
      header.appendChild(button);
    }
    if(button.dataset.drawerReady==="true")return;
    button.dataset.drawerReady="true";
    button.setAttribute("aria-expanded","false");
    button.setAttribute("aria-controls","ccNavDrawer");
    button.setAttribute("aria-label","Abrir menú de navegación");

    const backdrop=document.createElement("div");
    backdrop.className="cc-drawer-backdrop";backdrop.setAttribute("aria-hidden","true");
    const drawer=document.createElement("aside");
    drawer.className="cc-nav-drawer";drawer.id="ccNavDrawer";
    drawer.setAttribute("aria-label","Navegación principal");drawer.setAttribute("aria-hidden","true");
    const linkMarkup=(list)=>list.map(i=>'<a class="cc-drawer-link" href="'+i.href+'"'+(i.href===current?' aria-current="page"':'')+'><span class="cc-drawer-icon" aria-hidden="true">'+i.icon+'</span><span>'+i.label+'<small>'+i.hint+'</small></span></a>').join("");
    drawer.innerHTML='<div class="cc-drawer-head"><a class="cc-drawer-brand" href="index.html">CURRUSCOS<i></i></a><button class="cc-drawer-close" type="button" aria-label="Cerrar menú">×</button></div><p class="cc-drawer-label">Explora Curruscos</p><nav class="cc-drawer-links" aria-label="Secciones principales">'+linkMarkup(items)+'</nav><p class="cc-drawer-label">Tu actividad</p><nav class="cc-drawer-links" aria-label="Actividad personal">'+linkMarkup(secondary)+'</nav><div class="cc-drawer-footer">Descubre planes. Organiza lo que te apetece.</div>';
    document.body.append(backdrop,drawer);
    const closeButton=drawer.querySelector(".cc-drawer-close");
    let previousFocus=null;
    function close(){
      drawer.classList.remove("is-open");backdrop.classList.remove("is-open");
      drawer.setAttribute("aria-hidden","true");backdrop.setAttribute("aria-hidden","true");
      button.setAttribute("aria-expanded","false");button.setAttribute("aria-label","Abrir menú de navegación");
      document.body.style.overflow="";
      if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus();
    }
    function open(){
      previousFocus=document.activeElement;
      drawer.classList.add("is-open");backdrop.classList.add("is-open");
      drawer.setAttribute("aria-hidden","false");backdrop.setAttribute("aria-hidden","false");
      button.setAttribute("aria-expanded","true");button.setAttribute("aria-label","Cerrar menú de navegación");
      document.body.style.overflow="hidden";closeButton.focus();
    }
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();drawer.classList.contains("is-open")?close():open();});
    closeButton.addEventListener("click",close);
    backdrop.addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&drawer.classList.contains("is-open"))close();});
    drawer.addEventListener("click",e=>{if(e.target.closest("a"))close();});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();