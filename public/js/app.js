// ============================================================
// ConneX – app.js  |  Sin login: selección directa de usuario
// ============================================================

'use strict';

// ─── Estado global ─────────────────────────────────────────
const STATE = {
  me:           null,
  activeChat:   null,
  contacts:     [],
  onlineUsers:  new Set(),
  unreadCounts: {},
  storyColor:   '#25D366',
  typingTimer:  null,
  chartInstance: null,
};

let socket = null;
const $ = id => document.getElementById(id);

// DOM refs
const loginScreen       = $('loginScreen');
const appScreen         = $('appScreen');
const myAvatar          = $('myAvatar');
const myAvatarText      = $('myAvatarText');
const myUsername        = $('myUsername');
const chatList          = $('chatList');
const searchInput       = $('searchInput');
const welcomePanel      = $('welcomePanel');
const chatPanel         = $('chatPanel');
const chatAvatar        = $('chatAvatar');
const chatAvatarText    = $('chatAvatarText');
const chatUsername      = $('chatUsername');
const chatStatus        = $('chatStatus');
const messagesContainer = $('messagesContainer');
const typingIndicator   = $('typingIndicator');
const typingText        = $('typingText');
const messageInput      = $('messageInput');
const sendBtn           = $('sendBtn');
const backBtn           = $('backBtn');
const toast             = $('toast');

// Modales
const storiesModal    = $('storiesModal');
const storiesBackdrop = $('storiesBackdrop');
const closeStories    = $('closeStories');
const storiesList     = $('storiesList');
const storyContent    = $('storyContent');
const storyPreview    = $('storyPreview');
const storyPreviewText= $('storyPreviewText');
const publishStoryBtn = $('publishStoryBtn');
const storyViewModal  = $('storyViewModal');
const storyViewBackdrop=$('storyViewBackdrop');
const closeStoryView  = $('closeStoryView');
const storyViewContent= $('storyViewContent');
const storyViewUsername=$('storyViewUsername');
const storyViewTime   = $('storyViewTime');
const storyViewAvatar = $('storyViewAvatar');
const storyProgressFill=$('storyProgressFill');
const viewCount       = $('viewCount');
const adminModal      = $('adminModal');
const adminBackdrop   = $('adminBackdrop');
const closeAdmin      = $('closeAdmin');
const statUsers       = $('statUsers');
const statMessages    = $('statMessages');
const statOnline      = $('statOnline');

// ─── Utilidades ────────────────────────────────────────────

function initials(name) {
  return name ? name.slice(0, 2).toUpperCase() : '??';
}

function avatarColor(name) {
  const colors = [
    'linear-gradient(135deg,#2a5298,#1a3a6b)',
    'linear-gradient(135deg,#7B2FBE,#4A1B8A)',
    'linear-gradient(135deg,#C75000,#8A3700)',
    'linear-gradient(135deg,#0e7c61,#054d3c)',
    'linear-gradient(135deg,#1565C0,#003c8f)',
    'linear-gradient(135deg,#6A1B9A,#38006b)',
  ];
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h += name.charCodeAt(i);
  return colors[h % colors.length];
}

function fmtTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoy';
  return d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
}

function showToast(msg, duration = 2800) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), duration);
}

function checkIcon(status) {
  const icons = {
    sent:      '<i class="fa-solid fa-check msg-check sent" title="Enviado"></i>',
    delivered: '<i class="fa-solid fa-check-double msg-check delivered" title="Entregado"></i>',
    seen:      '<i class="fa-solid fa-check-double msg-check seen" title="Visto"></i>',
  };
  return icons[status] || icons.sent;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── PANTALLA DE SELECCIÓN DE USUARIO ──────────────────────

async function loadUserSelectList() {
  const list = $('userSelectList');
  list.innerHTML = '<div class="loading-users"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios...</div>';
  try {
    const res  = await fetch('/api/auth/users');
    const data = await res.json();

    if (data.error) {
      list.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:16px">
        ❌ Error de BD: ${data.error}<br>
        <small style="color:#aaa">Verifica las credenciales en .env y que MySQL esté corriendo.<br>
        Abre <a href="/api/health" target="_blank" style="color:#25D366">/api/health</a> para diagnóstico.</small>
      </p>`;
      return;
    }

    const users = data.users || [];
    if (!users.length) {
      list.innerHTML = '<p style="color:#aaa;text-align:center;padding:16px">No hay usuarios en la BD.<br><small>Importa el schema.sql primero.</small></p>';
      return;
    }

    list.innerHTML = users.map(u => `
      <button class="user-select-btn" onclick="selectUser(${u.id})">
        <div class="user-select-avatar" style="background:${avatarColor(u.username)}">
          ${initials(u.username)}
        </div>
        <div class="user-select-info">
          <span class="user-select-name">${u.username}</span>
          <span class="user-select-status">${u.status_msg || ''}</span>
        </div>
        <i class="fa-solid fa-arrow-right user-select-arrow"></i>
      </button>
    `).join('');
  } catch (e) {
    list.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:16px">
      ❌ No se pudo conectar con el servidor.<br>
      <small style="color:#aaa">Verifica que Node.js esté corriendo en el puerto 3000.</small>
    </p>`;
  }
}

window.selectUser = async function(userId) {
  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.error) {
      showToast('⚠️ ' + data.error, 5000);
      console.error('selectUser error:', data.error);
      return;
    }
    STATE.me = data.user;
    enterApp();
  } catch (e) {
    showToast('❌ Error de conexión: ' + e.message, 5000);
    console.error('selectUser fetch error:', e);
  }
};

