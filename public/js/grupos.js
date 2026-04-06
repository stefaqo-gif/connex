// ===============================
// 🆔 CONFIGURACIÓN
// ===============================
const miId = sessionStorage.getItem('usuarioId') || 1;
let participantesSeleccionados = [];

document.addEventListener("DOMContentLoaded", () => {
    listarGrupos();

    // Referencias al Modal
    const modal = document.getElementById("modalGrupo");
    const btnAbrir = document.getElementById("btnAbrirModal");
    const btnCancelar = document.getElementById("btnCancelar");
    const btnCrearFinal = document.getElementById("btnCrearGrupoFinal");

    // Abrir modal y cargar contactos
    if (btnAbrir) {
        btnAbrir.onclick = () => {
            resetearFormulario();
            modal.classList.add("active");
            cargarContactosParaGrupo(); // Cargamos tus amigos para invitarlos
        };
    }

    if (btnCancelar) {
        btnCancelar.onclick = () => modal.classList.remove("active");
    }

    if (btnCrearFinal) {
        btnCrearFinal.onclick = crearNuevoGrupoCompleto;
    }
});
function limpiarFormulario() {
    document.getElementById('nombreGrupo').value = '';
    document.getElementById('descGrupo').value = '';
    document.getElementById('previewFoto').style.display = 'none';
    document.getElementById('iconCamara').style.display = 'block';
    document.getElementById('inputFoto').value = '';
}
// CARGAR CONTACTOS 
async function cargarContactosParaGrupo() {
    const listaDiv = document.getElementById("listaContactos");
    if (!listaDiv) return;

    listaDiv.innerHTML = '<p class="loading-msg">Cargando amigos...</p>';

    try {
        // Quitamos el "/api" para coincidir con el código de tu compañera
        const res = await fetch(`/contactos/${miId}`); 
        
        if (!res.ok) throw new Error("No se pudo obtener la lista");

        const contactos = await res.json();
        listaDiv.innerHTML = "";
        participantesSeleccionados = [];

        if (contactos.length === 0) {
            listaDiv.innerHTML = "<p class='empty-msg'>No tienes contactos agregados aún.</p>";
            return;
        }

        contactos.forEach(contacto => {
            const item = document.createElement("div");
            item.className = "member-item";
            
            // Usamos la lógica de nombres de tu compañera
            const nombreMostrar = contacto.nombre_servidor_local || contacto.nombre_usuario || "Usuario";
            
            item.innerHTML = `
                <div class="member-info">
                    <img src="${contacto.foto_url || 'img/default-avatar.png'}" class="mini-avatar" onerror="this.src='img/default-avatar.png'">
                    <span>${nombreMostrar}</span>
                </div>
                <input type="checkbox" value="${contacto.id_usuario}">
            `;

            // Hacer que toda la fila sea clickeable para marcar el checkbox
            item.onclick = (e) => {
                const cb = item.querySelector('input');
                if (e.target !== cb) cb.checked = !cb.checked;
                
                const id = parseInt(cb.value);
                if (cb.checked) {
                    participantesSeleccionados.push(id);
                } else {
                    participantesSeleccionados = participantesSeleccionados.filter(p => p !== id);
                }
            };
            listaDiv.appendChild(item);
        });
    } catch (error) {
        console.error("❌ Error contactos:", error);
        listaDiv.innerHTML = "<p>Error al cargar la lista de selección.</p>";
    }
}

// ===============================
// 📂 LISTAR GRUPOS (TU FUNCIÓN CORREGIDA)
// ===============================
async function listarGrupos() {
    const contenedor = document.getElementById("listaGrupos");
    const contador = document.getElementById("countGrupos");
    
    try {
        const res = await fetch(`/api/grupos/usuario/${miId}`);
        const grupos = await res.json();

        if (contador) contador.innerText = `${grupos.length} Grupos`;
        contenedor.innerHTML = "";

        if (grupos.length === 0) {
            contenedor.innerHTML = "<p class='empty-msg'>No perteneces a ningún grupo aún.</p>";
            return;
        }

        grupos.forEach(grupo => {
            const div = document.createElement("div");
            div.className = "group-item";
            div.onclick = () => window.location.href = `chatsgrupos.html?id=${grupo.id_grupo}`;
            
            // VALIDACIÓN CRÍTICA: Si el nombre es nulo, usa "Sin nombre"
            const nombreLimpio = grupo.nombre_grupo || "Grupo sin nombre";
            const inicial = nombreLimpio.charAt(0).toUpperCase();
            const foto = grupo.foto_grupo_url;

            div.innerHTML = `
                <div class="group-avatar">
                    ${(foto && foto !== 'null') ? `<img src="${foto}" class="group-avatar-img">` : inicial}
                </div>
                <div class="group-info">
                    <h3>${nombreLimpio}</h3>
                    <p>${grupo.descripcion_grupo || 'Sin descripción'}</p>
                </div>
                <span class="material-icons">chevron_right</span>
            `;
            contenedor.appendChild(div);
        });
    } catch (error) {
        contenedor.innerHTML = "<p>Error al cargar grupos.</p>";
    }
}
// ===============================
// ➕ CREAR GRUPO FINAL
// ===============================
async function crearNuevoGrupoCompleto() {
    const nombre = document.getElementById("nombreGrupo").value.trim();
    const descripcion = document.getElementById("descGrupo").value.trim();
    const previewFoto = document.getElementById("previewFoto");
    const fotoUrl = (previewFoto.style.display !== 'none') ? previewFoto.src : null;

    if (!nombre) {
        Swal.fire({
            title: 'Campo requerido',
            text: 'El nombre del grupo es obligatorio.',
            icon: 'warning',
            background: '#161b22',
            color: '#f0f6fc',
            confirmButtonColor: '#8e2de2'
        });
        return;
    }

    try {
        const res = await fetch('/api/grupos/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                descripcion: descripcion,
                id_creador: miId, // Asegúrate de que 'miId' esté definido globalmente
                foto_url: fotoUrl,
                participantes: participantesSeleccionados 
            })
        });

        const data = await res.json();

        if (data.success) {
            // Configuración de Notificación tipo App (Toast)
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                background: '#161b22',
                color: '#f0f6fc',
                iconColor: '#8e2de2'
            });

            Toast.fire({
                icon: 'success',
                title: '¡Grupo creado con éxito!'
            });

            // Cerrar modal y limpiar
            document.getElementById("modalGrupo").classList.remove("active");
            resetearFormulario();
            listarGrupos(); 
            
        } else {
            // Alerta de error en caso de fallo del servidor
            Swal.fire({
                title: 'Error',
                text: data.message || 'No se pudo crear el grupo',
                icon: 'error',
                background: '#161b22',
                color: '#f0f6fc',
                confirmButtonColor: '#d33'
            });
        }
    } catch (error) {
        console.error("Error:", error);
        Swal.fire({
            title: 'Sin conexión',
            text: 'No se pudo contactar con el servidor.',
            icon: 'error',
            background: '#161b22',
            color: '#f0f6fc',
            confirmButtonColor: '#d33'
        });
    }
}

function resetearFormulario() {
    document.getElementById("nombreGrupo").value = "";
    document.getElementById("descGrupo").value = "";
    document.getElementById("previewFoto").style.display = "none";
    document.getElementById("iconCamara").style.display = "block";
    participantesSeleccionados = [];
}
