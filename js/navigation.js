(function(){
  const items=[
    {href:"index.html",label:"Inicio",pages:["index.html"]},
    {href:"explorar.html",label:"Buscar",pages:["explorar.html","evento-publico.html","crear-evento.html"]},
    {href:"mis-planes.html",label:"Mis planes",pages:["mis-planes.html","mis-eventos.html","eventos.html","dashboard.html"]},
    {href:"perfil.html",label:"Mi perfil",pages:["perfil.html"]}
  ];
  function init(){
    const nav=document.getElementById("mainNav");
    const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
    const activeItem=items.find(item=>item.pages.includes(page));
    if(nav){
      nav.innerHTML=items.map(item=>{
        const active=item===activeItem;
        return '<a href="'+item.href+'"'+(active?' class="active" aria-current="page"':'')+'>'+item.label+'</a>';
      }).join("");
      nav.setAttribute("aria-label","Navegación principal");
    }
    const bottomNav=document.querySelector(".bottom-nav");
    if(bottomNav){
      bottomNav.querySelectorAll("a[href]").forEach(link=>{
        const active=!!activeItem&&link.getAttribute("href")===activeItem.href;
        link.classList.toggle("active",active);
        if(active)link.setAttribute("aria-current","page");
        else link.removeAttribute("aria-current");
      });
    }
    const button=document.getElementById("menuButton");
    if(button && nav && button.dataset.navReady!=="true"){
      button.dataset.navReady="true";
      button.setAttribute("aria-expanded","false");
      button.setAttribute("aria-controls","mainNav");
      const setMenuOpen=open=>{
        nav.classList.toggle("mobile-open",open);
        button.setAttribute("aria-expanded",String(open));
        button.setAttribute("aria-label",open?"Cerrar menú":"Abrir menú");
        button.textContent=open?"×":"☰";
      };
      button.addEventListener("click",e=>{
        e.stopPropagation();
        setMenuOpen(!nav.classList.contains("mobile-open"));
      });
      document.addEventListener("click",e=>{
        if(!nav.contains(e.target)&&e.target!==button)setMenuOpen(false);
      });
      document.addEventListener("keydown",e=>{
        if(e.key==="Escape"&&nav.classList.contains("mobile-open")){
          setMenuOpen(false);
          button.focus();
        }
      });
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
