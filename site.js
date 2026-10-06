// SeamFlow Consulting — shared site behaviour (nav, header state, scroll reveal)
(function(){
  var header = document.getElementById('siteHeader');
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('mobileMenu');

  if(toggle && menu){
    toggle.addEventListener('click', function(){
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  if(header){
    var onScroll = function(){ header.classList.toggle('scrolled', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
  }

  var items = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){
    items.forEach(function(el){ el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, {rootMargin:'0px 0px -8% 0px', threshold:0.08});
  items.forEach(function(el){ io.observe(el); });
})();
