// public/js/verificar-sesion.js
function verificarSesion() {
    const userId = sessionStorage.getItem('usuarioId'); // Usar sessionStorage
    const rutaActual = window.location.pathname;
    
    // Páginas que NO requieren sesión (públicas)
    const paginasPublicas = [
        '/', 
        '/index.html',
        '/login', 
        '/login.html',
        '/registro', 
        '/registro.html',
        '/verificacion', 
        '/verificacion.html',
        '/admin', 
        '/admin.html',
        '/admin/verificacionadmin',
        '/verificacionadmin.html'
    ];
    
    // Páginas que requieren sesión (protegidas)
    const paginasProtegidas = [
        '/chats', '/chats.html',
        '/contactos', '/contactos.html',
        '/ajustes', '/ajustes.html',
        '/archivados', '/archivados.html',
        '/conversacion', '/conversacion.html',
        '/chatsgrupos', '/chatsgrupos.html',
        '/grupos', '/grupos.html',
        '/cifrado', '/cifrado.html'
    ];
    
    // Caso 1: No hay sesión y está en página protegida
    if (!userId && paginasProtegidas.includes(rutaActual)) {
        console.log('🔒 Sesión no encontrada, redirigiendo a login');
        window.location.href = '/login';
        return false;
    }
    
    // Caso 2: Hay sesión y está en página pública (excepto completar-perfil)
    if (userId && paginasPublicas.includes(rutaActual) && rutaActual !== '/completar-perfil') {
        console.log('✅ Sesión activa, redirigiendo a chats');
        window.location.href = '/chats';
        return false;
    }
    
    // Caso especial: completar-perfil - no redirigir
    if (rutaActual === '/completar-perfil' || rutaActual === '/completar-perfil.html') {
        return true;
    }
    
    console.log('✅ Verificación de sesión completada');
    return true;
}

// Ejecutar inmediatamente
verificarSesion();