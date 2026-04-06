document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el ID del usuario desde la sesión (Lógica de tu compañera)
    const userId = sessionStorage.getItem('usuarioId');
    
    // Si no hay usuario logueado, lo mandamos al registro
    if (!userId) {
        window.location.href = 'registro.html';
        return;
    }

    // --- CARGAR DATOS INICIALES ---
    // Llamamos a la API que ella configuró en el servidor
    fetch(`/usuario/${userId}`)
        .then(response => {
            if (!response.ok) throw new Error("Error al obtener usuario");
            return response.json();
        })
        .then(user => {
            // Llenamos tu interfaz con los datos reales
            document.getElementById('profileName').textContent = user.nombre_usuario || 'Usuario Sin Nombre';
            document.getElementById('profilePhone').textContent = user.telefono || '+506 ....';
            
            if (user.foto_url) {
                document.getElementById('profileAvatar').src = user.foto_url;
            }

            // Sincronizar los selects con lo que hay en la base de datos
            if (user.privacidad_foto) {
                document.getElementById('privacidadFoto').value = user.privacidad_foto;
            }
            if (user.descarga_auto) {
                document.getElementById('descargaAuto').value = user.descarga_auto;
            }
        })
        .catch(err => {
            console.error("Error cargando perfil:", err);
            document.getElementById('profileName').textContent = "Error al cargar";
        });

    // --- GUARDAR CAMBIOS AUTOMÁTICAMENTE ---

    // Actualizar Privacidad de Foto
    const privacidadSelect = document.getElementById('privacidadFoto');
    privacidadSelect.addEventListener('change', function() {
        fetch('/actualizar-privacidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, privacidadFoto: this.value })
        })
        .then(res => {
            if(res.ok) console.log("Privacidad actualizada");
        });
    });

    // Actualizar Preferencia de Descarga
    const descargaSelect = document.getElementById('descargaAuto');
    descargaSelect.addEventListener('change', function() {
        fetch('/actualizar-descarga', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, descargaAuto: this.value })
        })
        .then(res => {
            if(res.ok) console.log("Preferencia de descarga guardada");
        });
    });

    // --- NAVEGACIÓN Y BOTONES ---

    // Botón Editar Perfil (Redirige a la página que ella creó)
    document.getElementById('editProfile').addEventListener('click', () => {
        window.location.href = `completar-perfil.html?userId=${userId}`;
    });

    // Botón Eliminar Cuenta
    document.getElementById('deleteAccount').addEventListener('click', () => {
        if (confirm("¿Estás seguro de que deseas eliminar tu cuenta? Esta acción es permanente.")) {
            // Aquí llamarías a la ruta de eliminación si ella la creó
            console.warn("Solicitud de eliminación para el usuario:", userId);
        }
    });

    // Lógica para subir foto (opcional, si quieres implementarlo después)
    document.getElementById('uploadPhoto').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log("Archivo seleccionado para subir:", file.name);
            // Aquí iría el fetch para subir la imagen al servidor
        }
    });
});