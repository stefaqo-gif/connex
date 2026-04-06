// Almacenamiento temporal de códigos
const registrosTemporales = new Map();

// Endpoint para obtener países
app.get('/paises', (req, res) => {
    const sql = "SELECT * FROM paises ORDER BY nombre";
    db.query(sql, (err, results) => {
        if(err){
            res.status(500).json(err);
        } else {
            res.json(results);
        }
    });
});

// Función para enviar código por correo
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
                        body {
                            font-family: 'Segoe UI', Arial, sans-serif;
                            background-color: #f4f4f4;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 500px;
                            margin: 40px auto;
                            background: white;
                            border-radius: 16px;
                            overflow: hidden;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        }
                        .header {
                            background: linear-gradient(135deg, #7b2ff7, #a64dff);
                            padding: 30px;
                            text-align: center;
                        }
                        .logo {
                            font-size: 48px;
                            margin-bottom: 10px;
                        }
                        .header h1 {
                            color: white;
                            margin: 0;
                            font-size: 28px;
                        }
                        .content {
                            padding: 30px;
                            text-align: center;
                        }
                        .greeting {
                            font-size: 18px;
                            color: #333;
                            margin-bottom: 20px;
                        }
                        .code {
                            font-size: 42px;
                            font-weight: bold;
                            color: #7b2ff7;
                            background: #f0f0f0;
                            padding: 20px;
                            border-radius: 12px;
                            letter-spacing: 8px;
                            margin: 25px 0;
                            font-family: monospace;
                        }
                        .message {
                            color: #666;
                            line-height: 1.6;
                            margin: 20px 0;
                        }
                        .footer {
                            background: #f8f8f8;
                            padding: 20px;
                            text-align: center;
                            color: #999;
                            font-size: 12px;
                            border-top: 1px solid #eee;
                        }
                        .button {
                            display: inline-block;
                            background: linear-gradient(135deg, #7b2ff7, #a64dff);
                            color: white;
                            text-decoration: none;
                            padding: 12px 30px;
                            border-radius: 25px;
                            margin-top: 15px;
                        }
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

        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error("❌ Error enviando correo:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Endpoint para enviar código de verificación (CONSUME API DE CORREO)
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
                apiResponse: {
                    messageId: resultadoAPI.messageId,
                    status: 'sent'
                }
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

// Endpoint para verificar código y crear usuario
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

    // Verificar si el usuario ya existe (por si acaso)
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

        // Código correcto, crear usuario con todos los datos
        const insertSql = `INSERT INTO usuarios 
            (id_pais, telefono, nombre_usuario, correo, foto_url, info_estado, 
             privacidad_foto, notificar_seguridad, descarga_auto, rol, esta_verificado) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'User', 1)`;

        db.query(insertSql, [
            data.idPais,  // ← Asegurar que se usa el idPais guardado
            telefono, 
            data.nombreUsuario || null, 
            data.correo, 
            data.fotoUrl || null, 
            data.infoEstado || '¡Hola! Estoy usando ConneX.',
            data.privacidadFoto || 'Todos', 
            data.notificarSeguridad !== undefined ? data.notificarSeguridad : 1, 
            data.descargaAuto || 'Wifi'
        ], (err, result) => {
            if (err) {
                console.error('Error al crear usuario:', err);
                return res.status(500).json({ error: 'Error al crear la cuenta' });
            }

            console.log('✅ Usuario creado con ID:', result.insertId);
            console.log('✅ País guardado (id_pais):', data.idPais);

            // Limpiar datos temporales
            registrosTemporales.delete(telefono);

            res.json({ 
                mensaje: 'Cuenta verificada y creada exitosamente',
                usuarioId: result.insertId,
                nombreUsuario: data.nombreUsuario,
                idPais: data.idPais  // Devolver también el país para confirmación
            });
        });
    });
});

