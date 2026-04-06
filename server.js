// ============================================================
// server.js  –  Punto de entrada principal de ConneX
// ============================================================
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const nodemailer = require('nodemailer');
const db         = require('./db');
const Story      = require('./models/Story');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Aumenta el límite para fotos/videos en Base64 cifrado
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Configuración de correo ──────────────────────────────────
const emailTransporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   process.env.EMAIL_PORT || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── Almacenamiento temporal para verificaciones ──────────────
const registrosTemporales    = new Map();
const adminVerificationCodes = new Map();

// ── Función auxiliar: enviar correo ─────────────────────────
async function enviarCodigoPorCorreo(email, codigo, nombreUsuario) {
  try {
    await emailTransporter.sendMail({
      from: `"Connex" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Código de verificación - Connex',
      text: `Hola${nombreUsuario ? ' ' + nombreUsuario : ''},\n\nTu código de verificación es: ${codigo}\n\nExpira en 5 minutos.\n\nConnex`
    });
    return { success: true };
  } catch (e) {
    console.error('Error enviando correo:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Diagnóstico ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM usuarios');
    res.json({ status: 'ok', db: 'conectado', usuarios: rows[0].total });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'fallido', mensaje: err.message });
  }
});

// ── Socket.IO ────────────────────────────────────────────────
const { initSocket, onlineUsers } = require('./sockets/socketHandler');
initSocket(io);

// ── Rutas API modernas (/api/) ───────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/messages',  require('./routes/messages'));
app.use('/api/stories',   require('./routes/stories'));
app.use('/api/admin',     require('./routes/admin')(onlineUsers));
app.use('/api/upload',    require('./routes/upload'));
app.use('/api/cifrado',   require('./routes/cifrado')(db));
app.use('/api/grupos',    require('./routes/grupos')(db));
app.use('/api/contactos', require('./routes/contactos')(db));

const chatsGruposRouter = require('./routes/chatsgrupos')(db);
app.use('/api/chatsgrupos', chatsGruposRouter);
app.use('/api/clavesgrupo', chatsGruposRouter);

// ── Rutas heredadas de app.js (sin prefijo) ──────────────────

// Países
app.get('/paises', (req, res) => {
  db.query('SELECT id_pais, nombre, codigo_area FROM paises ORDER BY nombre', (err, r) => {
    if (err) return res.status(500).json(err);
    res.json(r);
  });
});

// Registro
app.post('/enviar-codigo', async (req, res) => {
  const { telefono, idPais, correo } = req.body;
  if (!telefono || !idPais || !correo) return res.status(400).json({ error: 'Teléfono, país y correo requeridos' });
  db.query('SELECT id_usuario FROM usuarios WHERE telefono=? OR correo=?', [telefono, correo], async (err, r) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (r.length > 0) return res.status(400).json({ error: 'Este número o correo ya está registrado' });
    const codigo = Math.floor(10000 + Math.random() * 90000).toString();
    registrosTemporales.set(telefono, { idPais, correo, codigo, timestamp: Date.now(), intentos: 0 });
    const resultado = await enviarCodigoPorCorreo(correo, codigo);
    if (resultado.success) res.json({ mensaje: 'Código enviado correctamente a tu correo' });
    else res.status(500).json({ error: 'Error al enviar el correo', apiError: resultado.error });
  });
});

app.post('/registrar-usuario', async (req, res) => {
  const { telefono, idPais, nombreUsuario, correo, fotoUrl, infoEstado, privacidadFoto, notificarSeguridad, descargaAuto } = req.body;
  if (!telefono || !idPais || !nombreUsuario || !correo) return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
  let fotoParaGuardar = null;
  if (fotoUrl && fotoUrl !== 'null' && fotoUrl !== 'undefined' && fotoUrl !== '') {
    if (fotoUrl.length > 500000) return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 500KB.' });
    fotoParaGuardar = fotoUrl;
  }
  db.query('SELECT id_usuario FROM usuarios WHERE telefono=? OR correo=?', [telefono, correo], async (err, r) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (r.length > 0) return res.status(400).json({ error: 'Este número o correo ya está registrado' });
    const codigo = Math.floor(10000 + Math.random() * 90000).toString();
    registrosTemporales.set(telefono, {
      idPais, nombreUsuario, correo, fotoUrl: fotoParaGuardar,
      infoEstado: infoEstado || '¡Hola! Estoy usando ConneX.',
      privacidadFoto: privacidadFoto || 'Todos',
      notificarSeguridad: notificarSeguridad !== undefined ? notificarSeguridad : 1,
      descargaAuto: descargaAuto || 'Wifi',
      codigo, timestamp: Date.now(), intentos: 0
    });
    const resultado = await enviarCodigoPorCorreo(correo, codigo, nombreUsuario);
    if (resultado.success) res.json({ mensaje: 'Código enviado correctamente a tu correo', usuarioId: null });
    else res.status(500).json({ error: 'Error al enviar el correo', apiError: resultado.error });
  });
});

app.post('/verificar-codigo', (req, res) => {
  const { telefono, codigo } = req.body;
  if (!telefono || !codigo) return res.status(400).json({ error: 'Teléfono y código requeridos' });
  const data = registrosTemporales.get(telefono);
  if (!data) return res.status(400).json({ error: 'Código no encontrado. Solicita uno nuevo.' });
  if (Date.now() - data.timestamp > 5 * 60 * 1000) { registrosTemporales.delete(telefono); return res.status(400).json({ error: 'Código expirado. Solicita uno nuevo.' }); }
  if (data.intentos >= 3) { registrosTemporales.delete(telefono); return res.status(400).json({ error: 'Demasiados intentos. Solicita un nuevo código.' }); }
  data.intentos++; registrosTemporales.set(telefono, data);
  if (data.codigo !== codigo) return res.status(400).json({ error: 'Código incorrecto' });
  db.query('SELECT id_usuario FROM usuarios WHERE telefono=?', [telefono], (err, r) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (r.length > 0) { registrosTemporales.delete(telefono); return res.json({ mensaje: 'Usuario ya existe', usuarioId: r[0].id_usuario, yaExistia: true }); }
    db.query(
      "INSERT INTO usuarios (id_pais,telefono,nombre_usuario,correo,foto_url,info_estado,privacidad_foto,notificar_seguridad,descarga_auto,rol,esta_verificado) VALUES (?,?,?,?,?,?,?,?,?,'User',1)",
      [data.idPais, telefono, data.nombreUsuario || 'Usuario Connex', data.correo, data.fotoUrl || null,
       data.infoEstado || '¡Hola! Estoy usando ConneX.', data.privacidadFoto || 'Todos',
       data.notificarSeguridad !== undefined ? data.notificarSeguridad : 1, data.descargaAuto || 'Wifi'],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al crear la cuenta', detalle: err.message });
        registrosTemporales.delete(telefono);
        res.json({ mensaje: 'Cuenta verificada y creada exitosamente', usuarioId: result.insertId, nombreUsuario: data.nombreUsuario });
      }
    );
  });
});

app.post('/reenviar-codigo', async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) return res.status(400).json({ error: 'Teléfono requerido' });
  const data = registrosTemporales.get(telefono);
  if (!data) return res.status(400).json({ error: 'Sesión expirada. Inicia el registro nuevamente.' });
  const codigo = Math.floor(10000 + Math.random() * 90000).toString();
  data.codigo = codigo; data.timestamp = Date.now(); data.intentos = 0;
  registrosTemporales.set(telefono, data);
  const resultado = await enviarCodigoPorCorreo(data.correo, codigo, data.nombreUsuario);
  if (resultado.success) res.json({ mensaje: 'Código reenviado correctamente a tu correo' });
  else res.status(500).json({ error: 'Error al reenviar el código', apiError: resultado.error });
});

// Login usuario
app.post('/login', (req, res) => {
  const { identificador } = req.body;
  if (!identificador) return res.status(400).json({ error: 'Correo o teléfono requerido' });
  db.query("SELECT id_usuario,nombre_usuario,correo,telefono,foto_url,rol FROM usuarios WHERE (correo=? OR telefono=?) AND rol='User'", [identificador, identificador], (err, r) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (r.length === 0) return res.status(404).json({ error: 'Usuario no encontrado o sin permisos de usuario regular' });
    const u = r[0];
    res.json({ mensaje: 'Login exitoso', usuarioId: u.id_usuario, nombre_usuario: u.nombre_usuario, correo: u.correo, foto_url: u.foto_url, rol: u.rol });
  });
});

// Datos de usuario
app.get('/usuario/:id', (req, res) => {
  db.query('SELECT id_usuario,nombre_usuario,telefono,correo,foto_url,info_estado,privacidad_foto,descarga_auto,id_pais FROM usuarios WHERE id_usuario=?', [req.params.id], (err, r) => {
    if (err) return res.status(500).json({ error: err.message });
    if (r.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(r[0]);
  });
});

app.get('/usuario-completo/:id', (req, res) => {
  db.query('SELECT u.*,p.nombre as pais_nombre,p.codigo_area FROM usuarios u LEFT JOIN paises p ON u.id_pais=p.id_pais WHERE u.id_usuario=?', [req.params.id], (err, r) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (r.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(r[0]);
  });
});

// Actualizar perfil
app.post('/actualizar-perfil', (req, res) => {
  const { userId, nombreUsuario, correo, fotoUrl, infoEstado, privacidadFoto, notificarSeguridad, descargaAuto } = req.body;
  if (!userId || !nombreUsuario || !correo) return res.status(400).json({ error: 'Datos incompletos' });
  let fotoParaGuardar = null;
  if (fotoUrl && fotoUrl !== 'null' && fotoUrl !== 'undefined' && fotoUrl !== '') {
    if (fotoUrl.length > 500000) return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 500KB.' });
    fotoParaGuardar = fotoUrl;
  }
  db.query(
    'UPDATE usuarios SET nombre_usuario=?,correo=?,foto_url=?,info_estado=?,privacidad_foto=?,notificar_seguridad=?,descarga_auto=? WHERE id_usuario=?',
    [nombreUsuario.trim(), correo.trim(), fotoParaGuardar, infoEstado || '¡Hola! Estoy usando ConneX.',
     privacidadFoto || 'Todos', notificarSeguridad !== undefined ? (notificarSeguridad ? 1 : 0) : 1, descargaAuto || 'Wifi', userId],
    (err) => {
      if (err) {
        if (err.code === 'ER_DATA_TOO_LONG') return res.status(400).json({ error: 'La imagen es demasiado grande' });
        return res.status(500).json({ error: 'Error al actualizar el perfil' });
      }
      res.json({ mensaje: 'Perfil actualizado correctamente', usuarioId: userId, fotoActualizada: !!fotoParaGuardar });
    }
  );
});

app.post('/actualizar-privacidad', (req, res) => {
  const { userId, privacidadFoto } = req.body;
  db.query('UPDATE usuarios SET privacidad_foto=? WHERE id_usuario=?', [privacidadFoto, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar' });
    res.json({ mensaje: 'Actualizado correctamente' });
  });
});

app.post('/actualizar-descarga', (req, res) => {
  const { userId, descargaAuto } = req.body;
  db.query('UPDATE usuarios SET descarga_auto=? WHERE id_usuario=?', [descargaAuto, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar' });
    res.json({ mensaje: 'Actualizado correctamente' });
  });
});

app.post('/eliminar-cuenta', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'ID de usuario requerido' });
  db.query('DELETE FROM contactos WHERE id_usuario_dueno=? OR id_usuario_agregado=?', [userId, userId], () => {
    db.query('DELETE FROM mensajes WHERE id_emisor=? OR id_receptor_usuario=?', [userId, userId], () => {
      db.query('DELETE FROM chat_configuracion WHERE id_usuario=?', [userId], () => {
        db.query('DELETE FROM usuarios WHERE id_usuario=?', [userId], (err, r) => {
          if (err) return res.status(500).json({ error: 'Error al eliminar cuenta' });
          if (r.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
          res.json({ mensaje: 'Cuenta eliminada correctamente' });
        });
      });
    });
  });
});

// Chats
app.get('/chats/:userId', (req, res) => {
  const { userId } = req.params;
  db.query(
    `SELECT u.id_usuario,u.nombre_usuario,u.foto_url,u.info_estado,
      m.contenido_texto as ultimo_mensaje,m.fecha_envio,
      COUNT(CASE WHEN m.leido=0 AND m.id_emisor!=? THEN 1 END) as no_leidos
     FROM contactos c JOIN usuarios u ON u.id_usuario=c.id_usuario_agregado
     LEFT JOIN mensajes m ON (m.id_emisor=u.id_usuario AND m.id_receptor_usuario=?) OR (m.id_emisor=? AND m.id_receptor_usuario=u.id_usuario)
     WHERE c.id_usuario_dueno=?
     GROUP BY u.id_usuario ORDER BY m.fecha_envio DESC LIMIT 20`,
    [userId, userId, userId, userId],
    (err, r) => {
      if (err) return res.status(500).json({ error: 'Error en el servidor' });
      res.json(r);
    }
  );
});
app.get('/chats-config/:userId', (req, res) => {
  const { userId } = req.params;

  // Trae todos los usuarios con quienes hay al menos un mensaje (sin requerir contacto)
  db.query(
    `SELECT 
       u.id_usuario  AS chat_id,
       u.nombre_usuario AS nombre,
       u.foto_url,
       u.info_estado,
       'individual'  AS tipo,
       IFNULL(cc.esta_fijado,    0) AS fijado,
       IFNULL(cc.esta_archivado, 0) AS archivado
     FROM usuarios u
     JOIN mensajes m ON (
         (m.id_emisor = ? AND m.id_receptor_usuario = u.id_usuario) OR
         (m.id_emisor = u.id_usuario AND m.id_receptor_usuario = ?)
     )
     LEFT JOIN chat_configuracion cc
       ON cc.id_usuario = ? AND cc.id_chat_destino = u.id_usuario AND cc.es_grupal = 0
     WHERE u.id_usuario != ?
     GROUP BY u.id_usuario`,
    [userId, userId, userId, userId],
   (err, contactos) => {
  if (err) {
    console.error('❌ chats-config error:', err.message); // ← agrega esto
    return res.status(500).json({ error: 'Error al obtener chats' });
  }
      if (contactos.length === 0) return res.json([]);

      const ids = contactos.map(c => c.chat_id);

      // Último mensaje por cada chat
      const promises = ids.map(contactId => new Promise(resolve => {
        db.query(
          `SELECT contenido_texto, fecha_envio 
           FROM mensajes 
           WHERE (id_emisor = ? AND id_receptor_usuario = ?) 
              OR (id_emisor = ? AND id_receptor_usuario = ?) 
           ORDER BY fecha_envio DESC LIMIT 1`,
          [userId, contactId, contactId, userId],
          (err, r) => resolve(
            r && r.length > 0
              ? { contactId, mensaje: r[0].contenido_texto, fecha: r[0].fecha_envio }
              : { contactId, mensaje: null, fecha: null }
          )
        );
      }));

      Promise.all(promises).then(ultimosMensajes => {
        const msgMap = {};
        ultimosMensajes.forEach(u => {
          msgMap[u.contactId] = { mensaje: u.mensaje, fecha: u.fecha };
        });

        // Mensajes no leídos
        db.query(
          `SELECT id_emisor, COUNT(*) AS no_leidos 
           FROM mensajes 
           WHERE id_receptor_usuario = ? AND leido = 0 AND id_emisor IN (?) 
           GROUP BY id_emisor`,
          [userId, ids],
          (err, noLeidosResults) => {
            const nlMap = {};
            if (!err && noLeidosResults)
              noLeidosResults.forEach(r => { nlMap[r.id_emisor] = r.no_leidos; });

            const resultado = contactos.map(c => ({
              ...c,
              ultimo_mensaje: msgMap[c.chat_id]?.mensaje || null,
              fecha_envio:    msgMap[c.chat_id]?.fecha   || null,
              no_leidos:      nlMap[c.chat_id] || 0
            }));

            // Ordenar: fijados primero, luego por fecha
            resultado.sort((a, b) => {
              if (a.fijado && !b.fijado) return -1;
              if (!a.fijado && b.fijado) return 1;
              if (a.fecha_envio && !b.fecha_envio) return -1;
              if (!a.fecha_envio && b.fecha_envio) return 1;
              if (a.fecha_envio && b.fecha_envio)
                return new Date(b.fecha_envio) - new Date(a.fecha_envio);
              return a.nombre.localeCompare(b.nombre);
            });

            res.json(resultado);
          }
        );
      });
    }
  );
});
app.get('/buscar-usuarios/:userId', (req, res) => {
  const { userId } = req.params;
  const { q } = req.query;

  console.log('🔍 Buscando:', q, '| userId:', userId);

  if (!q || q.trim().length < 2) return res.json({ usuarios: [] });

  db.query(
    `SELECT id_usuario AS id, nombre_usuario AS nombre, foto_url, correo, telefono
     FROM usuarios
     WHERE (
       correo   LIKE ? OR
       telefono LIKE ?
     ) AND id_usuario != ?
     LIMIT 20`,
    [`%${q}%`, `%${q}%`, userId],
    (err, rows) => {
      console.log('🔍 Resultado:', err?.message, rows?.length);
      if (err) return res.status(500).json({ error: err.message });
      res.json({ usuarios: rows });
    }
  );
});

// Mensajes individuales
app.get('/mensajes/:userId/:contactId', (req, res) => {
  const { userId, contactId } = req.params;
  const page   = parseInt(req.query.page)  || 0;
  const limit  = parseInt(req.query.limit) || 30;
  const offset = page * limit;
  db.query(
    'SELECT * FROM mensajes WHERE (id_emisor=? AND id_receptor_usuario=?) OR (id_emisor=? AND id_receptor_usuario=?) ORDER BY fecha_envio DESC LIMIT ? OFFSET ?',
    [userId, contactId, contactId, userId, limit, offset],
    (err, r) => {
      if (err) return res.status(500).json({ error: 'Error al obtener mensajes' });
      db.query('UPDATE mensajes SET leido=1 WHERE id_emisor=? AND id_receptor_usuario=? AND leido=0', [contactId, userId]);
      res.json({ mensajes: r.reverse(), hasMore: r.length === limit, page, limit });
    }
  );
});
// Usuarios para el admin
app.get('/api/admin/usuarios', (req, res) => {
  db.query(
    'SELECT id_usuario, nombre_usuario, correo, rol, esta_verificado FROM usuarios ORDER BY id_usuario DESC LIMIT 50',
    (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(r);
    }
  );
});

// Estadísticas de mensajes (últimos 7 días)
app.get('/api/admin/stats', (req, res) => {
  db.query(
    `SELECT DATE(fecha_envio) as dia, COUNT(*) as total 
     FROM mensajes WHERE fecha_envio >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(fecha_envio) ORDER BY dia ASC`,
    (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(r);
    }
  );
});

// Enviar mensaje (fallback HTTP)
app.post('/enviar-mensaje', (req, res) => {
  const { senderId, receiverId, contenido, tipo = 'text' } = req.body;
  if (!senderId || !receiverId || !contenido) return res.status(400).json({ error: 'senderId, receiverId y contenido son requeridos' });
  db.query(
    'INSERT INTO mensajes (id_emisor,id_receptor_usuario,contenido_texto,tipo_mensaje,fecha_envio,leido) VALUES (?,?,?,?,NOW(),0)',
    [senderId, receiverId, contenido, tipo],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Error al guardar el mensaje', detalle: err.message });
      const receiverSid = onlineUsers.get(String(receiverId));
      if (receiverSid) {
        io.to(receiverSid).emit('receive_message', {
          messageId: result.insertId, senderId, receiverId, content: contenido, msgType: tipo,
          status: 'sent', createdAt: new Date().toISOString()
        });
      }
      res.json({ mensaje: 'Mensaje enviado', messageId: result.insertId });
    }
  );
});

// Acciones sobre chats
app.post('/archivar-chat', (req, res) => {
  const { userId, chatId, esGrupo, archivado } = req.body;
  if (!userId || !chatId) return res.status(400).json({ error: 'Datos incompletos' });
  db.query('INSERT INTO chat_configuracion (id_usuario,id_chat_destino,es_grupal,esta_archivado,esta_fijado) VALUES (?,?,?,?,0) ON DUPLICATE KEY UPDATE esta_archivado=VALUES(esta_archivado)',
    [userId, chatId, esGrupo ? 1 : 0, archivado ? 1 : 0],
    (err) => { if (err) return res.status(500).json({ error: 'Error al actualizar archivo' }); res.json({ mensaje: archivado ? 'Archivado' : 'Desarchivado' }); }
  );
});

app.post('/fijar-chat', (req, res) => {
  const { userId, chatId, esGrupo, fijado } = req.body;
  if (!userId || !chatId) return res.status(400).json({ error: 'Datos incompletos' });
  db.query('INSERT INTO chat_configuracion (id_usuario,id_chat_destino,es_grupal,esta_fijado,esta_archivado) VALUES (?,?,?,?,0) ON DUPLICATE KEY UPDATE esta_fijado=VALUES(esta_fijado)',
    [userId, chatId, esGrupo ? 1 : 0, fijado ? 1 : 0],
    (err) => { if (err) return res.status(500).json({ error: 'Error al fijar chat' }); res.json({ mensaje: fijado ? 'Fijado' : 'Desfijado' }); }
  );
});

app.post('/eliminar-chat', (req, res) => {
  const { userId, chatId, esGrupo } = req.body;
  if (!userId || !chatId) return res.status(400).json({ error: 'Datos incompletos' });
  db.query('DELETE FROM chat_configuracion WHERE id_usuario=? AND id_chat_destino=? AND es_grupal=?', [userId, chatId, esGrupo ? 1 : 0], (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar chat' });
    if (!esGrupo) db.query('DELETE FROM mensajes WHERE (id_emisor=? AND id_receptor_usuario=?) OR (id_emisor=? AND id_receptor_usuario=?)', [userId, chatId, chatId, userId]);
    res.json({ mensaje: 'Chat eliminado correctamente' });
  });
});

app.post('/eliminar-historial', (req, res) => {
  const { userId, chatId, esGrupo } = req.body;
  if (!userId || !chatId) return res.status(400).json({ error: 'Datos incompletos' });
  const sql    = esGrupo
    ? 'DELETE FROM mensajes WHERE id_receptor_grupo=? AND (SELECT 1 FROM miembros_grupo WHERE id_grupo=? AND id_usuario=?)'
    : 'DELETE FROM mensajes WHERE (id_emisor=? AND id_receptor_usuario=?) OR (id_emisor=? AND id_receptor_usuario=?)';
  const params = esGrupo ? [chatId, chatId, userId] : [userId, chatId, chatId, userId];
  db.query(sql, params, (err, r) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar historial' });
    res.json({ mensaje: 'Historial eliminado correctamente', afectados: r.affectedRows });
  });
});

// Contactos heredados
app.post('/sincronizar-contactos', (req, res) => {
  const { userId, contactos } = req.body;
  if (!userId || !contactos) return res.status(400).json({ error: 'Datos incompletos' });
  const telefonos = contactos.map(c => c.telefono);
  db.query('SELECT id_usuario,nombre_usuario,telefono,foto_url FROM usuarios WHERE telefono IN (?) AND id_usuario!=?', [telefonos, userId], (err, r) => {
    if (err) return res.status(500).json({ error: 'Error al sincronizar contactos' });
    r.forEach(contacto => {
      const nombreLocal = contactos.find(c => c.telefono === contacto.telefono)?.nombre || contacto.nombre_usuario;
      db.query('INSERT INTO contactos (id_usuario_dueno,id_usuario_agregado,nombre_servidor_local) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nombre_servidor_local=VALUES(nombre_servidor_local)', [userId, contacto.id_usuario, nombreLocal]);
    });
    res.json({ mensaje: 'Contactos sincronizados', contactosRegistrados: r });
  });
});

app.get('/contactos/:userId', (req, res) => {
  db.query(
    'SELECT u.id_usuario,u.nombre_usuario,u.telefono,u.foto_url,u.info_estado,c.nombre_servidor_local FROM contactos c JOIN usuarios u ON u.id_usuario=c.id_usuario_agregado WHERE c.id_usuario_dueno=? ORDER BY u.nombre_usuario ASC',
    [req.params.userId],
    (err, r) => { if (err) return res.status(500).json({ error: 'Error al obtener contactos' }); res.json(r); }
  );
});

app.get('/buscar-contactos/:userId/:termino', (req, res) => {
  const { userId, termino } = req.params;
  const b = `%${termino}%`;
  db.query('SELECT id_usuario,nombre_usuario,telefono,foto_url FROM usuarios WHERE id_usuario!=? AND (nombre_usuario LIKE ? OR telefono LIKE ?) ORDER BY nombre_usuario ASC LIMIT 20',
    [userId, b, b],
    (err, r) => { if (err) return res.status(500).json({ error: 'Error al buscar contactos' }); res.json(r); }
  );
});

// Admin heredado
app.post('/admin/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Correo electrónico requerido' });
  db.query("SELECT id_usuario,nombre_usuario FROM usuarios WHERE correo=? AND rol='Admin'", [email], async (err, r) => {
    if (err) return res.status(500).json({ message: 'Error en el servidor' });
    if (r.length === 0) return res.status(401).json({ message: 'No eres administrador o el correo no está registrado' });
    const admin = r[0];
    const code  = Math.floor(10000 + Math.random() * 90000).toString();
    adminVerificationCodes.set(email, { code, expires: Date.now() + 10 * 60 * 1000, attempts: 0, userId: admin.id_usuario, nombreUsuario: admin.nombre_usuario });
    try {
      await emailTransporter.sendMail({
        from: `"Connex Admin" <${process.env.EMAIL_USER}>`, to: email,
        subject: '🔐 Código de verificación - Panel de Administración',
        text: `Hola ${admin.nombre_usuario},\n\nTu código de verificación es: ${code}\n\nExpira en 10 minutos.`
      });
      res.json({ message: 'Código enviado a tu correo electrónico' });
    } catch (e) { res.status(500).json({ message: 'Error al enviar el código de verificación' }); }
  });
});

app.post('/admin/verificacionadmin', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, message: 'Correo y código requeridos' });
  const s = adminVerificationCodes.get(email);
  if (!s) return res.status(400).json({ success: false, message: 'No hay código activo. Solicita uno nuevo.' });
  if (Date.now() > s.expires) { adminVerificationCodes.delete(email); return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' }); }
  if (s.attempts >= 3) { adminVerificationCodes.delete(email); return res.status(400).json({ success: false, message: 'Demasiados intentos fallidos. Solicita un nuevo código.' }); }
  if (s.code !== code) { s.attempts++; adminVerificationCodes.set(email, s); return res.status(400).json({ success: false, message: `Código incorrecto. Te quedan ${3 - s.attempts} intentos.` }); }
  adminVerificationCodes.delete(email);
  res.json({ success: true, message: 'Verificación exitosa', userId: s.userId, nombreUsuario: s.nombreUsuario, nivelAcceso: 'Admin', redirectUrl: `/admin/verificadoadmin?userId=${s.userId}&nombreUsuario=${encodeURIComponent(s.nombreUsuario)}&nivelAcceso=Admin` });
});

app.post('/admin/resend-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Correo electrónico requerido' });
  db.query("SELECT id_usuario,nombre_usuario FROM usuarios WHERE correo=? AND rol='Admin'", [email], async (err, r) => {
    if (err || r.length === 0) return res.status(401).json({ message: 'No eres administrador' });
    const admin = r[0];
    const code  = Math.floor(10000 + Math.random() * 90000).toString();
    adminVerificationCodes.set(email, { code, expires: Date.now() + 10 * 60 * 1000, attempts: 0, userId: admin.id_usuario, nombreUsuario: admin.nombre_usuario });
    try {
      await emailTransporter.sendMail({
        from: `"Connex Admin" <${process.env.EMAIL_USER}>`, to: email,
        subject: '🔄 Nuevo código de verificación - Panel de Administración',
        text: `Hola ${admin.nombre_usuario},\n\nTu NUEVO código es: ${code}\n\nExpira en 10 minutos. El código anterior ya no es válido.`
      });
      res.json({ message: 'Código reenviado exitosamente a tu correo', success: true });
    } catch (e) { res.status(500).json({ message: 'Error al enviar el código de verificación' }); }
  });
});
// Mensajes por usuario
app.get('/api/admin/mensajes-por-usuario', (req, res) => {
  db.query(
    `SELECT u.nombre_usuario, COUNT(*) as total
     FROM mensajes m JOIN usuarios u ON u.id_usuario = m.id_emisor
     GROUP BY m.id_emisor ORDER BY total DESC LIMIT 50`,
    (err, r) => { if(err) return res.status(500).json({error:err.message}); res.json(r); }
  );
});

// Grupos con cantidad de miembros
app.get('/api/admin/grupos', (req, res) => {
  db.query(
    `SELECT g.nombre_grupo, g.fecha_creacion, COUNT(mg.id_usuario) as miembros
     FROM grupos g LEFT JOIN miembros_grupo mg ON mg.id_grupo = g.id_grupo
     GROUP BY g.id_grupo ORDER BY miembros DESC`,
    (err, r) => { if(err) return res.status(500).json({error:err.message}); res.json(r); }
  );
});

// Contactos por usuario
app.get('/api/admin/contactos-por-usuario', (req, res) => {
  db.query(
    `SELECT u.nombre_usuario, COUNT(*) as total
     FROM contactos c JOIN usuarios u ON u.id_usuario = c.id_usuario_dueno
     GROUP BY c.id_usuario_dueno ORDER BY total DESC LIMIT 50`,
    (err, r) => { if(err) return res.status(500).json({error:err.message}); res.json(r); }
  );
});

// Rutas de navegación HTML
app.get('/registro',          (req, res) => res.sendFile(path.join(__dirname, 'public/registro.html')));
app.get('/verificacion',      (req, res) => res.sendFile(path.join(__dirname, 'public/verificacion.html')));
app.get('/verificado',        (req, res) => res.sendFile(path.join(__dirname, 'public/verificado.html')));
app.get('/completar-perfil',  (req, res) => res.sendFile(path.join(__dirname, 'public/completar-perfil.html')));
app.get('/chats',             (req, res) => res.sendFile(path.join(__dirname, 'public/chats.html')));
app.get('/ajustes',           (req, res) => res.sendFile(path.join(__dirname, 'public/ajustes.html')));
app.get('/archivados',        (req, res) => res.sendFile(path.join(__dirname, 'public/archivados.html')));
app.get('/conversacion',      (req, res) => res.sendFile(path.join(__dirname, 'public/conversacion.html')));
app.get('/login',             (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/logout',            (req, res) => res.redirect('/login'));
app.get('/estados',           (req, res) => res.sendFile(path.join(__dirname, 'public/estados.html')));
app.get('/admin',             (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/admin/verificacionadmin', (req, res) => res.sendFile(path.join(__dirname, 'public/verificacionadmin.html')));
app.get('/admin/verificadoadmin',   (req, res) => res.sendFile(path.join(__dirname, 'public/verificadoadmin.html')));
app.get('/admin/reportes', (req, res) => res.sendFile(path.join(__dirname, 'public/adminReportes.html')));

app.get('/login-admin', (req, res) => {
  db.query("SELECT id_usuario FROM usuarios WHERE rol='Admin' LIMIT 1", (err, r) => {
    if (err || r.length === 0) return res.status(404).send('No se encontró un usuario Admin.');
    res.redirect(`/chats?userId=${r[0].id_usuario}&role=admin`);
  });
});

// Limpiar estados expirados cada hora
setInterval(async () => {
  try {
    const deleted = await Story.purgeExpired();
    if (deleted > 0) console.log(`🗑️  ${deleted} estado(s) expirado(s) eliminado(s)`);
  } catch (e) { console.error('purgeExpired error:', e.message); }
}, 60 * 60 * 1000);

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err.stack);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   ConneX                                  ║
║   http://localhost:${PORT}                ║
║   Diagnóstico: http://localhost:${PORT}/api/health
╚═══════════════════════════════════════════╝
  `);
});
