// ===============================
// 🆔 OBTENER ID USUARIO
// ===============================
const urlParams = new URLSearchParams(window.location.search);
const idUsuarioLogueado = urlParams.get('userId') || sessionStorage.getItem('usuarioId');
if (!idUsuarioLogueado) {
    console.error("❌ No se encontró un ID de usuario válido.");
}

// ===============================
// 🚀 INIT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🔐 Iniciando seguridad...");
    await verificarEstadoSeguridad();

    const btn = document.getElementById("btnCopiar");
    if (btn) {
        btn.addEventListener("click", () => {
            const el = document.getElementById("identidadClave");
            if (el) {
                navigator.clipboard.writeText(el.innerText);
                alert("📋 Código de identidad copiado");
            }
        });
    }
});

// ===============================
// 💾 INDEXEDDB (Almacén de Llave Privada)
// ===============================
async function abrirDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ConneX_Security", 1);
        request.onupgradeneeded = (e) => {
            if (!e.target.result.objectStoreNames.contains("keys")) {
                e.target.result.createObjectStore("keys");
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => reject();
    });
}

async function recuperarLlavePrivada() {
    const db = await abrirDB();
    return new Promise((resolve) => {
        const tx = db.transaction("keys", "readonly");
        const store = tx.objectStore("keys");
        const req = store.get("privateKey");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

// ===============================
// 🔑 GESTIÓN DE IDENTIDAD RSA
// ===============================
async function generarFingerprint(publicKeyBase64) {
    const encoder = new TextEncoder();
    const data = encoder.encode(publicKeyBase64);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const numeros = hashArray
        .map(b => (b % 10000).toString().padStart(4, '0'))
        .slice(0, 12);
    return `${numeros.slice(0, 3).join(' ')}\n${numeros.slice(3, 6).join(' ')}`;
}

async function mostrarIdentidad(publicKey) {
    const el = document.getElementById("identidadClave");
    if (!el) return;
    const fingerprint = await generarFingerprint(publicKey);
    el.innerHTML = fingerprint.replace(/\n/g, "<br>");
}

// finger grupo: se genera a partir de la llave maestra del grupo (que es la misma para todos los miembros) y se muestra en la sección de configuración del grupo. Así, cada grupo tiene un "fingerprint" único que los miembros pueden verificar visualmente para asegurarse de que están usando la misma llave maestra.
// En cifrado.js
window.generarFingerprintGrupo = async function(llaveMaestraBase64) {
    if (!llaveMaestraBase64) return null;
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(llaveMaestraBase64);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));

        // Generamos los 12 bloques de 4 dígitos
        const numeros = hashArray
            .map(b => (b * 31337 % 10000).toString().padStart(4, '0')) // Un pequeño multiplicador ayuda a que varíe más visualmente
            .slice(0, 12);

        return {
            linea1: `${numeros.slice(0, 3).join(' ')}`,
            linea2: `${numeros.slice(3, 6).join(' ')}`,
            completo: numeros.join(' ')
        };
    } catch (e) {
        console.error("❌ Error en Fingerprint:", e);
        return null;
    }
};

async function generarNuevasLlaves() {
    console.log("🔐 Generando nuevas llaves RSA...");
    const keys = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );

    const db = await abrirDB();
    const tx = db.transaction("keys", "readwrite");
    tx.objectStore("keys").put(keys.privateKey, "privateKey");

    const pub = await crypto.subtle.exportKey("spki", keys.publicKey);
    const pubBase64 = btoa(String.fromCharCode(...new Uint8Array(pub)));

    const res = await fetch('/api/cifrado/guardar-llave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_usuario: idUsuarioLogueado,
            llave_publica: pubBase64
        })
    });

    if (res.ok) {
        actualizarQR(pubBase64);
        mostrarIdentidad(pubBase64);
        console.log("✅ Seguridad sincronizada.");
    }
}

async function verificarEstadoSeguridad() {
    try {
        const res = await fetch(`/api/cifrado/obtener-llave/${idUsuarioLogueado}`);
        if (!res.ok) {
            await generarNuevasLlaves();
            return;
        }

        const data = await res.json();
        const llaveLocal = await recuperarLlavePrivada();

        if (data.llave) {
            actualizarQR(data.llave);
            mostrarIdentidad(data.llave);
        }

        if (data.llave && !llaveLocal) {
            console.warn("🚨 No tienes la llave privada en este dispositivo.");
        }
    } catch (error) {
        console.error("❌ Error en verificación:", error);
    }
}

