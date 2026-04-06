const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
require('dotenv').config();
const app = express();

app.use(cors()); 

// Aumenta el límite para permitir el envío de fotos/videos en Base64 cifrado

app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const db = mysql.createConnection({
    host: '138.59.135.33',
    user: 'ProyectoConnex',
    password: 'ProyectoConnex@',
    database: 'connexv1',
    multipleStatements: true
});

db.connect((err) => {
    if(err) console.log("❌ Error de conexión DB:", err);
    else console.log("✅ Conectado a MySQL (Base: connex)");
});

// Cifrado 
try {
    app.use('/api/cifrado', require('./routes/cifrado')(db));
    console.log("✅ Ruta /api/cifrado cargada");
} catch(e) { console.log("⚠️ Error en cifrado", e.message); }

// Gestión de Grupos 
try {
    app.use('/api/grupos', require('./routes/grupos')(db));
    console.log("✅ Ruta /api/grupos cargada");
} catch(e) { console.log("⚠️ Error en grupos", e.message); }


// --- 3. Claves y Mensajería de Grupos ---
try {
    const chatsRouter = require('./routes/chatsgrupos')(db);
    app.use('/api/chatsgrupos', chatsRouter);
    app.use('/api/clavesgrupo', chatsRouter); 

    console.log("✅ Rutas de mensajería y claves sincronizadas correctamente");
} catch(e) { 
    console.log("⚠️ Error cargando rutas de grupos:", e.message); 
}
// Contactos
try {
    app.use('/api/contactos', require('./routes/contactos')(db));
    console.log("✅ Ruta /api/contactos cargada");
} catch(e) { console.log("⚠️ Error en contactos", e.message); }

// --- CONFIGURACIÓN DE CORREO (Nodemailer) ---
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Almacenamiento temporal para códigos de verificación
const registrosTemporales = new Map();

// --- FUNCIÓN AUXILIAR ENVIAR CORREO ---
async function enviarCodigoPorCorreo(email, codigo, nombreUsuario = '') {
    try {
        console.log(`📧 Enviando código por correo a ${email}...`);
        
        const mailOptions = {
            from: `"Connex" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 Código de verificación - Connex',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                        .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #7b2ff7, #a64dff); padding: 30px; text-align: center; }
                        .logo { font-size: 48px; margin-bottom: 10px; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 30px; text-align: center; }
                        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
                        .code { font-size: 42px; font-weight: bold; color: #7b2ff7; background: #f0f0f0; padding: 20px; border-radius: 12px; letter-spacing: 8px; margin: 25px 0; font-family: monospace; }
                        .message { color: #666; line-height: 1.6; margin: 20px 0; }
                        .footer { background: #f8f8f8; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">💬</div>
                            <h1>Connex</h1>
                        </div>
                        <div class="content">
                            ${nombreUsuario ? `<div class="greeting">¡Hola ${nombreUsuario}!</div>` : '<div class="greeting">¡Hola!</div>'}
                            <div class="message">
                                Gracias por registrarte en <strong>Connex</strong>. Para completar tu registro, 
                                utiliza el siguiente código de verificación:
                            </div>
                            <div class="code">${codigo}</div>
                            <div class="message">
                                Este código expirará en <strong>5 minutos</strong>.<br>
                                Si no solicitaste este código, puedes ignorar este mensaje.
                            </div>
                        </div>
                        <div class="footer">
                            <p>Connex - Conectando mundos, un mensaje a la vez.</p>
                            <p>Este es un correo automático, por favor no responder.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Tu código de verificación de Connex es: ${codigo}\n\nEste código expirará en 5 minutos.\n\nConnex - Conectando mundos, un mensaje a la vez.`
        };
        
        const info = await emailTransporter.sendMail(mailOptions);
        console.log("✅ Correo enviado:", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("❌ Error enviando correo:", error);
        return { success: false, error: error.message };
    }
}

// --- API: RUTAS DE USUARIO Y REGISTRO ---

// 1. Obtener lista de países
app.get('/paises', (req, res) => {
    db.query("SELECT id_pais, nombre, codigo_area FROM paises ORDER BY nombre", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. Enviar código de verificación (desde registro.html)
app.post('/enviar-codigo', async (req, res) => {
    const { telefono, idPais, correo } = req.body;

    if (!telefono || !idPais || !correo) {
        return res.status(400).json({ error: 'Teléfono, país y correo requeridos' });
    }

    // Verificar si el número o correo ya están registrados
    const checkSql = "SELECT id_usuario FROM usuarios WHERE telefono = ? OR correo = ?";
    db.query(checkSql, [telefono, correo], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'Este número o correo ya está registrado' });
        }

        // Generar código aleatorio de 5 dígitos
        const codigo = Math.floor(10000 + Math.random() * 90000).toString();

        // Guardar datos temporales
        registrosTemporales.set(telefono, {
            idPais: idPais,
            correo: correo,
            codigo: codigo,
            timestamp: Date.now(),
            intentos: 0
        });

        // Enviar código por correo
        console.log('✅ API: Enviando código por correo electrónico');
        const resultadoAPI = await enviarCodigoPorCorreo(correo, codigo);

        if (resultadoAPI.success) {
            res.json({ 
                mensaje: 'Código enviado correctamente a tu correo',
                codigo: process.env.NODE_ENV === 'development' ? codigo : undefined
            });
        } else {
            console.error('❌ Falló el envío del correo');
            res.status(500).json({ 
                error: 'Error al enviar el correo. Intenta de nuevo.',
                apiError: resultadoAPI.error
            });
        }
    });
});

