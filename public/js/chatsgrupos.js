// ===============================
// 🆔 CONFIGURACIÓN INICIAL
// ===============================
const params = new URLSearchParams(window.location.search);
const idGrupo = params.get('id');
const miId = localStorage.getItem("id_usuario") || sessionStorage.getItem('usuarioId') || 1;

let ultimoMensajeId = 0;
window.llaveMaestraDescifrada = null; 

document.addEventListener("DOMContentLoaded", async () => {
    if (!idGrupo) {
        console.error("ID de grupo no encontrado en la URL");
        return;
    }

    await cargarInfoGrupo();
    await obtenerClaveMaestra(); // Carga la llave en memoria al inicio
    await cargarMensajes();
    
    // --- Configuración de Eventos ---
    const btnRenovar = document.getElementById("btn-renovar-llave");
    if (btnRenovar) btnRenovar.onclick = rotarClaveGrupo;

    const btnEnviar = document.getElementById("send-btn");
    if (btnEnviar) btnEnviar.onclick = enviarMensajeTexto;

    const inputMsg = document.getElementById("message-input");
    if (inputMsg) {
        inputMsg.onkeypress = (e) => {
            if (e.key === 'Enter') enviarMensajeTexto();
        };
    }

    // Intervalo de actualización (Polling cada 3 segundos)
    setInterval(cargarMensajes, 3000);
});

// ===============================
// 🔐 LÓGICA DE SEGURIDAD
// ===============================
async function obtenerClaveMaestra() {
    try {
        // Añadimos un timestamp para evitar que el navegador use una respuesta vieja (cache)
        const res = await fetch(`/api/clavesgrupo/obtener/${idGrupo}/${miId}?t=${Date.now()}`);
        if (!res.ok) return null;

        const data = await res.json();
        let registro = null;

        if (Array.isArray(data)) {
            // FORZAMOS conversión a número para que el ID 290 siempre sea mayor a 99
            data.sort((a, b) => Number(b.id) - Number(a.id));
            registro = data[0];
            console.log("💎 Usando registro de seguridad ID:", registro.id); 
        } else {
            registro = data;
        }

        if (!registro || (!registro.clave_cifrada && !registro.clave_maestra_encriptada)) {
            return null;
        }

        const claveBase64 = registro.clave_cifrada || registro.clave_maestra_encriptada;
        const privKey = await window.importarLlavePrivadaPropia();
        
        if (!privKey) return null;

        const binaryString = atob(claveBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, bytes.buffer);

        // Guardamos la nueva llave en la variable global
        window.llaveMaestraDescifrada = btoa(String.fromCharCode(...new Uint8Array(decryptedBuffer)));

        // ACTUALIZACIÓN DEL MODAL
        if (window.generarFingerprintGrupo) {
            const fingerprint = await window.generarFingerprintGrupo(window.llaveMaestraDescifrada);
            const el = document.getElementById("codigo-seguridad");
            if (el) {
                // Insertamos el nuevo código en el HTML
                el.innerHTML = `${fingerprint.linea1}<br>${fingerprint.linea2}`;
                console.log("✅ Código visual actualizado en pantalla");
            }
        }

        return window.llaveMaestraDescifrada;
    } catch (e) {
        console.error("❌ Error al obtener/descifrar llave:", e);
        return null;
    }
}
async function rotarClaveGrupo() {
    console.log("🔄 Rotando seguridad...");
    const el = document.getElementById("codigo-seguridad");
    if (el) el.innerHTML = "Generando nueva seguridad..."; // Feedback visual inmediato

    try {
        const resIntegrantes = await fetch(`/api/chatsgrupos/integrantes/${idGrupo}`);
        const usuarios = await resIntegrantes.json();
        
        const exito = await window.crearClaveGrupo(idGrupo, usuarios);
        
        if (exito) {
            // Damos un tiempo un poco mayor para asegurar que la DB terminó los inserts
            await new Promise(r => setTimeout(r, 2000));
            
            // Llamamos a obtenerClaveMaestra que ahora traerá el ID más nuevo y actualizará el modal
            await obtenerClaveMaestra();
            
            await enviarMensajeSistema("Se ha actualizado el código de seguridad del grupo.");
            alert("✅ ¡Seguridad renovada con éxito!");
        }
    } catch (error) {
        console.error("Error en rotación:", error);
    }
}

