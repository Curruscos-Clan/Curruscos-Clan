(function(){
  if (!document.querySelector('script[data-curruscos-preferences]')) {
    const preferencesScript = document.createElement("script");
    preferencesScript.src = new URL("js/preferences.js", document.baseURI).href;
    preferencesScript.dataset.curruscosPreferences = "true";
    document.head.appendChild(preferencesScript);
  }
  const items=[
    {href:"index.html",key:"nav.home",label:"Inicio",pages:["index.html"]},
    {href:"explorar.html",key:"nav.search",label:"Buscar",pages:["explorar.html","evento-publico.html","crear-evento.html"]},
    {href:"mis-planes.html",key:"nav.myPlans",label:"Mis planes",pages:["mis-planes.html","mis-eventos.html","eventos.html","dashboard.html"]},
    {href:"perfil.html",key:"nav.myProfile",label:"Mi perfil",pages:["perfil.html"]}
  ];
  const translate=(key,fallback)=>{
    const value=window.curruscosI18n?.t?.(key);
    return value&&value!==key?value:fallback;
  };
  function init(){
    const nav=document.getElementById("mainNav");
    const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
    const activeItem=items.find(item=>item.pages.includes(page));
    if(nav){
      nav.innerHTML=items.map(item=>{
        const active=item===activeItem;
        return '<a href="'+item.href+'"'+(active?' class="active" aria-current="page"':'')+'>'+translate(item.key,item.label)+'</a>';
      }).join("");
      nav.setAttribute("aria-label",translate("nav.primary","Navegación principal"));
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
      button.setAttribute("aria-expanded","false");\n      button.setAttribute("aria-label",translate("nav.openMenu","Abrir menú"));
      button.setAttribute("aria-controls","mainNav");
      const setMenuOpen=open=>{
        nav.classList.toggle("mobile-open",open);
        button.setAttribute("aria-expanded",String(open));
        button.setAttribute("aria-label",translate(open?"nav.closeMenu":"nav.openMenu",open?"Cerrar menú":"Abrir menú"));
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
  window.addEventListener("curruscos:language-changed",init);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