// 3. Registrar usuario completo (desde completar-perfil.html)
app.post('/registrar-usuario', async (req, res) => {
    const { 
        telefono, idPais, nombreUsuario, correo, fotoUrl,
        infoEstado, privacidadFoto, notificarSeguridad, descargaAuto 
    } = req.body;

    console.log('📝 Registrando usuario:', { telefono, idPais, nombreUsuario, correo, tieneFoto: !!fotoUrl });

    if (!telefono || !idPais || !nombreUsuario || !correo) {
        return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
    }

    // Procesar foto si existe
    let fotoParaGuardar = null;
    if (fotoUrl && fotoUrl !== 'null' && fotoUrl !== 'undefined' && fotoUrl !== '') {
        // Verificar tamaño
        if (fotoUrl.length > 500000) {
            return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 500KB.' });
        }
        fotoParaGuardar = fotoUrl;
    }

    // Verificar si el número o correo ya están registrados
    const checkSql = "SELECT id_usuario FROM usuarios WHERE telefono = ? OR correo = ?";
    db.query(checkSql, [telefono, correo], async (err, results) => {
        if (err) {
            console.error('Error al verificar:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'Este número o correo ya está registrado' });
        }

        // Generar código aleatorio de 5 dígitos
        const codigo = Math.floor(10000 + Math.random() * 90000).toString();

        // Guardar todos los datos temporalmente
        registrosTemporales.set(telefono, {
            idPais: idPais,
            nombreUsuario: nombreUsuario,
            correo: correo,
            fotoUrl: fotoParaGuardar,
            infoEstado: infoEstado || '¡Hola! Estoy usando ConneX.',
            privacidadFoto: privacidadFoto || 'Todos',
            notificarSeguridad: notificarSeguridad !== undefined ? notificarSeguridad : 1,
            descargaAuto: descargaAuto || 'Wifi',
            codigo: codigo,
            timestamp: Date.now(),
            intentos: 0
        });

        // Enviar código por correo
        const resultadoAPI = await enviarCodigoPorCorreo(correo, codigo, nombreUsuario);

        if (resultadoAPI.success) {
            res.json({ 
                mensaje: 'Código enviado correctamente a tu correo',
                usuarioId: null,
                codigo: process.env.NODE_ENV === 'development' ? codigo : undefined
            });
        } else {
            console.error('❌ Falló el envío del correo');
            res.status(500).json({ 
                error: 'Error al enviar el correo. Intenta de nuevo.',
                apiError: resultadoAPI.error
            });
        }
    });
});

// 4. Verificar Código e Insertar en DB
app.post('/verificar-codigo', (req, res) => {
    const { telefono, codigo } = req.body;

    if (!telefono || !codigo) {
        return res.status(400).json({ error: 'Teléfono y código requeridos' });
    }

    const data = registrosTemporales.get(telefono);

    if (!data) {
        return res.status(400).json({ error: 'Código no encontrado. Solicita uno nuevo.' });
    }

    console.log('🔍 Verificando código para:', telefono);
    console.log('Datos temporales:', {
        idPais: data.idPais,
        nombreUsuario: data.nombreUsuario,
        correo: data.correo
    });

    // Verificar si el código ha expirado (5 minutos)
    if (Date.now() - data.timestamp > 5 * 60 * 1000) {
        registrosTemporales.delete(telefono);
        return res.status(400).json({ error: 'Código expirado. Solicita uno nuevo.' });
    }

    // Verificar intentos (máximo 3)
    if (data.intentos >= 3) {
        registrosTemporales.delete(telefono);
        return res.status(400).json({ error: 'Demasiados intentos. Solicita un nuevo código.' });
    }

    // Incrementar intentos
    data.intentos++;
    registrosTemporales.set(telefono, data);

    if (data.codigo !== codigo) {
        return res.status(400).json({ error: 'Código incorrecto' });
    }

    // Verificar si el usuario ya existe
    const checkExistingSql = "SELECT id_usuario FROM usuarios WHERE telefono = ?";
    db.query(checkExistingSql, [telefono], (checkErr, checkResults) => {
        if (checkErr) {
            console.error('Error al verificar existencia:', checkErr);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        // Si el usuario ya existe, devolver su ID
        if (checkResults.length > 0) {
            registrosTemporales.delete(telefono);
            return res.json({ 
                mensaje: 'Usuario ya existe',
                usuarioId: checkResults[0].id_usuario,
                yaExistia: true
            });
        }

        // Crear usuario con todos los datos
        const insertSql = `INSERT INTO usuarios 
            (id_pais, telefono, nombre_usuario, correo, foto_url, info_estado, 
             privacidad_foto, notificar_seguridad, descarga_auto, rol, esta_verificado) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'User', 1)`;

        db.query(insertSql, [
            data.idPais,
            telefono,
            data.nombreUsuario || 'Usuario Connex',
            data.correo,
            data.fotoUrl || null,
            data.infoEstado || '¡Hola! Estoy usando ConneX.',
            data.privacidadFoto || 'Todos',
            data.notificarSeguridad !== undefined ? data.notificarSeguridad : 1,
            data.descargaAuto || 'Wifi'
        ], (err, result) => {
            if (err) {
                console.error('Error al crear usuario:', err);
                return res.status(500).json({ error: 'Error al crear la cuenta', detalle: err.message });
            }

            console.log('✅ Usuario creado con ID:', result.insertId);

            // Limpiar datos temporales
            registrosTemporales.delete(telefono);

            res.json({ 
                mensaje: 'Cuenta verificada y creada exitosamente',
                usuarioId: result.insertId,
                nombreUsuario: data.nombreUsuario
            });
        });
    });
});

// 5. Reenviar código
app.post('/reenviar-codigo', async (req, res) => {
    console.log('🔵 POST /reenviar-codigo recibido');
    console.log('Body:', req.body);
    
    const { telefono } = req.body;

    if (!telefono) {
        console.log('❌ Teléfono no proporcionado');
        return res.status(400).json({ error: 'Teléfono requerido' });
    }

    console.log('Buscando datos para teléfono:', telefono);
    console.log('Registros temporales:', Array.from(registrosTemporales.keys()));
    
    const data = registrosTemporales.get(telefono);

    if (!data) {
        console.log('❌ No se encontraron datos para el teléfono:', telefono);
        return res.status(400).json({ error: 'Sesión expirada. Inicia el registro nuevamente.' });
    }

    console.log('✅ Datos encontrados:', { correo: data.correo, nombreUsuario: data.nombreUsuario });

    // Generar nuevo código
    const codigo = Math.floor(10000 + Math.random() * 90000).toString();
    console.log('📝 Nuevo código generado:', codigo);

    // Actualizar datos
    data.codigo = codigo;
    data.timestamp = Date.now();
    data.intentos = 0;
    registrosTemporales.set(telefono, data);

    // Enviar código por correo
    console.log('🔄 Reenviando código por correo a:', data.correo);
    const resultadoAPI = await enviarCodigoPorCorreo(data.correo, codigo, data.nombreUsuario);

    if (resultadoAPI.success) {
        console.log('✅ Código reenviado exitosamente');
        res.json({ 
            mensaje: 'Código reenviado correctamente a tu correo',
            codigo: process.env.NODE_ENV === 'development' ? codigo : undefined
        });
    } else {
        console.error('❌ Falló el reenvío:', resultadoAPI.error);
        res.status(500).json({ 
            error: 'Error al reenviar el código',
            apiError: resultadoAPI.error
        });
    }
});

// 6. Actualizar perfil de usuario
app.post('/actualizar-perfil', (req, res) => {
    const { 
        userId, nombreUsuario, correo, fotoUrl, infoEstado,
        privacidadFoto, notificarSeguridad, descargaAuto 
    } = req.body;

    console.log('🔵 Recibida solicitud en /actualizar-perfil');
    console.log('UserId:', userId);
    console.log('Tiene foto:', !!fotoUrl);
    if (fotoUrl) {
        console.log('Tamaño foto:', fotoUrl.length, 'caracteres');
    }

    if (!userId || !nombreUsuario || !correo) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Procesar la foto - limitar tamaño
    let fotoParaGuardar = null;
    if (fotoUrl && fotoUrl !== 'null' && fotoUrl !== 'undefined' && fotoUrl !== '') {
        // Limitar a 500KB máximo
        if (fotoUrl.length > 500000) {
            return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 500KB.' });
        }
        fotoParaGuardar = fotoUrl;
    }

    const sql = `UPDATE usuarios SET 
        nombre_usuario = ?,
        correo = ?,
        foto_url = ?,
        info_estado = ?,
        privacidad_foto = ?,
        notificar_seguridad = ?,
        descarga_auto = ?
        WHERE id_usuario = ?`;

    const values = [
        nombreUsuario.trim(),
        correo.trim(),
        fotoParaGuardar,
        infoEstado || '¡Hola! Estoy usando ConneX.',
        privacidadFoto || 'Todos',
        notificarSeguridad !== undefined ? (notificarSeguridad ? 1 : 0) : 1,
        descargaAuto || 'Wifi',
        userId
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('❌ Error al actualizar perfil:', err);
            if (err.code === 'ER_DATA_TOO_LONG') {
                return res.status(400).json({ error: 'La imagen es demasiado grande' });
            }
            return res.status(500).json({ error: 'Error al actualizar el perfil' });
        }

        console.log('✅ Perfil actualizado correctamente');
        res.json({ 
            mensaje: 'Perfil actualizado correctamente',
            usuarioId: userId,
            fotoActualizada: !!fotoParaGuardar
        });
    });
});