// ===============================
// 💬 GESTIÓN DE MENSAJES
// ===============================
async function cargarMensajes() {
    const contenedor = document.getElementById("chat-messages");
    if (!contenedor) return;

    try {
        const res = await fetch(`/api/chatsgrupos/mensajes/${idGrupo}`);
        const mensajes = await res.json();

        if (mensajes.length === ultimoMensajeId) return;
        ultimoMensajeId = mensajes.length;

        const isAtBottom = contenedor.scrollHeight - contenedor.scrollTop <= contenedor.clientHeight + 100;
        let htmlAcumulado = ""; 

        for (const msg of mensajes) {
            // Modificación en cargarMensajes para renderizar multimedia
// Dentro del bucle for (const msg of mensajes), actualiza la lógica:

// ... (dentro de cargarMensajes)
    let contenidoFinal = "";
    const datosCifrados = msg.contenido_texto || "";

    if (msg.tipo_multimedia === 'sistema') {
        contenidoFinal = `<i>${datosCifrados}</i>`;
    } else if (!window.llaveMaestraDescifrada) {
        contenidoFinal = `<span class="crypted-text">🔒 Archivo Cifrado</span>`;
    } else {
        // Desciframos el contenido (que puede ser texto o un Base64 de imagen/video)
        const descifrado = await window.descifrarMensajeAES(datosCifrados, window.llaveMaestraDescifrada);

        if (msg.tipo_multimedia === 'image') {
            contenidoFinal = `<img src="${descifrado}" class="chat-img" style="max-width: 200px; border-radius: 8px;">`;
        } else if (msg.tipo_multimedia === 'video') {
            contenidoFinal = `<video src="${descifrado}" controls class="chat-video" style="max-width: 200px;"></video>`;
        } else if (msg.tipo_multimedia === 'application') {
            contenidoFinal = `<a href="${descifrado}" download="archivo" class="chat-file">📄 Descargar Documento</a>`;
        } else {
            contenidoFinal = descifrado; // Es texto simple
        }
    }
            const esMio = msg.id_emisor == miId;
            const hora = msg.fecha_envio ? new Date(msg.fecha_envio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";

            htmlAcumulado += `
                <div class="message ${esMio ? 'sent' : 'received'}">
                    <div class="message-content">
                        ${!esMio ? `<span class="sender-name">${msg.nombre_usuario || 'Usuario'}</span>` : ''}
                        <div class="text">${contenidoFinal}</div>
                        <span class="time">${hora}</span>
                    </div>
                </div>`;
        }

        contenedor.innerHTML = htmlAcumulado;
        if (isAtBottom) contenedor.scrollTop = contenedor.scrollHeight;

    } catch (e) {
        console.error("Error en cargarMensajes:", e);
    }
}

async function enviarMensajeTexto() {
    const inputMsg = document.getElementById("message-input");
    const texto = inputMsg.value.trim();
    if (!texto) return;

    if (!window.llaveMaestraDescifrada) {
        await obtenerClaveMaestra();
    }

    if (!window.llaveMaestraDescifrada) {
        alert("Seguridad no lista. Presiona 'Renovar Seguridad'.");
        return;
    }

    try {
        const textoCifrado = await window.cifrarMensajeAES(texto, window.llaveMaestraDescifrada);

        await fetch('/api/chatsgrupos/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_grupo: idGrupo,
                id_usuario: miId,
                contenido: textoCifrado,
                tipo: 'texto'
            })
        });

        inputMsg.value = "";
        await cargarMensajes();
    } catch (e) {
        console.error("❌ Error al enviar:", e);
    }
}

async function enviarMensajeSistema(texto) {
    try {
        await fetch('/api/chatsgrupos/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_grupo: idGrupo,
                id_usuario: miId,
                contenido: texto,
                tipo: 'sistema'
            })
        });
    } catch (e) { console.error(e); }
}

