function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

function mostrarError(msg) {
  document.getElementById('pantalla-cargando').classList.add('hidden');
  document.getElementById('pantalla-error').classList.remove('hidden');
  document.getElementById('mensaje-error').textContent = msg;
}

async function cargarCatalogo() {
  if (!SUPABASE_CONFIGURADO) {
    mostrarError('Esta tienda todavía no terminó de configurarse.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('tienda');
  if (!slug) { mostrarError('Falta indicar qué catálogo mostrar.'); return; }

  try {
    const { data: perfil, error: e1 } = await db.from('profiles').select('*').eq('slug', slug).single();
    if (e1 || !perfil) { mostrarError('No encontramos este catálogo.'); return; }

    const { data: productos, error: e2 } = await db
      .from('productos')
      .select('*')
      .eq('user_id', perfil.id)
      .eq('publico', true)
      .order('created_at', { ascending: false });
    if (e2) { mostrarError('No se pudo cargar el catálogo. Probá de nuevo en un momento.'); return; }

    document.getElementById('cat-nombre-negocio').textContent = perfil.nombre_negocio;
    const grid = document.getElementById('cat-grid');

    if (!productos || productos.length === 0) {
      grid.innerHTML = `<p style="color:rgba(247,241,228,.7);text-align:center;grid-column:1/-1">
        Todavía no hay productos publicados.</p>`;
    } else {
      grid.innerHTML = productos.map((p) => {
        const img = p.imagen_url
          ? `<img class="kraft-img" src="${escapeHtml(p.imagen_url)}" alt="${escapeHtml(p.nombre)}">`
          : `<div class="kraft-img"></div>`;
        const waBtn = perfil.whatsapp
          ? `<a class="kraft-wa" target="_blank" href="https://wa.me/${escapeHtml(perfil.whatsapp)}?text=${encodeURIComponent('Hola! Quiero consultar por: ' + p.nombre)}">Pedir por WhatsApp</a>`
          : '';
        return `
          <div class="kraft-tag">
            ${img}
            <div class="kraft-body">
              <h3>${escapeHtml(p.nombre)}</h3>
              ${p.descripcion ? `<p class="kraft-desc">${escapeHtml(p.descripcion)}</p>` : ''}
              <div class="kraft-price">$${Number(p.precio).toFixed(2)}</div>
              ${waBtn}
            </div>
          </div>`;
      }).join('');
    }

    document.getElementById('pantalla-cargando').classList.add('hidden');
    document.getElementById('catalogo').classList.remove('hidden');
  } catch (err) {
    mostrarError('No se pudo conectar. Probá de nuevo en un momento.');
  }
}

cargarCatalogo();
