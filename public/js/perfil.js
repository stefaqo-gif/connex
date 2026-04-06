async function renovarLlavesSeguridad() {
    console.log("🔐 Generando nuevas llaves RSA...");
    
    // 1. Generar el par de llaves (Pública y Privada)
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    // 2. Exportar la llave PRIVADA a formato PEM
    const exportedPrivateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const pemPrivada = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(exportedPrivateKey)))}\n-----END PRIVATE KEY-----`;

    // 3. ¡EL PASO QUE TE ESTÁ FALLANDO!: Guardar en localStorage
    // Asegúrate de que 'miId' sea 14
    localStorage.setItem(`privateKey_${miId}`, pemPrivada); 
    console.log("💾 Llave privada guardada en localStorage.");

    // 4. Exportar la llave PÚBLICA y guardarla en la Base de Datos
    const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const pemPublica = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)))}\n-----END PUBLIC KEY-----`;

    const response = await fetch('/api/cifrado/guardar-llave-publica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_usuario: miId,
            llave_publica: pemPublica,
            algoritmo: 'RSA-2048'
        })
    });

    if (response.ok) {
        alert("✅ Seguridad sincronizada. Ahora puedes volver al chat.");
        console.log("🚀 Seguridad sincronizada con el servidor.");
    }
}