// 7. Obtener datos de un usuario
app.get('/usuario/:id', (req, res) => {
    const sql = "SELECT id_usuario, nombre_usuario, telefono, correo, foto_url, info_estado, privacidad_foto, descarga_auto, id_pais FROM usuarios WHERE id_usuario = ?";
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(results[0]);
    });
});

// 8. Obtener chats del usuario
app.get('/chats/:userId', (req, res) => {
    const { userId } = req.params;
    
    const sql = `
        SELECT 
            u.id_usuario,
            u.nombre_usuario,
            u.foto_url,
            u.info_estado,
            m.contenido_texto as ultimo_mensaje,
            m.fecha_envio,
            COUNT(CASE WHEN m.leido = 0 AND m.id_emisor != ? THEN 1 END) as no_leidos
        FROM contactos c
        JOIN usuarios u ON u.id_usuario = c.id_usuario_agregado
        LEFT JOIN mensajes m ON (m.id_emisor = u.id_usuario AND m.id_receptor_usuario = ?)
            OR (m.id_emisor = ? AND m.id_receptor_usuario = u.id_usuario)
        WHERE c.id_usuario_dueno = ?
        GROUP BY u.id_usuario
        ORDER BY m.fecha_envio DESC
        LIMIT 20
    `;
    
    db.query(sql, [userId, userId, userId, userId], (err, results) => {
        if (err) {
            console.error('Error al obtener chats:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        res.json(results);
    });
});

// 9. Actualizar privacidad
app.post('/actualizar-privacidad', (req, res) => {
    const { userId, privacidadFoto } = req.body;
    const sql = "UPDATE usuarios SET privacidad_foto = ? WHERE id_usuario = ?";
    db.query(sql, [privacidadFoto, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar' });
        res.json({ mensaje: 'Actualizado correctamente' });
    });
});

// 10. Actualizar descarga automática
app.post('/actualizar-descarga', (req, res) => {
    const { userId, descargaAuto } = req.body;
    const sql = "UPDATE usuarios SET descarga_auto = ? WHERE id_usuario = ?";
    db.query(sql, [descargaAuto, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar' });
        res.json({ mensaje: 'Actualizado correctamente' });
    });
});

// 11. Sincronizar contactos con agenda del teléfono
app.post('/sincronizar-contactos', (req, res) => {
    const { userId, contactos } = req.body; // contactos: array de { telefono, nombre }
    
    if (!userId || !contactos) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    // Extraer solo los números de teléfono
    const telefonosContactos = contactos.map(c => c.telefono);
    
    // Buscar qué contactos están registrados en la plataforma
    const sql = `SELECT id_usuario, nombre_usuario, telefono, foto_url 
                 FROM usuarios 
                 WHERE telefono IN (?) AND id_usuario != ?`;
    
    db.query(sql, [telefonosContactos, userId], (err, results) => {
        if (err) {
            console.error('Error al buscar contactos:', err);
            return res.status(500).json({ error: 'Error al sincronizar contactos' });
        }
        
        // Guardar contactos en la tabla contactos
        const contactosExistentes = results;
        
        // Insertar o actualizar contactos
        contactosExistentes.forEach(contacto => {
            const insertSql = `INSERT INTO contactos (id_usuario_dueno, id_usuario_agregado, nombre_servidor_local)
                               VALUES (?, ?, ?)
                               ON DUPLICATE KEY UPDATE nombre_servidor_local = VALUES(nombre_servidor_local)`;
            
            const nombreLocal = contactos.find(c => c.telefono === contacto.telefono)?.nombre || contacto.nombre_usuario;
            
            db.query(insertSql, [userId, contacto.id_usuario, nombreLocal]);
        });
        
        res.json({ 
            mensaje: 'Contactos sincronizados',
            contactosRegistrados: contactosExistentes 
        });
    });
});

// 12. Obtener lista de contactos del usuario
app.get('/contactos/:userId', (req, res) => {
    const { userId } = req.params;
    
    const sql = `SELECT 
                    u.id_usuario,
                    u.nombre_usuario,
                    u.telefono,
                    u.foto_url,
                    u.info_estado,
                    c.nombre_servidor_local
                 FROM contactos c
                 JOIN usuarios u ON u.id_usuario = c.id_usuario_agregado
                 WHERE c.id_usuario_dueno = ?
                 ORDER BY u.nombre_usuario ASC`;
    
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error al obtener contactos:', err);
            return res.status(500).json({ error: 'Error al obtener contactos' });
        }
        res.json(results);
    });
});