// ─── ENTRAR A LA APP ────────────────────────────────────────

function enterApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  myAvatarText.textContent   = initials(STATE.me.username);
  myAvatar.style.background  = avatarColor(STATE.me.username);
  myUsername.textContent     = STATE.me.username;

  connectSocket();
  loadContacts();
}

// Botón logout → volver a selección
$('btnLogout').addEventListener('click', () => {
  if (socket) { socket.disconnect(); socket = null; }
  STATE.me          = null;
  STATE.activeChat  = null;
  STATE.onlineUsers = new Set();
  STATE.unreadCounts= {};
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loadUserSelectList();
});

// ─── SOCKET.IO ─────────────────────────────────────────────

function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('✅ Socket conectado:', socket.id);
    socket.emit('register_user', { userId: STATE.me.id });
  });

  socket.on('user_online', ({ userId }) => {
    STATE.onlineUsers.add(userId);
    updateContactStatus(userId, true);
    if (STATE.activeChat === userId) setChatStatus(true);
  });

  socket.on('user_offline', ({ userId }) => {
    STATE.onlineUsers.delete(userId);
    updateContactStatus(userId, false);
    if (STATE.activeChat === userId) setChatStatus(false);
  });

  socket.on('receive_message', msg  => handleIncoming(msg));
  socket.on('pending_messages', ({ messages }) => messages.forEach(m => handleIncoming(m)));

  socket.on('message_delivered', ({ messageId }) => updateMessageStatus(messageId, 'delivered'));

  socket.on('messages_seen', ({ by }) => {
    if (STATE.activeChat === by) {
      document.querySelectorAll('.msg-wrapper.out .msg-check').forEach(el => {
        el.className = 'fa-solid fa-check-double msg-check seen';
        el.title = 'Visto';
      });
    }
  });

  socket.on('typing', ({ senderId, isTyping }) => {
    if (STATE.activeChat !== senderId) return;
    if (isTyping) {
      typingIndicator.classList.remove('hidden');
      typingText.textContent = 'escribiendo...';
    } else {
      typingIndicator.classList.add('hidden');
    }
  });

  socket.on('disconnect', () => showToast('🔌 Conexión perdida. Reconectando...'));
  socket.on('reconnect',  () => showToast('✅ Reconectado'));
}

// ─── CONTACTOS ─────────────────────────────────────────────

async function loadContacts() {
  try {
    const res  = await fetch('/api/auth/users');
    const data = await res.json();
    STATE.contacts = (data.users || []).filter(u => String(u.id) !== String(STATE.me.id));
    renderContactList(STATE.contacts);
  } catch (e) {
    console.error('loadContacts error:', e);
  }
}

function renderContactList(contacts) {
  if (!contacts.length) {
    chatList.innerHTML = `<div class="empty-list"><i class="fa-solid fa-comment-slash"></i><p>No hay contactos aún</p></div>`;
    return;
  }
  chatList.innerHTML = contacts.map(u => `
    <div class="chat-item" data-uid="${u.id}" onclick="openChat('${u.id}')">
      <div class="chat-item-avatar" style="background:${avatarColor(u.username)}">
        ${initials(u.username)}
        <div class="status-dot ${STATE.onlineUsers.has(u.id) ? 'online' : ''}"></div>
      </div>
      <div class="chat-item-info">
        <span class="chat-item-name">${u.username}</span>
        <span class="chat-item-preview" id="preview_${u.id}">Toca para chatear</span>
      </div>
      <div class="chat-item-meta">
        <span class="chat-item-time" id="time_${u.id}"></span>
        ${STATE.unreadCounts[u.id]
          ? `<span class="unread-badge" id="badge_${u.id}">${STATE.unreadCounts[u.id]}</span>`
          : `<span class="unread-badge hidden" id="badge_${u.id}">0</span>`}
      </div>
    </div>
  `).join('');
}