function actualizarQR(pubKey) {
    const qr = document.getElementById("qrCodeImage");
    const loader = document.getElementById("qrLoader");
    if (qr) {
        qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pubKey)}`;
        qr.style.display = "block";
    }
    if (loader) loader.style.display = "none";
}

// ===============================
// 🔐 FUNCIONES RSA (Llaves de Grupo)
// ===============================
window.descifrarMensajeRecibido = async function(base64) {
    try {
        const priv = await recuperarLlavePrivada();
        if (!priv || !base64) return null;
        const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, data);
        return decrypted; // Retorna ArrayBuffer (la llave AES cruda)
    } catch (e) {
        console.error("Error descifrando RSA:", e);
        return null;
    }
};

window.importarLlavePublicaReceptor = async function(id) {
    try {
        const res = await fetch(`/api/cifrado/obtener-llave/${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.llave) return null;

        const binary = Uint8Array.from(atob(data.llave), c => c.charCodeAt(0));
        return await crypto.subtle.importKey(
            "spki",
            binary,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );
    } catch (e) {
        console.error("Error importando pública:", e);
        return null;
    }
};

// ===============================
// 🔐 AES-GCM (Cifrado de mensajes)
// ===============================
// ===============================
// 🔐 AES-GCM (Cifrado de mensajes y archivos)
// ===============================
window.cifrarMensajeAES = async function(texto, llaveBase64) {
    try {
        if (!llaveBase64) throw new Error("Llave Base64 no proporcionada");

        // Usamos TextEncoder solo si es un string de texto normal. 
        // Si ya viene como Base64 (de un archivo), lo convertimos a Uint8Array directamente.
        let data;
        if (texto.startsWith('data:')) {
            // Es un archivo (DataURL)
            const base64Parte = texto.split(',')[1];
            const binaryString = atob(base64Parte);
            data = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                data[i] = binaryString.charCodeAt(i);
            }
        } else {
            // Es texto plano
            data = new TextEncoder().encode(texto);
        }
        
        const binaryKey = atob(llaveBase64);
        const keyBuffer = new Uint8Array(binaryKey.length);
        for (let i = 0; i < binaryKey.length; i++) {
            keyBuffer[i] = binaryKey.charCodeAt(i);
        }

        const key = await crypto.subtle.importKey(
            "raw", 
            keyBuffer, 
            { name: "AES-GCM" }, 
            false, 
            ["encrypt"]
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, 
            key, 
            data
        );

        // --- SOLUCIÓN AL ERROR DE STACK ---
        const arrayCifrado = new Uint8Array(encryptedBuffer);
        
        // Función interna para convertir buffers grandes a Base64 sin romper el stack
        const bufferToB64 = (buf) => {
            let binary = "";
            const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        };

        const ivB64 = btoa(String.fromCharCode(...iv)); // El IV es pequeño, no hay problema
        const cifradoB64 = bufferToB64(arrayCifrado); // Aquí usamos la función segura

        return `${ivB64}:${cifradoB64}`;
    } catch (e) {
        console.error("❌ Error en cifrado AES:", e);
        return null;
    }
};

// ==========================================
// 🔐 DESCIFRADO AES-GCM
// ==========================================
window.descifrarMensajeAES = async function(textoCifrado, llaveBase64) {
    try {
        if (!textoCifrado || typeof textoCifrado !== 'string' || !textoCifrado.includes(':')) {
            return textoCifrado; 
        }

        const [ivB64, dataB64] = textoCifrado.split(':');
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        
        // Conversión segura de datos grandes
        const rawData = atob(dataB64);
        const data = new Uint8Array(rawData.length);
        for(let i = 0; i < rawData.length; i++) {
            data[i] = rawData.charCodeAt(i);
        }
        
        const binaryKey = atob(llaveBase64);
        let keyBuffer = new Uint8Array(binaryKey.length);
        for (let i = 0; i < binaryKey.length; i++) {
            keyBuffer[i] = binaryKey.charCodeAt(i);
        }

        const cryptoKey = await crypto.subtle.importKey(
            "raw", 
            keyBuffer, 
            { name: "AES-GCM" }, 
            false, 
            ["decrypt"]
        );

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            cryptoKey,
            data
        );

        // Si el contenido parece un DataURL (archivo), lo devolvemos como string directamente
        // Si es texto, usamos TextDecoder
        const view = new Uint8Array(decryptedBuffer);
        // Revisamos si empieza con "data:" (primeros 5 bytes)
        const prefix = String.fromCharCode(...view.slice(0, 5));
        
        if (prefix === "data:") {
            let out = "";
            for (let i = 0; i < view.byteLength; i++) {
                out += String.fromCharCode(view[i]);
            }
            return out;
        }

        return new TextDecoder().decode(decryptedBuffer);

    } catch (e) {
        console.error("❌ Fallo en descifrarMensajeAES:", e);
        return "⚠️ Error de descifrado";
    }
};

window.importarLlavePrivadaPropia = async function() {
    const priv = await recuperarLlavePrivada();
    if (!priv) console.warn("⚠️ No hay llave privada en IndexedDB.");
    return priv;
};