// 13. Buscar contactos por nombre o teléfono
app.get('/buscar-contactos/:userId/:termino', (req, res) => {
    const { userId, termino } = req.params;
    
    const sql = `SELECT 
                    u.id_usuario,
                    u.nombre_usuario,
                    u.telefono,
                    u.foto_url
                 FROM usuarios u
                 WHERE u.id_usuario != ?
                   AND (u.nombre_usuario LIKE ? OR u.telefono LIKE ?)
                 ORDER BY u.nombre_usuario ASC
                 LIMIT 20`;
    
    const busqueda = `%${termino}%`;
    db.query(sql, [userId, busqueda, busqueda], (err, results) => {
        if (err) {
            console.error('Error al buscar contactos:', err);
            return res.status(500).json({ error: 'Error al buscar contactos' });
        }
        res.json(results);
    });
});

// 14. Eliminar historial de mensajes de un chat
app.post('/eliminar-historial', (req, res) => {
    const { userId, chatId, esGrupo } = req.body;
    
    if (!userId || !chatId) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    let sql;
    let params;
    
    if (esGrupo) {
        sql = `DELETE FROM mensajes 
               WHERE id_receptor_grupo = ? 
               AND (SELECT 1 FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?)`;
        params = [chatId, chatId, userId];
    } else {
        sql = `DELETE FROM mensajes 
               WHERE (id_emisor = ? AND id_receptor_usuario = ?)
                  OR (id_emisor = ? AND id_receptor_usuario = ?)`;
        params = [userId, chatId, chatId, userId];
    }
    
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error al eliminar historial:', err);
            return res.status(500).json({ error: 'Error al eliminar historial' });
        }
        res.json({ mensaje: 'Historial eliminado correctamente', afectados: result.affectedRows });
    });
});

// 15. Archivar/Desarchivar chat
app.post('/archivar-chat', (req, res) => {
    const { userId, chatId, esGrupo, archivado } = req.body;

    console.log('📦 Archivar/Desarchivar:', { userId, chatId, archivado });

    if (!userId || !chatId) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const sql = `
        INSERT INTO chat_configuracion 
        (id_usuario, id_chat_destino, es_grupal, esta_archivado, esta_fijado)
        VALUES (?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE 
            esta_archivado = VALUES(esta_archivado)
    `;

    db.query(sql, [userId, chatId, esGrupo ? 1 : 0, archivado ? 1 : 0], (err) => {
        if (err) {
            console.error('❌ Error:', err);
            return res.status(500).json({ error: 'Error al actualizar archivo' });
        }

        console.log(`✅ Chat ${archivado ? 'archivado' : 'desarchivado'}`);
        res.json({ mensaje: archivado ? 'Archivado' : 'Desarchivado' });
    });
});

// 16. Fijar/Desfijar chat (corregido)
app.post('/fijar-chat', (req, res) => {
    const { userId, chatId, esGrupo, fijado } = req.body;

    console.log('📌 Fijar/Desfijar:', { userId, chatId, fijado });

    if (!userId || !chatId) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const sql = `
        INSERT INTO chat_configuracion 
        (id_usuario, id_chat_destino, es_grupal, esta_fijado, esta_archivado)
        VALUES (?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE 
            esta_fijado = VALUES(esta_fijado)
    `;

    db.query(sql, [userId, chatId, esGrupo ? 1 : 0, fijado ? 1 : 0], (err) => {
        if (err) {
            console.error('❌ Error:', err);
            return res.status(500).json({ error: 'Error al fijar chat' });
        }

        console.log(`✅ Chat ${fijado ? 'fijado' : 'desfijado'}`);
        res.json({ mensaje: fijado ? 'Fijado' : 'Desfijado' });
    });
});

// 16. Fijar/Desfijar chat
app.post('/fijar-chat', (req, res) => {
    const { userId, chatId, esGrupo, fijado } = req.body;

    console.log('📌 Fijar/Desfijar:', { userId, chatId, fijado });

    if (!userId || !chatId) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const sql = `
        INSERT INTO chat_configuracion 
        (id_usuario, id_chat_destino, es_grupal, esta_fijado, esta_archivado)
        VALUES (?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE 
            esta_fijado = VALUES(esta_fijado)
    `;

    db.query(sql, [userId, chatId, esGrupo ? 1 : 0, fijado ? 1 : 0], (err) => {
        if (err) {
            console.error('❌ Error:', err);
            return res.status(500).json({ error: 'Error al fijar chat' });
        }

        console.log(`✅ Chat ${fijado ? 'fijado' : 'desfijado'}`);
        res.json({ mensaje: fijado ? 'Fijado' : 'Desfijado' });
    });
});