function updateContactStatus(userId, online) {
  const dot = document.querySelector(`[data-uid="${userId}"] .status-dot`);
  if (dot) dot.classList.toggle('online', online);
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  renderContactList(STATE.contacts.filter(u => u.username.includes(q)));
});

// ─── ABRIR CHAT ────────────────────────────────────────────

window.openChat = async function(userId) {
  STATE.activeChat = userId;
  const contact = STATE.contacts.find(u => String(u.id) === String(userId));
  if (!contact) return;

  STATE.unreadCounts[userId] = 0;
  const badge = $(`badge_${userId}`);
  if (badge) badge.classList.add('hidden');

  chatAvatarText.textContent  = initials(contact.username);
  chatAvatar.style.background = avatarColor(contact.username);
  chatUsername.textContent    = contact.username;
  setChatStatus(STATE.onlineUsers.has(userId));

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  const item = document.querySelector(`[data-uid="${userId}"]`);
  if (item) item.classList.add('active');

  welcomePanel.classList.add('hidden');
  chatPanel.classList.remove('hidden');
  document.querySelector('.sidebar').classList.add('hidden-mobile');

  messagesContainer.innerHTML = '';
  await loadHistory(userId);

  socket.emit('message_seen', { viewerId: STATE.me.id, senderId: userId });
  messageInput.focus();
};

function setChatStatus(online) {
  chatStatus.textContent = online ? 'en línea' : 'desconectado';
  chatStatus.className = 'chat-status' + (online ? '' : ' offline');
}

// ─── HISTORIAL ─────────────────────────────────────────────

async function loadHistory(userId) {
  try {
    const res  = await fetch(`/api/messages/${STATE.me.id}/${userId}`);
    const data = await res.json();
    const msgs = data.messages || [];

    let lastDate = '';
    for (const msg of msgs) {
      const d = fmtDate(msg.created_at);
      if (d !== lastDate) { appendDateSeparator(d); lastDate = d; }
      appendMessage({
        id:       msg.id,
        senderId: String(msg.sender_id),
        content:  msg.content || '',
        status:   msg.status || 'sent',
        time:     fmtTime(msg.created_at),
        isOwn:    String(msg.sender_id) === String(STATE.me.id)
      });
    }
    scrollBottom();
  } catch (e) {
    console.error('loadHistory error:', e);
  }
}

// ─── RENDERIZAR MENSAJE ────────────────────────────────────

