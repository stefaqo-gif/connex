// ==========================================
// 🔐 GENERACIÓN Y DISTRIBUCIÓN DE LLAVE DE GRUPO
// ==========================================
async function crearClaveGrupo(idGrupo, usuarios) {
    console.log("🚀 Iniciando generación de clave maestra para el grupo...");

    // 1. GENERACIÓN DE LLAVE BINARIA REAL (AES-256)
    // Usar crypto.getRandomValues garantiza que la llave SIEMPRE sea nueva y aleatoria.
    const bufferAleatorio = new Uint8Array(32);
    window.crypto.getRandomValues(bufferAleatorio);
    
    const claveGrupoBase64 = btoa(String.fromCharCode(...bufferAleatorio));
    console.log("📦 NUEVA Clave Maestra (Base64) generada:", claveGrupoBase64);

    if (!usuarios || usuarios.length === 0) {
        console.error("❌ No hay usuarios para procesar.");
        return false;
    }

    // OPCIONAL: Podrías llamar a un endpoint para limpiar llaves viejas del grupo aquí
    // await fetch(`/api/clavesgrupo/limpiar/${idGrupo}`, { method: 'DELETE' });

    // 2. PROCESO DE CIFRADO INDIVIDUAL PARA CADA INTEGRANTE
    const promesas = usuarios.map(async (usuario) => {
        const idActual = usuario.id_usuario || usuario.id;

        try {
            // Obtener la llave pública RSA del integrante
            const pubKey = await window.importarLlavePublicaReceptor(idActual);

            if (!pubKey) {
                console.warn(`⚠️ Usuario ${idActual} sin llave pública. Saltando...`);
                return;
            }

            // Ciframos los 32 bytes aleatorios directamente con RSA-OAEP
            const encryptedBuffer = await window.crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                pubKey,
                bufferAleatorio 
            );

            const claveCifradaParaUsuario = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

            // 3. GUARDAR EN LA BASE DE DATOS
            const res = await fetch('/api/clavesgrupo/guardar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_grupo: idGrupo,
                    id_usuario: idActual,
                    clave_cifrada: claveCifradaParaUsuario,
                    timestamp: Date.now() // Forzamos al servidor a notar el cambio
                })
            });

            if (res.ok) {
                console.log(`✅ Clave actualizada para ID: ${idActual}`);
            }
        } catch (error) {
            console.error(`❌ Error con usuario ${idActual}:`, error);
        }
    });

    // Esperamos a que TODAS las llaves se guarden antes de terminar
    await Promise.all(promesas);
    
    console.log("🏁 Proceso de rotación finalizado en base de datos.");
    return true; // Retornamos éxito
}

window.crearClaveGrupo = crearClaveGrupo;