// 17. Eliminar chat completo
app.post('/eliminar-chat', (req, res) => {
    const { userId, chatId, esGrupo } = req.body;
    
    if (!userId || !chatId) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    // Primero eliminar configuración del chat
    const deleteConfigSql = `DELETE FROM chat_configuracion 
                              WHERE id_usuario = ? AND id_chat_destino = ? AND es_grupal = ?`;
    
    db.query(deleteConfigSql, [userId, chatId, esGrupo ? 1 : 0], (err) => {
        if (err) {
            console.error('Error al eliminar configuración:', err);
            return res.status(500).json({ error: 'Error al eliminar chat' });
        }
        
        // Si es chat individual, también podemos eliminar el historial
        if (!esGrupo) {
            const deleteMessagesSql = `DELETE FROM mensajes 
                                       WHERE (id_emisor = ? AND id_receptor_usuario = ?)
                                          OR (id_emisor = ? AND id_receptor_usuario = ?)`;
            
            db.query(deleteMessagesSql, [userId, chatId, chatId, userId], (errMsg) => {
                if (errMsg) console.error('Error al eliminar mensajes:', errMsg);
                res.json({ mensaje: 'Chat eliminado correctamente' });
            });
        } else {
            res.json({ mensaje: 'Chat eliminado correctamente' });
        }
    });
});

// 18. Obtener chats del usuario con configuración
app.get('/chats-config/:userId', (req, res) => {
    const { userId } = req.params;
    
    console.log('📡 Obteniendo chats para usuario:', userId);
    
    // Obtener contactos SIN duplicados usando DISTINCT
    const contactosSql = `
        SELECT DISTINCT
            u.id_usuario as chat_id,
            u.nombre_usuario as nombre,
            u.foto_url,
            u.info_estado,
            'individual' as tipo,
            COALESCE(c.esta_fijado, 0) as fijado,
            COALESCE(c.esta_archivado, 0) as archivado
        FROM contactos cont
        INNER JOIN usuarios u ON u.id_usuario = cont.id_usuario_agregado
        LEFT JOIN chat_configuracion c ON c.id_usuario = ? AND c.id_chat_destino = u.id_usuario AND c.es_grupal = 0
        WHERE cont.id_usuario_dueno = ?
        GROUP BY u.id_usuario, u.nombre_usuario, u.foto_url, u.info_estado, c.esta_fijado, c.esta_archivado
        ORDER BY u.nombre_usuario ASC
    `;
    
    db.query(contactosSql, [userId, userId], (err, contactos) => {
        if (err) {
            console.error('❌ Error al obtener contactos:', err);
            return res.status(500).json({ error: 'Error al obtener contactos' });
        }
        
        console.log(`✅ Encontrados ${contactos.length} contactos únicos`);
        
        if (contactos.length === 0) {
            return res.json([]);
        }
        
        // Obtener IDs de contactos
        const contactosIds = contactos.map(c => c.chat_id);
        
        // Obtener último mensaje para cada contacto
        const promises = contactosIds.map(contactId => {
            return new Promise((resolve) => {
                const sql = `
                    SELECT contenido_texto, fecha_envio
                    FROM mensajes
                    WHERE (id_emisor = ? AND id_receptor_usuario = ?)
                       OR (id_emisor = ? AND id_receptor_usuario = ?)
                    ORDER BY fecha_envio DESC
                    LIMIT 1
                `;
                db.query(sql, [userId, contactId, contactId, userId], (err, results) => {
                    if (err || results.length === 0) {
                        resolve({ contactId, mensaje: null, fecha: null });
                    } else {
                        resolve({ contactId, mensaje: results[0].contenido_texto, fecha: results[0].fecha_envio });
                    }
                });
            });
        });
        
        Promise.all(promises).then(ultimosMensajes => {
            const ultimoMensajeMap = {};
            ultimosMensajes.forEach(u => {
                ultimoMensajeMap[u.contactId] = { mensaje: u.mensaje, fecha: u.fecha };
            });
            
            // Obtener mensajes no leídos
            const noLeidosSql = `
                SELECT id_emisor, COUNT(*) as no_leidos
                FROM mensajes
                WHERE id_receptor_usuario = ? AND leido = 0 AND id_emisor IN (?)
                GROUP BY id_emisor
            `;
            
            db.query(noLeidosSql, [userId, contactosIds], (err, noLeidosResults) => {
                const noLeidosMap = {};
                if (!err && noLeidosResults) {
                    noLeidosResults.forEach(r => {
                        noLeidosMap[r.id_emisor] = r.no_leidos;
                    });
                }
                
                // Construir resultado final SIN duplicados
                const resultado = [];
                const seenIds = new Set(); // Para evitar duplicados
                
                for (const contacto of contactos) {
                    if (!seenIds.has(contacto.chat_id)) {
                        seenIds.add(contacto.chat_id);
                        const ultimo = ultimoMensajeMap[contacto.chat_id];
                        resultado.push({
                            ...contacto,
                            ultimo_mensaje: ultimo?.mensaje || null,
                            fecha_envio: ultimo?.fecha || null,
                            no_leidos: noLeidosMap[contacto.chat_id] || 0
                        });
                    }
                }
                
                // Ordenar resultados: fijados primero, luego por fecha, luego por nombre
                resultado.sort((a, b) => {
                    if (a.fijado && !b.fijado) return -1;
                    if (!a.fijado && b.fijado) return 1;
                    if (a.fecha_envio && !b.fecha_envio) return -1;
                    if (!a.fecha_envio && b.fecha_envio) return 1;
                    if (a.fecha_envio && b.fecha_envio) {
                        return new Date(b.fecha_envio) - new Date(a.fecha_envio);
                    }
                    return a.nombre.localeCompare(b.nombre);
                });
                
                console.log(`✅ Enviando ${resultado.length} chats únicos`);
                res.json(resultado);
            });
        });
    });
});