async function cargarInfoGrupo() {
    const titulo = document.getElementById("nombre-grupo");
    try {
        const res = await fetch(`/api/chatsgrupos/info/${idGrupo}`);
        const data = await res.json();
        if (titulo) titulo.innerText = data.nombre_grupo || "Chat de Grupo";
    } catch (e) { console.error(e); }
}


// ===============================
// 📁 GESTIÓN DE MULTIMEDIA
// ===============================

// ===============================
// 📁 GESTIÓN DE ARCHIVOS CIFRADOS
// ===============================

async function enviarArchivo(input, tipoOriginal) {
    const archivo = input.files[0];
    if (!archivo) return;

    if (!window.llaveMaestraDescifrada) {
        alert("Seguridad no lista.");
        return;
    }

    const lector = new FileReader();
    
    lector.onload = async (e) => {
        try {
            // 1. Obtenemos el Base64 puro
            const contenidoBase64 = e.target.result; 

            // 2. CIFRADO (Asegúrate que cifrarMensajeAES soporte strings largos)
            const archivoCifrado = await window.cifrarMensajeAES(contenidoBase64, window.llaveMaestraDescifrada);

            // 3. ENVÍO
            const response = await fetch('/api/chatsgrupos/enviar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_grupo: idGrupo,
                    id_usuario: miId,
                    contenido: archivoCifrado, // Esto llegará a contenido_texto
                    tipo: tipoOriginal
                })
            });

            if (response.ok) {
                input.value = "";
                await cargarMensajes();
            } else {
                console.error("Error en el servidor al guardar");
            }
        } catch (error) {
            console.error("❌ Error procesando el archivo pesado:", error);
            alert("El archivo es demasiado grande para el stack de cifrado actual.");
        }
    };

    lector.readAsDataURL(archivo);
}

//INFO GRUPOS


let base64Foto = null;

// 1. Cargar toda la información al abrir la vista o el sidebar
async function cargarInfoDetallada() {
    try {
        // Verificar permisos primero para saber qué mostrar
        const soyAdmin = await verificarPermisosEdicion();

        // Cargar datos del grupo (Nombre, Desc, Reglas, Foto)
        const res = await fetch(`/api/chatsgrupos/info/${idGrupo}`);
        const grupo = await res.json();
        
        if (grupo) {
            const tituloHeader = document.getElementById('nombre-grupo'); // Título en el chat
            const tituloInfo = document.getElementById('info-titulo-grupo'); // Título en sidebar
            const inputNombre = document.getElementById('edit-nombre-grupo');
            const descripcion = document.getElementById('edit-descripcion');
            const reglas = document.getElementById('edit-reglas');
            const imgPreview = document.getElementById('img-grupo-preview');

            if (tituloHeader) tituloHeader.innerText = grupo.nombre_grupo;
            if (tituloInfo) tituloInfo.innerText = grupo.nombre_grupo;
            if (inputNombre) inputNombre.value = grupo.nombre_grupo;
            if (descripcion) descripcion.value = grupo.descripcion_grupo || "";
            if (reglas) reglas.value = grupo.reglas_grupo || "";
            
            if (grupo.foto_grupo_url && imgPreview) {
                imgPreview.src = grupo.foto_grupo_url;
            }
        }

        // Cargar la lista de participantes
        await cargarParticipantesGestion(soyAdmin);

    } catch (error) {
        console.error("Error al cargar info detallada:", error);
    }
}

// 2. Controlar qué puede ver/hacer el usuario según su rol
async function verificarPermisosEdicion() {
    try {
        const res = await fetch(`/api/chatsgrupos/mi-rol/${idGrupo}/${miId}`);
        const data = await res.json();
        
        // MySQL devuelve 1 para true, 0 para false
        const soyAdmin = data.es_admin_grupo === 1;

        const campoNombre = document.getElementById('edit-nombre-grupo');
        const campoDesc = document.getElementById('edit-descripcion');
        const campoReglas = document.getElementById('edit-reglas');
        const btnFoto = document.getElementById('btn-cambiar-foto');
        const panelAdmin = document.getElementById('admin-actions');

        // Configuración inicial (bloqueado por defecto)
        if (campoNombre) campoNombre.disabled = true;
        if (campoDesc) campoDesc.readOnly = true;
        if (campoReglas) campoReglas.readOnly = true;
        
        // Mostrar herramientas de admin solo si corresponde
        if (btnFoto) btnFoto.style.display = soyAdmin ? 'block' : 'none';
        if (panelAdmin) panelAdmin.style.display = soyAdmin ? 'flex' : 'none';

        return soyAdmin;
    } catch (e) {
        console.error("Error verificando rol:", e);
        return false;
    }
}