function appendMessage({ id, senderId, content, status, time, isOwn, tempId, msgType }) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${isOwn ? 'out' : 'in'}`;
  if (id)     wrapper.dataset.msgId  = id;
  if (tempId) wrapper.dataset.tempId = tempId;

  let bubble = '';
  const type = msgType || 'text';

  if (type === 'imagen' || (type === 'texto' && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(content))) {
    bubble = `<img src="${escapeHtml(content)}" class="msg-media-img" onclick="window.open('${escapeHtml(content)}','_blank')" />`;
  } else if (type === 'video') {
    bubble = `<video src="${escapeHtml(content)}" class="msg-media-video" controls></video>`;
  } else if (type === 'audio') {
    bubble = `<audio src="${escapeHtml(content)}" class="msg-media-audio" controls></audio>`;
  } else if (type === 'documento') {
    const name = content.split('/').pop();
    bubble = `<a href="${escapeHtml(content)}" target="_blank" class="msg-file-link"><i class="fa-solid fa-file"></i> ${escapeHtml(name)}</a>`;
  } else {
    bubble = escapeHtml(content);
  }

  wrapper.innerHTML = `
    <div class="msg-bubble">${bubble}</div>
    <div class="msg-meta">
      <span class="msg-time">${time}</span>
      ${isOwn ? checkIcon(status) : ''}
    </div>
  `;
  messagesContainer.appendChild(wrapper);
  scrollBottom();
  return wrapper;
}

function appendDateSeparator(label) {
  const sep = document.createElement('div');
  sep.className = 'date-separator';
  sep.innerHTML = `<span>${label}</span>`;
  messagesContainer.appendChild(sep);
}

function scrollBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ─── ENVIAR MENSAJE ────────────────────────────────────────

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(); });

messageInput.addEventListener('input', () => {
  if (!STATE.activeChat || !socket) return;
  socket.emit('typing', { senderId: STATE.me.id, receiverId: STATE.activeChat, isTyping: true });
  clearTimeout(STATE.typingTimer);
  STATE.typingTimer = setTimeout(() => {
    socket.emit('typing', { senderId: STATE.me.id, receiverId: STATE.activeChat, isTyping: false });
  }, 1800);
});

function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !STATE.activeChat || !socket) return;

  const time   = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
  const tempId = 'tmp_' + Date.now();

  appendMessage({ senderId: STATE.me.id, content, status: 'sent', time, isOwn: true, tempId });
  messageInput.value = '';

  socket.emit('send_message', {
    senderId:   STATE.me.id,
    receiverId: STATE.activeChat,
    content
  });
  updateContactPreview(STATE.activeChat, content);
}

function updateContactPreview(userId, content) {
  const preview = $(`preview_${userId}`);
  const time    = $(`time_${userId}`);
  if (preview) preview.textContent = content.substring(0, 40);
  if (time)    time.textContent    = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
}

// ─── MENSAJES ENTRANTES ────────────────────────────────────

function handleIncoming(msg) {
  const senderId = msg.senderId || msg.sender_id;
  const msgType  = msg.msgType  || msg.msg_type || 'text';
  const isActive = String(STATE.activeChat) === String(senderId);

  if (isActive) {
    appendMessage({
      id:       msg.messageId || msg.id,
      senderId: String(senderId),
      content:  msg.content,
      status:   'delivered',
      time:     fmtTime(msg.createdAt || msg.created_at || new Date()),
      isOwn:    false,
      msgType                          // ← pasar el tipo
    });
    socket.emit('message_seen', { viewerId: STATE.me.id, senderId });
  } else {
    STATE.unreadCounts[senderId] = (STATE.unreadCounts[senderId] || 0) + 1;
    const badge = $(`badge_${senderId}`);
    if (badge) {
      badge.textContent = STATE.unreadCounts[senderId];
      badge.classList.remove('hidden');
    }
    showBrowserNotif(msg, senderId);
  }

  const preview = msgType === 'imagen' ? '📷 Imagen'
                : msgType === 'video'  ? '🎥 Video'
                : msgType === 'audio'  ? '🎵 Audio'
                : msgType === 'documento' ? '📎 Archivo'
                : msg.content;
  updateContactPreview(senderId, preview);
}

function showBrowserNotif(msg, senderId) {
  const contact = STATE.contacts.find(u => String(u.id) === String(senderId));
  if (!contact) return;
  if (Notification.permission === 'granted') {
    new Notification(`${contact.username} – ConneX`, { body: msg.content });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function updateMessageStatus(messageId, status) {
  const el = document.querySelector(`[data-msg-id="${messageId}"] .msg-check`);
  if (!el) return;
  if (status === 'delivered') {
    el.className = 'fa-solid fa-check-double msg-check delivered';
    el.title = 'Entregado';
  } else if (status === 'seen') {
    el.className = 'fa-solid fa-check-double msg-check seen';
    el.title = 'Visto';
  }
}

// ─── BOTÓN BACK (MÓVIL) ────────────────────────────────────

backBtn.addEventListener('click', () => {
  document.querySelector('.sidebar').classList.remove('hidden-mobile');
  chatPanel.classList.add('hidden');
  welcomePanel.classList.remove('hidden');
  STATE.activeChat = null;
});

// ─── MODAL ESTADOS ─────────────────────────────────────────

$('btnStories').addEventListener('click', openStoriesModal);
closeStories.addEventListener('click',   () => storiesModal.classList.add('hidden'));
storiesBackdrop.addEventListener('click',() => storiesModal.classList.add('hidden'));

function openStoriesModal() {
  storiesModal.classList.remove('hidden');
  loadStories();
}

storyContent.addEventListener('input', () => {
  storyPreviewText.textContent = storyContent.value || 'Vista previa';
  storyPreview.style.background = STATE.storyColor;
});

document.querySelectorAll('.color-dot').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    STATE.storyColor = btn.dataset.color;
    storyPreview.style.background = STATE.storyColor;
  });
});

publishStoryBtn.addEventListener('click', async () => {
  const content = storyContent.value.trim();
  if (!content && !storyImageUrl) { showToast('Escribe algo o agrega una imagen'); return; }
  try {
    const res  = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:   STATE.me.id,
        content:  content || '',
        bgColor:  STATE.storyColor,
        imageUrl: storyImageUrl || null
      })
    });
    const data = await res.json();
    if (data.error) { showToast('Error: ' + data.error); return; }
    storyContent.value = '';
    storyPreviewText.textContent = 'Vista previa';
    storyImageUrl = null;
    $('storyImageThumb').src = '';
    $('storyImagePreview').classList.add('hidden');
    showToast('✅ Estado publicado');
    loadStories();
  } catch (e) {
    showToast('❌ Error al publicar estado');
  }
});

async function loadStories() {
  storiesList.innerHTML = '<p class="loading-text">Cargando estados...</p>';
  try {
    const [activeRes, mineRes] = await Promise.all([
      fetch(`/api/stories?userId=${STATE.me.id}`),
      fetch(`/api/stories/mine?userId=${STATE.me.id}`)
    ]);
    const active = (await activeRes.json()).stories || [];
    const mine   = (await mineRes.json()).stories   || [];

    let html = '';
    if (mine.length) {
      html += `<div class="story-group-title">Mis estados</div>`;
      html += mine.map(s => storyItemHtml(s, true)).join('');
    }
    const others = active.filter(s => String(s.user_id) !== String(STATE.me.id));
    if (others.length) {
      html += `<div class="story-group-title">Recientes</div>`;
      html += others.map(s => storyItemHtml(s, false)).join('');
    }
    if (!html) html = '<p class="loading-text">No hay estados activos</p>';
    storiesList.innerHTML = html;
  } catch (e) {
    storiesList.innerHTML = '<p class="loading-text">Error cargando estados</p>';
  }
}

function storyItemHtml(s, isMine) {
  const seen   = s.viewed_by_me ? 'seen' : '';
  const time   = fmtTime(s.created_at);
  const action = isMine
    ? `<button class="icon-btn" onclick="deleteStory('${s.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`
    : `<button class="icon-btn" onclick="muteStory('${s.user_id}')" title="Silenciar"><i class="fa-solid fa-bell-slash"></i></button>`;

  // thumbnail: imagen si hay, si no color de fondo con iniciales
  const thumb = s.image_url
    ? `<div class="story-ring ${seen}" style="background-image:url('${s.image_url}');background-size:cover;background-position:center"></div>`
    : `<div class="story-ring ${seen}" style="background:${s.bg_color}">${initials(s.username)}</div>`;

  return `
    <div class="story-item" onclick="viewStory('${s.id}','${escapeHtml(s.username||'')}','${escapeHtml(s.content||'')}','${s.bg_color}','${s.image_url||''}','${time}',${s.view_count||0})">
      ${thumb}
      <div class="story-info">
        <strong>${escapeHtml(s.username||'')}</strong>
        <small>${time} · ${s.view_count||0} vista(s)</small>
      </div>
      <div class="story-actions" onclick="event.stopPropagation()">${action}</div>
    </div>
  `;
}