// 19. Obtener mensajes de una conversación
app.get('/mensajes/:userId/:contactId', (req, res) => {
    const { userId, contactId } = req.params;
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 30;
    const offset = page * limit;
    
    const sql = `
        SELECT * FROM mensajes 
        WHERE (id_emisor = ? AND id_receptor_usuario = ?)
           OR (id_emisor = ? AND id_receptor_usuario = ?)
        ORDER BY fecha_envio DESC
        LIMIT ? OFFSET ?
    `;
    
    db.query(sql, [userId, contactId, contactId, userId, limit, offset], (err, results) => {
        if (err) {
            console.error('Error al obtener mensajes:', err);
            return res.status(500).json({ error: 'Error al obtener mensajes' });
        }
        
        // Marcar mensajes como leídos
        const updateSql = `
            UPDATE mensajes 
            SET leido = 1 
            WHERE id_emisor = ? AND id_receptor_usuario = ? AND leido = 0
        `;
        db.query(updateSql, [contactId, userId]);
        
        const hasMore = results.length === limit;
        res.json({
            mensajes: results.reverse(),
            hasMore: hasMore,
            page: page,
            limit: limit
        });
    });
});

// 20. Endpoint para login de usuarios existentes
app.post('/login', (req, res) => {
    const { identificador } = req.body;
    
    console.log('🔵 POST /login recibido');
    console.log('Identificador:', identificador);
    
    if (!identificador) {
        return res.status(400).json({ error: 'Correo o teléfono requerido' });
    }
    
    // Buscar por correo o por teléfono Y que sea rol User
    const sql = "SELECT id_usuario, nombre_usuario, correo, telefono, foto_url, rol FROM usuarios WHERE (correo = ? OR telefono = ?) AND rol = 'User'";
    
    db.query(sql, [identificador, identificador], (err, results) => {
        if (err) {
            console.error('Error en login:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        
        console.log('Resultados encontrados:', results.length);
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado o no tiene permisos de usuario regular' });
        }
        
        const usuario = results[0];
        console.log('✅ Usuario encontrado:', usuario.id_usuario, 'Rol:', usuario.rol);
        
        res.json({
            mensaje: 'Login exitoso',
            usuarioId: usuario.id_usuario,
            nombre_usuario: usuario.nombre_usuario,
            correo: usuario.correo,
            foto_url: usuario.foto_url,
            rol: usuario.rol
        });
    });
});
// 21. Eliminar cuenta de usuario
app.post('/eliminar-cuenta', (req, res) => {
    const { userId } = req.body;
    
    console.log('🗑️ Eliminando cuenta:', userId);
    
    if (!userId) {
        return res.status(400).json({ error: 'ID de usuario requerido' });
    }
    
    // Primero eliminar contactos donde el usuario es dueño
    const deleteContactosSql = "DELETE FROM contactos WHERE id_usuario_dueno = ? OR id_usuario_agregado = ?";
    db.query(deleteContactosSql, [userId, userId], (err) => {
        if (err) console.error('Error al eliminar contactos:', err);
        
        // Eliminar mensajes enviados o recibidos por el usuario
        const deleteMensajesSql = "DELETE FROM mensajes WHERE id_emisor = ? OR id_receptor_usuario = ?";
        db.query(deleteMensajesSql, [userId, userId], (err) => {
            if (err) console.error('Error al eliminar mensajes:', err);
            
            // Eliminar configuración de chats
            const deleteConfigSql = "DELETE FROM chat_configuracion WHERE id_usuario = ?";
            db.query(deleteConfigSql, [userId], (err) => {
                if (err) console.error('Error al eliminar configuración:', err);
                
                // Finalmente eliminar el usuario
                const deleteUserSql = "DELETE FROM usuarios WHERE id_usuario = ?";
                db.query(deleteUserSql, [userId], (err, result) => {
                    if (err) {
                        console.error('Error al eliminar usuario:', err);
                        return res.status(500).json({ error: 'Error al eliminar cuenta' });
                    }
                    
                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: 'Usuario no encontrado' });
                    }
                    
                    console.log('✅ Cuenta eliminada correctamente');
                    res.json({ mensaje: 'Cuenta eliminada correctamente' });
                });
            });
        });
    });
});


// --- RUTAS DE NAVEGACIÓN ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/registro', (req, res) => res.sendFile(path.join(__dirname, 'public/registro.html')));
app.get('/verificacion', (req, res) => res.sendFile(path.join(__dirname, 'public/verificacion.html')));
app.get('/verificado', (req, res) => res.sendFile(path.join(__dirname, 'public/verificado.html')));
app.get('/completar-perfil', (req, res) => res.sendFile(path.join(__dirname, 'public/completar-perfil.html')));
app.get('/chats', (req, res) => res.sendFile(path.join(__dirname, 'public/chats.html')));
app.get('/ajustes', (req, res) => res.sendFile(path.join(__dirname, 'public/ajustes.html')));
app.get('/archivados', (req, res) => res.sendFile(path.join(__dirname, 'public/archivados.html')));
app.get('/conversacion', (req, res) => res.sendFile(path.join(__dirname, 'public/conversacion.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/logout', (req, res) =>
    // El frontend se encarga de limpiar sessionStorage
    res.redirect('/login'));

// Ruta para login admin
app.get('/login-admin', (req, res) => {
    const sql = "SELECT id_usuario FROM usuarios WHERE rol = 'Admin' LIMIT 1";
    db.query(sql, (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).send("No se encontró un usuario Admin en la base de datos.");
        }
        res.redirect(`/chats?userId=${results[0].id_usuario}&role=admin`);
    });
});



// === SECCIÓN DE ADMINISTRACIÓN ===

// Almacenamiento temporal para códigos de admin
const adminVerificationCodes = new Map();

