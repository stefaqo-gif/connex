// ============================================================
// sockets/socketHandler.js  –  Lógica completa de Socket.IO
// Usa IDs numéricos de la tabla `usuarios`
// ============================================================
const Message = require('../models/Message');
const User    = require('../models/User');

/**
 * onlineUsers: Map<String(userId), socketId>
 * Todos los IDs se normalizan a String para comparación segura.
 */
const onlineUsers = new Map();

function initSocket(io) {

  io.on('connection', (socket) => {
    console.log(`🔌 Socket conectado: ${socket.id}`);

    // ── register_user ─────────────────────────────────────
    socket.on('register_user', async ({ userId }) => {
      if (!userId) return;
      const uid = String(userId);

      onlineUsers.set(uid, socket.id);
      socket.userId = uid;
      console.log(`👤 Registrado: ${uid} → ${socket.id}`);

      try { await User.touchLastSeen(uid); } catch (e) {}

      // Notificar a todos que este usuario está online
      io.emit('user_online', { userId: uid });

      // Entregar mensajes pendientes
      try {
        const pending = await Message.getPendingForReceiver(uid);
        if (pending.length) {
         

          socket.emit('pending_messages', { messages: pending });
        }
      } catch (e) {
        console.error('pending_messages error:', e);
      }
    });
   
    // ── send_message ──────────────────────────────────────
  socket.on('send_message', async ({ senderId, receiverId, content, msgType = 'text', archivoBase64, nombreArchivo }) => {
    if (!senderId || !receiverId) return;
    const sid = String(senderId);
    const rid = String(receiverId);

    try {
        const msg = await Message.create({
            senderId: sid,
            receiverId: rid,
            content: content || nombreArchivo || '',
            msgType,
            archivoBase64: archivoBase64 || null
        });

        socket.emit('message_sent', { messageId: msg.id });

        const receiverSid = onlineUsers.get(rid);
        if (receiverSid) {
            io.to(receiverSid).emit('receive_message', {
                messageId:  msg.id,
                senderId:   sid,
                receiverId: rid,
                content:    content || nombreArchivo || '',
                msgType,
                archivoBase64: archivoBase64 || null,
                nombreArchivo: nombreArchivo || null,
                status:     'sent',
                createdAt:  new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('send_message error:', err);
        socket.emit('message_error', { error: 'No se pudo enviar el mensaje' });
    }
});

    // ── message_seen ──────────────────────────────────────
    socket.on('message_sent', ({ messageId }) => {
    // asignar ID real al elemento optimista
    const el = pendingMessages.shift();
    if (el) el.dataset.msgId = String(messageId);
});

socket.on('messages_seen', ({ by }) => {
    const chatActualId = sessionStorage.getItem('chatActualId');
    // solo si estamos en el chat con esa persona
    if (String(by) === String(chatActualId)) {
        document.querySelectorAll('.msg-out .msg-checks').forEach(el => {
            el.classList.add('seen');
        });
    }
});

    // ── typing ────────────────────────────────────────────
    socket.on('typing', ({ senderId, receiverId, isTyping }) => {
      const receiverSid = onlineUsers.get(String(receiverId));
      if (receiverSid) {
        io.to(receiverSid).emit('typing', { senderId: String(senderId), isTyping });
      }
    });

    // ── disconnect ────────────────────────────────────────
    socket.on('disconnect', async () => {
      const uid = socket.userId;
      if (uid) {
        onlineUsers.delete(uid);
        io.emit('user_offline', { userId: uid });
        console.log(`❌ Desconectado: ${uid}`);
      }
      console.log(`🔌 Socket desconectado: ${socket.id}`);
    });
  });
}

module.exports = { initSocket, onlineUsers };