window.viewStory = async function(id, username, content, bgColor, imageUrl, time, views) {
  storyViewModal.classList.remove('hidden');

  // Fondo: imagen si hay, si no color
  if (imageUrl) {
    storyViewContent.parentElement.style.background = `url('${imageUrl}') center/cover no-repeat`;
  } else {
    storyViewContent.parentElement.style.background = bgColor;
  }

  // Mostrar imagen grande + texto
  storyViewContent.innerHTML = imageUrl
    ? `<img src="${imageUrl}" style="max-width:100%;max-height:60vh;border-radius:12px;display:block;margin:0 auto 12px" />
       ${content ? `<p style="text-align:center;color:#fff;font-size:1.1rem;text-shadow:0 1px 4px rgba(0,0,0,.6)">${escapeHtml(content)}</p>` : ''}`
    : escapeHtml(content);

  storyViewUsername.textContent = username;
  storyViewTime.textContent     = time;
  storyViewAvatar.textContent   = initials(username);
  viewCount.textContent         = views;
  storyProgressFill.style.width = '0%';
  requestAnimationFrame(() => { storyProgressFill.style.width = '100%'; });

  try {
    await fetch(`/api/stories/${id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId: STATE.me.id })
    });
  } catch(e) {}
};
closeStoryView.addEventListener('click',   () => storyViewModal.classList.add('hidden'));
storyViewBackdrop.addEventListener('click',() => storyViewModal.classList.add('hidden'));

window.deleteStory = async function(id) {
  if (!confirm('¿Eliminar este estado?')) return;
  try {
    await fetch(`/api/stories/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: STATE.me.id })
    });
    showToast('Estado eliminado');
    loadStories();
  } catch (e) { showToast('Error al eliminar'); }
};