// Ruta para la página de admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// Ruta para la página de verificación de admin
app.get('/admin/verificacionadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/verificacionadmin.html'));
});

// Endpoint para login de admin (solo correo)
app.post('/admin/login', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Correo electrónico requerido' });
    }

    try {
        // Verificar en BD si el usuario existe y es admin
        const checkSql = "SELECT id_usuario, nombre_usuario, rol FROM usuarios WHERE correo = ? AND rol = 'Admin'";
        
        db.query(checkSql, [email], async (err, results) => {
            if (err) {
                console.error('Error al verificar admin:', err);
                return res.status(500).json({ message: 'Error en el servidor' });
            }

            if (results.length === 0) {
                return res.status(401).json({ message: 'No eres administrador o el correo no está registrado' });
            }

            const admin = results[0];
            
            // Generar código de 5 dígitos
            const code = Math.floor(10000 + Math.random() * 90000).toString();
            
            // Guardar código temporalmente (expira en 10 minutos)
            adminVerificationCodes.set(email, {
                code: code,
                expires: Date.now() + 10 * 60 * 1000,
                attempts: 0,
                userId: admin.id_usuario,
                nombreUsuario: admin.nombre_usuario
            });
            
            // Enviar código por correo usando la misma función que ya existe
            console.log(`📧 Enviando código de admin a ${email}...`);
            
            const mailOptions = {
                from: `"Connex Admin" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: '🔐 Código de verificación - Panel de Administración',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                            .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                            .header { background: linear-gradient(135deg, #7b2ff7, #a64dff); padding: 30px; text-align: center; }
                            .logo { font-size: 48px; margin-bottom: 10px; }
                            .header h1 { color: white; margin: 0; font-size: 28px; }
                            .content { padding: 30px; text-align: center; }
                            .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
                            .admin-badge { display: inline-block; background: #7b2ff7; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 20px; }
                            .code { font-size: 42px; font-weight: bold; color: #7b2ff7; background: #f0f0f0; padding: 20px; border-radius: 12px; letter-spacing: 8px; margin: 25px 0; font-family: monospace; }
                            .message { color: #666; line-height: 1.6; margin: 20px 0; }
                            .footer { background: #f8f8f8; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">💬</div>
                                <h1>Connex Admin</h1>
                            </div>
                            <div class="content">
                                <div class="greeting">¡Hola ${admin.nombre_usuario}!</div>
                                <div class="admin-badge">Acceso Administrador</div>
                                <div class="message">
                                    Has solicitado acceder al panel de administración de <strong>Connex</strong>.
                                    Utiliza el siguiente código de verificación:
                                </div>
                                <div class="code">${code}</div>
                                <div class="message">
                                    Este código expirará en <strong>10 minutos</strong>.<br>
                                    Si no solicitaste este acceso, ignora este mensaje.
                                </div>
                            </div>
                            <div class="footer">
                                <p>Connex - Conectando mundos, un mensaje a la vez.</p>
                                <p>Este es un correo automático, por favor no responder.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `Hola ${admin.nombre_usuario},\n\nTu código de verificación para el panel de administración de Connex es: ${code}\n\nEste código expirará en 10 minutos.\n\nConnex - Conectando mundos, un mensaje a la vez.`
            };
            
            try {
                const info = await emailTransporter.sendMail(mailOptions);
                console.log("✅ Correo de admin enviado:", info.messageId);
                res.json({ message: 'Código enviado a tu correo electrónico' });
            } catch (emailError) {
                console.error('❌ Error enviando correo de admin:', emailError);
                res.status(500).json({ message: 'Error al enviar el código de verificación' });
            }
        });
        
    } catch (error) {
        console.error('Error en login admin:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Endpoint para verificar código de admin
app.post('/admin/verificacionadmin', (req, res) => {
    console.log('🔵 POST /admin/verificacionadmin recibido');
    console.log('Body completo:', JSON.stringify(req.body, null, 2));
    
    const { email, code } = req.body;
    
    if (!email || !code) {
        console.log('❌ Email o código faltante');
        return res.status(400).json({ 
            success: false,
            message: 'Correo y código requeridos' 
        });
    }
    
    const storedCode = adminVerificationCodes.get(email);
    console.log('Código almacenado:', storedCode);
    console.log('Códigos activos:', Array.from(adminVerificationCodes.keys()));
    
    if (!storedCode) {
        console.log('❌ No hay código activo para:', email);
        return res.status(400).json({ 
            success: false,
            message: 'No hay código activo. Solicita uno nuevo.' 
        });
    }
    
    if (Date.now() > storedCode.expires) {
        console.log('❌ Código expirado para:', email);
        adminVerificationCodes.delete(email);
        return res.status(400).json({ 
            success: false,
            message: 'El código ha expirado. Solicita uno nuevo.' 
        });
    }
    
    if (storedCode.attempts >= 3) {
        console.log('❌ Demasiados intentos para:', email);
        adminVerificationCodes.delete(email);
        return res.status(400).json({ 
            success: false,
            message: 'Demasiados intentos fallidos. Solicita un nuevo código.' 
        });
    }
    
    if (storedCode.code !== code) {
        storedCode.attempts++;
        adminVerificationCodes.set(email, storedCode);
        console.log(`❌ Código incorrecto. Intentos: ${storedCode.attempts}`);
        return res.status(400).json({ 
            success: false,
            message: `Código incorrecto. Te quedan ${3 - storedCode.attempts} intentos.` 
        });
    }
    
    // Código correcto
    console.log('✅ Código correcto para:', email);
    adminVerificationCodes.delete(email);
    
    const redirectUrl = `/admin/verificadoadmin?userId=${storedCode.userId}&nombreUsuario=${encodeURIComponent(storedCode.nombreUsuario)}&nivelAcceso=${storedCode.nivelAcceso || 'Admin'}`;
    console.log('🔀 Redirigiendo a:', redirectUrl);
    
    res.json({ 
        success: true,
        message: 'Verificación exitosa',
        userId: storedCode.userId,
        nombreUsuario: storedCode.nombreUsuario,
        nivelAcceso: storedCode.nivelAcceso || 'Admin',
        redirectUrl: redirectUrl
    });
});

// Endpoint para reenviar código de admin
app.post('/admin/resend-code', async (req, res) => {
    const { email } = req.body;
    
    console.log('🔵 POST /admin/resend-code recibido'); // Debug
    console.log('Email:', email); // Debug
    
    if (!email) {
        console.log('❌ Email no proporcionado');
        return res.status(400).json({ message: 'Correo electrónico requerido' });
    }
    
    try {
        // Verificar si es admin
        const checkSql = "SELECT id_usuario, nombre_usuario, rol FROM usuarios WHERE correo = ? AND rol = 'Admin'";
        
        db.query(checkSql, [email], async (err, results) => {
            if (err) {
                console.error('❌ Error al verificar admin:', err);
                return res.status(500).json({ message: 'Error en el servidor' });
            }
            
            console.log('Resultados de búsqueda:', results); // Debug
            
            if (results.length === 0) {
                console.log('❌ No es administrador o no existe:', email);
                return res.status(401).json({ message: 'No eres administrador' });
            }
            
            const admin = results[0];
            console.log('✅ Admin encontrado:', admin.nombre_usuario); // Debug
            
            // Generar nuevo código de 5 dígitos
            const code = Math.floor(10000 + Math.random() * 90000).toString();
            console.log('📝 Nuevo código generado:', code); // Debug
            
            // Actualizar código en el almacenamiento temporal
            adminVerificationCodes.set(email, {
                code: code,
                expires: Date.now() + 10 * 60 * 1000, // 10 minutos
                attempts: 0,
                userId: admin.id_usuario,
                nombreUsuario: admin.nombre_usuario
            });
            
            console.log('💾 Código guardado para:', email); // Debug
            console.log('🗑️ Códigos activos:', Array.from(adminVerificationCodes.keys())); // Debug
            
            // Enviar nuevo código por correo
            console.log(`📧 Reenviando código de admin a ${email}...`);
            
            const mailOptions = {
                from: `"Connex Admin" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: '🔄 Nuevo código de verificación - Panel de Administración',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                            .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                            .header { background: linear-gradient(135deg, #7b2ff7, #a64dff); padding: 30px; text-align: center; }
                            .logo { font-size: 48px; margin-bottom: 10px; }
                            .header h1 { color: white; margin: 0; font-size: 28px; }
                            .content { padding: 30px; text-align: center; }
                            .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
                            .admin-badge { display: inline-block; background: #7b2ff7; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 20px; }
                            .code { font-size: 42px; font-weight: bold; color: #7b2ff7; background: #f0f0f0; padding: 20px; border-radius: 12px; letter-spacing: 8px; margin: 25px 0; font-family: monospace; }
                            .message { color: #666; line-height: 1.6; margin: 20px 0; }
                            .warning { background: #fff3cd; color: #856404; padding: 10px; border-radius: 8px; font-size: 14px; margin-top: 20px; }
                            .footer { background: #f8f8f8; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">💬</div>
                                <h1>Connex Admin</h1>
                            </div>
                            <div class="content">
                                <div class="greeting">¡Hola ${admin.nombre_usuario}!</div>
                                <div class="admin-badge">Acceso Administrador</div>
                                <div class="message">
                                    Has solicitado un <strong>nuevo código</strong> para acceder al panel de administración.
                                </div>
                                <div class="code">${code}</div>
                                <div class="message">
                                    Este código expirará en <strong>10 minutos</strong>.<br>
                                    Si no solicitaste este código, ignora este mensaje.
                                </div>
                                <div class="warning">
                                    ⚠️ El código anterior ya no es válido.
                                </div>
                            </div>
                            <div class="footer">
                                <p>Connex - Conectando mundos, un mensaje a la vez.</p>
                                <p>Este es un correo automático, por favor no responder.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `Hola ${admin.nombre_usuario},\n\nTu NUEVO código de verificación para el panel de administración de Connex es: ${code}\n\nEste código expirará en 10 minutos.\n\nEl código anterior ya no es válido.\n\nConnex - Conectando mundos, un mensaje a la vez.`
            };
            
            try {
                const info = await emailTransporter.sendMail(mailOptions);
                console.log("✅ Correo de admin reenviado:", info.messageId);
                res.json({ 
                    message: 'Código reenviado exitosamente a tu correo',
                    success: true
                });
            } catch (emailError) {
                console.error('❌ Error enviando correo de admin:', emailError);
                res.status(500).json({ 
                    message: 'Error al enviar el código de verificación',
                    error: emailError.message
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error en resend-code:', error);
        res.status(500).json({ 
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// Dashboard de admin (ruta protegida)
app.get('/admin/dashboard', (req, res) => {
    // Aquí puedes mostrar el panel de administración
    // Por ahora enviamos un mensaje simple
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Connex Admin Dashboard</title>
            <style>
                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    background: radial-gradient(circle at center, #1a0033 0%, #0a0015 40%, #000000 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .dashboard {
                    text-align: center;
                    background: rgba(0,0,0,0.5);
                    padding: 40px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                }
                h1 { color: #7b2cff; }
                .logout-btn {
                    display: inline-block;
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #7b2cff;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                }
                .logout-btn:hover {
                    background: #651ee6;
                }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <h1>Panel de Administración</h1>
                <p>Bienvenido al dashboard de administración de Connex</p>
                <p>Aquí podrás gestionar usuarios, ver estadísticas y más.</p>
                <a href="/" class="logout-btn">Cerrar sesión</a>
            </div>
        </body>
        </html>
    `);
});

// Ruta para la página de verificación exitosa
app.get('/admin/verificadoadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/verificadoadmin.html'));
});

console.log('✅ Rutas de administración cargadas');


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ConneX corriendo en http://localhost:${PORT}`);
    console.log('✅ API: Envío de códigos por correo electrónico');
});