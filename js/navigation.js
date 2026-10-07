(function(){
  const items=[
    {href:"index.html",label:"Inicio"},
    {href:"explorar.html",label:"Buscar"},
    {href:"mis-eventos.html",label:"Mis planes"},
    {href:"perfil.html",label:"Perfil"}
  ];
  function init(){
    const nav=document.getElementById("mainNav");
    if(!nav)return;
    nav.innerHTML=items.map(i=>'<a href="'+i.href+'">'+i.label+'</a>').join("");
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