window.muteStory = async function(mutedId) {
  try {
    const res  = await fetch('/api/stories/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muterId: STATE.me.id, mutedId })
    });
    const data = await res.json();
    showToast(data.muted ? '🔕 Usuario silenciado' : '🔔 Usuario des-silenciado');
    loadStories();
  } catch (e) { showToast('Error'); }
};

// ─── MODAL ADMIN ───────────────────────────────────────────

$('btnAdmin').addEventListener('click', openAdminModal);
closeAdmin.addEventListener('click',   () => adminModal.classList.add('hidden'));
adminBackdrop.addEventListener('click',() => adminModal.classList.add('hidden'));

async function openAdminModal() {
  adminModal.classList.remove('hidden');
  statUsers.textContent = statMessages.textContent = statOnline.textContent = '…';
  try {
    const res  = await fetch('/api/admin/stats');
    const data = await res.json();
    statUsers.textContent    = data.totalUsers;
    statMessages.textContent = data.totalMessages;
    statOnline.textContent   = data.connectedUsers;
    renderAdminChart(data.perDay || []);
  } catch (e) { showToast('Error cargando estadísticas'); }
}

function renderAdminChart(perDay) {
  const ctx = $('messagesChart').getContext('2d');
  if (STATE.chartInstance) STATE.chartInstance.destroy();
  STATE.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: perDay.map(r => r.day),
      datasets: [{
        label: 'Mensajes',
        data: perDay.map(r => r.total),
        backgroundColor: 'rgba(37,211,102,.5)',
        borderColor: '#25D366',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#8696A0' } } },
      scales: {
        x: { ticks: { color: '#8696A0' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#8696A0' }, grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true }
      }
    }
  });
}
// ─── EMOJI PICKER ──────────────────────────────────────────

const emojiBtn     = $('emojiBtn');
const emojiPicker  = $('emojiPicker');

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
    emojiPicker.classList.add('hidden');
  }
});

// ─── ADJUNTAR ARCHIVOS EN MENSAJES ─────────────────────────

const attachBtn = $('attachBtn');
const fileInput = $('fileInput');

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file || !STATE.activeChat) return;
  fileInput.value = '';

  const formData = new FormData();
  formData.append('file', file);

  showToast('⏫ Subiendo archivo...');
  try {
    const res  = await fetch('/api/upload?type=message', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) { showToast('❌ ' + data.error); return; }

    // Determinar tipo
    const mime = data.mime || '';
    let msgType = 'documento';
    if (mime.startsWith('image/'))  msgType = 'imagen';
    else if (mime.startsWith('video/')) msgType = 'video';
    else if (mime.startsWith('audio/')) msgType = 'audio';

    const time   = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
    const tempId = 'tmp_' + Date.now();

    appendMessage({ senderId: STATE.me.id, content: data.url, status: 'sent', time, isOwn: true, tempId, msgType });

    socket.emit('send_message', {
      senderId:   STATE.me.id,
      receiverId: STATE.activeChat,
      content:    data.url,
      msgType
    });
    updateContactPreview(STATE.activeChat, `📎 ${data.name}`);
    showToast('✅ Archivo enviado');
  } catch (e) {
    showToast('❌ Error al subir archivo');
  }
});

// ─── IMAGEN EN ESTADOS ─────────────────────────────────────

let storyImageUrl = null;

$('storyImageInput').addEventListener('change', async () => {
  const file = $('storyImageInput').files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  showToast('⏫ Subiendo imagen...');
  try {
    const res  = await fetch('/api/upload?type=story', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) { showToast('❌ ' + data.error); return; }

    storyImageUrl = data.url;
    $('storyImageThumb').src = data.url;
    $('storyImagePreview').classList.remove('hidden');
    showToast('✅ Imagen lista');
  } catch (e) {
    showToast('❌ Error al subir imagen');
  }
});

$('removeStoryImage').addEventListener('click', () => {
  storyImageUrl = null;
  $('storyImageInput').value = '';
  $('storyImageThumb').src   = '';
  $('storyImagePreview').classList.add('hidden');
});

// ─── INIT ──────────────────────────────────────────────────

window.addEventListener('load', () => {
  loadUserSelectList();
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});
