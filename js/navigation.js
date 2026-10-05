(function(){
  const items=[
    {href:"index.html",label:"Inicio"},
    {href:"explorar.html",label:"Explorar"},
    {href:"guardados.html",label:"Guardados"},
    {href:"mis-eventos.html",label:"Mis planes"},
    {href:"dashboard.html",label:"Grupos"}
  ];
  function init(){
    const nav=document.getElementById("mainNav");
    if(!nav)return;
    nav.innerHTML=items.map(i=>'<a href="'+i.href+'">'+i.label+'</a>').join("")+
      '<a class="nav-create" href="crear.html">Crear</a>';
    const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
    nav.querySelectorAll("a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")===page));
    const button=document.getElementById("menuButton");
    if(button && button.dataset.navReady!=="true"){
      button.dataset.navReady="true";button.setAttribute("aria-expanded","false");
      button.addEventListener("click",e=>{e.stopPropagation();const open=nav.classList.toggle("mobile-open");button.setAttribute("aria-expanded",String(open));});
      document.addEventListener("click",e=>{if(!nav.contains(e.target)&&e.target!==button){nav.classList.remove("mobile-open");button.setAttribute("aria-expanded","false");}});
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
