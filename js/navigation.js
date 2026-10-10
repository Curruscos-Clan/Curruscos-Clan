(function(){
  const items=[
    {href:"index.html",label:"Inicio",pages:["index.html"]},
    {href:"explorar.html",label:"Buscar",pages:["explorar.html","evento-publico.html","crear-evento.html","crear.html"]},
    {href:"eventos.html",label:"Mi grupo",pages:["eventos.html"]},
    {href:"perfil.html",label:"Mi perfil",pages:["perfil.html","mis-eventos.html"]}
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
    if(button && button.dataset.navReady!=="true"){
      button.dataset.navReady="true";button.setAttribute("aria-expanded","false");
      button.addEventListener("click",e=>{e.stopPropagation();const open=nav.classList.toggle("mobile-open");button.setAttribute("aria-expanded",String(open));});
      document.addEventListener("click",e=>{if(!nav.contains(e.target)&&e.target!==button){nav.classList.remove("mobile-open");button.setAttribute("aria-expanded","false");}});
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