// Endpoint para registrar usuario con todos los datos
app.post('/registrar-usuario', async (req, res) => {
    const { 
        telefono, idPais, nombreUsuario, correo, fotoUrl,
        infoEstado, privacidadFoto, notificarSeguridad, descargaAuto 
    } = req.body;

    console.log('📝 Registrando usuario:', { telefono, idPais, nombreUsuario, correo });

    if (!telefono || !idPais || !nombreUsuario || !correo) {
        return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
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

        // Guardar todos los datos temporalmente, INCLUYENDO idPais
        registrosTemporales.set(telefono, {
            idPais: idPais,  // ← Asegurar que se guarda
            nombreUsuario: nombreUsuario,
            correo: correo,
            fotoUrl: fotoUrl || null,
            infoEstado: infoEstado || '¡Hola! Estoy usando ConneX.',
            privacidadFoto: privacidadFoto || 'Todos',
            notificarSeguridad: notificarSeguridad !== undefined ? notificarSeguridad : 1,
            descargaAuto: descargaAuto || 'Wifi',
            codigo: codigo,
            timestamp: Date.now(),
            intentos: 0
        });

        console.log('✅ Datos guardados temporalmente:', {
            telefono,
            idPais,
            nombreUsuario,
            tieneFoto: !!fotoUrl
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

// Endpoint para actualizar perfil de usuario - MEJORADO CON LOGS
app.post('/actualizar-perfil', (req, res) => {
    console.log('🔵 Recibida solicitud en /actualizar-perfil');
    console.log('Body:', req.body);
    
    const { 
        userId, nombreUsuario, correo, fotoUrl, infoEstado,
        privacidadFoto, notificarSeguridad, descargaAuto 
    } = req.body;

    if (!userId || !nombreUsuario || !correo) {
        console.log('❌ Datos incompletos:', { userId, nombreUsuario, correo });
        return res.status(400).json({ error: 'Datos incompletos' });
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
        nombreUsuario,
        correo,
        fotoUrl || null,
        infoEstado || '¡Hola! Estoy usando ConneX.',
        privacidadFoto || 'Todos',
        notificarSeguridad !== undefined ? notificarSeguridad : 1,
        descargaAuto || 'Wifi',
        userId
    ];
    
    console.log('📝 Ejecutando SQL:', sql);
    console.log('📝 Valores:', values);

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('❌ Error al actualizar perfil:', err);
            return res.status(500).json({ error: 'Error al actualizar el perfil', details: err.message });
        }

        console.log('✅ Resultado de actualización:', result);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ 
            mensaje: 'Perfil actualizado correctamente',
            usuarioId: userId
        });
    });
});

// Obtener datos completos de usuario (incluyendo país)
app.get('/usuario-completo/:id', (req, res) => {
    const { id } = req.params;
    const sql = `SELECT u.*, p.nombre as pais_nombre, p.codigo_area 
                 FROM usuarios u 
                 LEFT JOIN paises p ON u.id_pais = p.id_pais 
                 WHERE u.id_usuario = ?`;
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener usuario completo:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(results[0]);
    });
});

// Obtener datos de usuario
app.get('/usuario/:id', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT id_usuario, nombre_usuario, telefono, correo, foto_url, info_estado, privacidad_foto, descarga_auto FROM usuarios WHERE id_usuario = ?";
    db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(results[0]);
    });
});

// Endpoint para obtener chats del usuario
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

// Actualizar privacidad
app.post('/actualizar-privacidad', (req, res) => {
    const { userId, privacidadFoto } = req.body;
    const sql = "UPDATE usuarios SET privacidad_foto = ? WHERE id_usuario = ?";
    db.query(sql, [privacidadFoto, userId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al actualizar' });
        }
        res.json({ mensaje: 'Actualizado correctamente' });
    });
});

// Actualizar descarga automática
app.post('/actualizar-descarga', (req, res) => {
    const { userId, descargaAuto } = req.body;
    const sql = "UPDATE usuarios SET descarga_auto = ? WHERE id_usuario = ?";
    db.query(sql, [descargaAuto, userId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al actualizar' });
        }
        res.json({ mensaje: 'Actualizado correctamente' });
    });
});

// Endpoint para reenviar código (TAMBIÉN CONSUME API DE CORREO)
app.post('/reenviar-codigo', async (req, res) => {
    const { telefono } = req.body;

    if (!telefono) {
        return res.status(400).json({ error: 'Teléfono requerido' });
    }

    const data = registrosTemporales.get(telefono);

    if (!data) {
        return res.status(400).json({ error: 'Sesión expirada. Inicia el registro nuevamente.' });
    }

    // Generar nuevo código
    const codigo = Math.floor(10000 + Math.random() * 90000).toString();

    // Actualizar datos
    data.codigo = codigo;
    data.timestamp = Date.now();
    data.intentos = 0;
    registrosTemporales.set(telefono, data);

    // Enviar código por correo
    console.log('🔄 Reenviando código por correo...');
    const resultadoAPI = await enviarCodigoPorCorreo(data.correo, codigo, data.nombreUsuario);

    if (resultadoAPI.success) {
        res.json({ 
            mensaje: 'Código reenviado correctamente a tu correo',
            apiResponse: {
                messageId: resultadoAPI.messageId,
                status: 'sent'
            }
        });
    } else {
        res.status(500).json({ 
            error: 'Error al reenviar el código',
            apiError: resultadoAPI.error
        });
    }
});