// 3. Previsualizar foto antes de subirla
function previsualizarFotoGrupo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('img-grupo-preview');
            if (preview) preview.src = e.target.result;
            base64Foto = e.target.result; // Guardar para el envío
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 4. Guardar cambios (Nombre, Desc, Reglas, Foto)
async function guardarCambiosGrupo() {
    try {
        const data = {
            id_usuario: miId, 
            nombre: document.getElementById('edit-nombre-grupo').value,
            descripcion: document.getElementById('edit-descripcion').value,
            reglas: document.getElementById('edit-reglas').value,
            foto: base64Foto 
        };

        const res = await fetch(`/api/chatsgrupos/actualizar-info/${idGrupo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("¡Información del grupo actualizada!");
            // Notificar al chat
            if (typeof enviarMensajeSistema === 'function') {
                enviarMensajeSistema("Se ha actualizado la información del grupo.");
            }
            await cargarInfoDetallada();
        } else {
            alert("Error al guardar los cambios.");
        }
    } catch (e) {
        console.error("Error al guardar:", e);
    }
}

// ==========================================
// GESTIÓN DE PARTICIPANTES
// ==========================================

async function cargarParticipantesGestion(soyAdmin) {
    const lista = document.getElementById('lista-participantes-gestion');
    if (!lista) return;

    try {
        const res = await fetch(`/api/chatsgrupos/integrantes/${idGrupo}`);
        const usuarios = await res.json();

        lista.innerHTML = usuarios.map(u => {
            const esAdmin = u.es_admin_grupo === 1;

            return `
            <div class="participante-item" style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                <div class="user-info">
                    <span class="user-name" style="color: white; font-weight: 600;">${u.nombre_usuario}</span>
                    <br>
                    <small style="color: ${esAdmin ? '#a855f7' : '#94a3b8'}">
                        ${esAdmin ? '🛡️ Administrador' : '👤 Miembro'}
                    </small>
                </div>
                <div class="acciones">
                    ${(soyAdmin && u.id_usuario != miId) ? `
                        <button onclick="expulsarMiembro(${u.id_usuario})" 
                                style="background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; padding: 5px 10px; font-size: 0.8rem;">
                            Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error("Error cargando participantes:", e);
    }
}
async function hacerAdmin(idUsuarioDestino) {
    if (!confirm("¿Seguro que quieres nombrar administrador a este usuario?")) return;

    try {
        const response = await fetch(`/api/chatsgrupos/cambiar-rol/${idGrupo}/${idUsuarioDestino}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nuevo_rol: 1, 
                id_admin_que_pide: idUsuarioActual 
            })
        });

        const data = await response.json();
        if (data.success) {
            alert("¡Ahora es administrador!");
            cargarIntegrantes(); // Refrescar lista
        }
    } catch (error) {
        console.error("Error al ascender:", error);
    }
}
async function expulsarMiembro(idUsuario) {
    if (!confirm("¿Estás seguro de expulsar a este miembro?")) return;

    try {
        const res = await fetch(`/api/chatsgrupos/eliminar-participante/${idGrupo}/${idUsuario}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_admin_que_pide: miId })
        });

        if (res.ok) {
            alert("Miembro expulsado.");
            // Si tienes implementada la rotación de llaves, ejecútala aquí
            if (typeof rotarClaveGrupo === 'function') await rotarClaveGrupo();
            await cargarInfoDetallada(); 
        } else {
            alert("No tienes permisos o ocurrió un error.");
        }
    } catch (e) {
        console.error("Error al expulsar:", e);
    }
}