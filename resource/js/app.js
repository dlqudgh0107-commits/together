import {
  auth, onAuthStateChanged,
  signInWithGoogle, signOutUser,
  createGroup, generateNewInviteCode, joinGroupByCode, getUserGroups, getGroupData, getGroupMembers,
  addSchedule, updateSchedule, deleteSchedule, listenSchedules,
  addTodo, updateTodo, deleteTodo, toggleTodo, listenTodos,
  listenActivities
} from './firebase.js';
import { getAISummary } from './ai.js';

// ===== 상태 =====
let currentUser = null;
let currentGroup = null;
let currentMembers = [];
let allSchedules = [];
let allTodos = [];
let activeTab = 'home';
let filterMemberId = 'all';
let unsubSchedules = null;
let unsubTodos = null;
let unsubActivities = null;

// ===== 프로필 아이콘 목록 =====
const ICONS = ['😊','😎','🥳','🤩','😇','🦁','🐯','🦊','🐻','🐼','🐨','🐸','🐙','🦋','🌸','⭐','🔥','💎','🎯','🎸'];
const COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#4dabf7','#cc5de8','#f783ac','#a9e34b','#38d9a9','#74c0fc'];

// ===== 화면 전환 =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ===== 로딩 =====
function hideLoading() {
  const el = document.querySelector('.loading-screen');
  if (el) { el.classList.add('hide'); setTimeout(() => el.style.display = 'none', 300); }
}

// ===== 날짜 포맷 =====
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
function isToday(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return d.getTime() === today.getTime();
}
function isFutureOrToday(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(dateStr + 'T00:00:00') >= today;
}
function timeAgo(ts) {
  if (!ts) return '';
  const now = Date.now();
  const t = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}

// ===== 멤버바 렌더 =====
function renderMemberBar() {
  const bars = document.querySelectorAll('[data-member-bar]');
  if (bars.length === 0) return;

  const html = `
    <div class="member-chip member-chip--all" data-member-id="all">
      <div class="member-chip__avatar ${filterMemberId === 'all' ? 'active' : ''}">전체</div>
      <span class="member-chip__name">전체</span>
    </div>
    ${currentMembers.map(m => `
      <div class="member-chip" data-member-id="${m.id}">
        <div class="member-chip__avatar ${filterMemberId === m.id ? 'active' : ''}" style="background:${m.color}20; border-color:${filterMemberId === m.id ? m.color : 'transparent'}">
          <span>${m.icon}</span>
        </div>
        <span class="member-chip__name">${m.nickname}</span>
      </div>
    `).join('')}
  `;

  bars.forEach(bar => {
    bar.innerHTML = html;
    bar.querySelectorAll('.member-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filterMemberId = chip.dataset.memberId;
        renderMemberBar();
        renderScheduleList();
      });
    });
  });
}

// ===== 일정 리스트 렌더 =====
function renderScheduleList() {
  const containers = document.querySelectorAll('[data-schedule-list]');
  if (containers.length === 0) return;

  const filtered = allSchedules.filter(s => {
    const startDate = s.startDate || s.date;
    if (!isFutureOrToday(startDate)) return false;
    if (filterMemberId !== 'all' && !(s.memberIds || []).includes(filterMemberId)) return false;
    return true;
  });

  const html = filtered.length === 0
    ? '<div class="empty-state">등록된 일정이 없어요 🗓</div>'
    : (() => {
      const grouped = {};
      filtered.forEach(s => {
        const startDate = s.startDate || s.date;
        if (!grouped[startDate]) grouped[startDate] = [];
        grouped[startDate].push(s);
      });
      return Object.keys(grouped).sort().map(date => `
        <div class="date-label">
          ${formatDate(date)}
          ${isToday(date) ? '<span class="date-label__today">오늘</span>' : ''}
        </div>
        ${grouped[date].map(s => {
          const member = currentMembers.find(m => (s.memberIds||[]).includes(m.id));
          const color = member ? member.color : '#1677ff';
          const startDate = s.startDate || s.date;
          const endDate = s.endDate;
          const dateRange = startDate === endDate ? '' : ` ~ ${formatDate(endDate)}`;
          const timeDisplay = s.startTime && s.endTime ? `${s.startTime} ~ ${s.endTime}` : s.startTime ? s.startTime : '';
          return `
            <div class="schedule-card" data-schedule-id="${s.id}" style="margin: 0 20px 8px;">
              <div class="schedule-card__dot" style="background:${color}"></div>
              <div class="schedule-card__body">
                <div class="schedule-card__title">${s.title}</div>
                <div class="schedule-card__meta">
                  ${timeDisplay ? `<span>🕐 ${timeDisplay}</span>` : ''}
                  ${member ? `<span class="schedule-card__member">
                    <span class="schedule-card__member-dot" style="background:${member.color}20">${member.icon}</span>
                    ${member.nickname}
                  </span>` : '<span>전체</span>'}
                </div>
              </div>
              <span class="schedule-card__arrow">›</span>
            </div>
          `;
        }).join('')}
      `).join('');
    })();

  containers.forEach(container => {
    container.innerHTML = html;
    container.querySelectorAll('.schedule-card').forEach(card => {
      card.addEventListener('click', () => openScheduleDetail(card.dataset.scheduleId));
    });
  });
}

// ===== Todo 렌더 =====
function renderTodoList() {
  const containers = document.querySelectorAll('[data-todo-list]');
  if (containers.length === 0) return;

  const filtered = filterMemberId === 'all'
    ? allTodos
    : allTodos.filter(t => t.assigneeId === filterMemberId);

  const html = filtered.length === 0
    ? '<div class="empty-state">할 일이 없어요 ✅</div>'
    : filtered.map(t => {
      const member = currentMembers.find(m => m.id === t.assigneeId);
      const isDone = t.status === 'done';
      const timeDisplay = t.startTime && t.endTime ? `${t.startTime} ~ ${t.endTime}` : t.startTime ? t.startTime : '';
      const dueDateStr = t.dueDate ? new Date(t.dueDate + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      return `
        <div class="todo-card" data-todo-id="${t.id}" style="margin: 0 20px 8px; padding: 16px; background: #ffffff; border-radius: 8px; display: flex; gap: 12px; align-items: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,0.06); cursor: pointer;">
          <div class="todo-card__check ${isDone ? 'done' : ''}" style="width: 24px; height: 24px; border: 2px solid #d9d9d9; border-radius: 50%; flex-shrink: 0; ${isDone ? 'background: #52c41a; border-color: #52c41a;' : ''}"></div>
          <div class="todo-card__body" style="flex: 1; min-width: 0;">
            <div class="todo-card__title ${isDone ? 'done' : ''}" style="font-weight: 500; color: #000000e0; ${isDone ? 'text-decoration: line-through; color: #00000073;' : ''}">${t.title}</div>
            <div class="todo-card__assignee" style="font-size: 13px; color: #00000073; margin-top: 4px;">
              ${member ? `${member.icon} ${member.nickname}` : '담당자 없음'}
              ${dueDateStr ? ` · 📅 ${dueDateStr}` : ''}
              ${timeDisplay ? ` · 🕐 ${timeDisplay}` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

  containers.forEach(container => {
    container.innerHTML = html;

    container.querySelectorAll('.todo-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const check = card.querySelector('.todo-card__check');
        if (e.target === check) {
          const todoId = card.dataset.todoId;
          const todo = allTodos.find(t => t.id === todoId);
          if (todo) {
            toggleTodo(currentGroup.id, todoId, todo.status, todo.title, currentUser.uid, getMemberNickname());
          }
        } else {
          openTodoDetail(card.dataset.todoId);
        }
      });
    });
  });
}

// ===== Feed 렌더 =====
function renderFeed(activities) {
  const container = document.querySelector('[data-feed-list]');
  if (!container) return;
  if (!activities.length) {
    container.innerHTML = '<div class="empty-state">아직 활동이 없어요 📋</div>';
    return;
  }
  container.innerHTML = activities.slice(0, 50).map(a => {
    const member = currentMembers.find(m => m.id === a.userId);
    const icon = member ? member.icon : '👤';
    const color = member ? member.color : '#d9d9d9';
    return `
      <div class="feed-item">
        <div class="feed-item__avatar" style="background:${color}20">${icon}</div>
        <div class="feed-item__body">
          <div class="feed-item__header">
            <span class="feed-item__name">${a.nickname || '멤버'}</span>
            <span class="feed-item__time">${timeAgo(a.createdAt)}</span>
          </div>
          <div class="feed-item__message">${a.message}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== AI 요약 =====
async function loadAISummary() {
  const card = document.querySelector('[data-ai-card]');
  if (!card) return;
  card.innerHTML = `<div class="ai-card__label">AI 요약</div>
    <div class="ai-card__loading">
      <div class="ai-card__loading-dot"></div>
      <div class="ai-card__loading-dot"></div>
      <div class="ai-card__loading-dot"></div>
    </div>`;
  try {
    const summary = await getAISummary(allSchedules, allTodos, currentMembers);
    card.innerHTML = `<div class="ai-card__label">✨ AI 요약</div><div class="ai-card__text">${summary}</div>`;
  } catch(e) {
    card.innerHTML = `<div class="ai-card__label">AI 요약</div><div class="ai-card__text">요약을 불러올 수 없어요.</div>`;
  }
}

// ===== 홈 렌더 =====
function renderHome() {
  renderMemberBar();
  renderScheduleList();
  renderTodoList();
}

// ===== 유틸 =====
function getMemberNickname() {
  const m = currentMembers.find(m => m.id === currentUser.uid);
  return m ? m.nickname : currentUser.displayName;
}

// ===== 일정 상세 모달 =====
function openScheduleDetail(scheduleId) {
  const s = allSchedules.find(s => s.id === scheduleId);
  if (!s) return;
  const member = currentMembers.find(m => (s.memberIds||[]).includes(m.id));
  const overlay = document.querySelector('[data-modal="schedule-detail"]');
  overlay.querySelector('.modal__title').textContent = s.title;

  const startDate = s.startDate || s.date;
  const endDate = s.endDate;
  let dateStr = formatDate(startDate);
  if (endDate && startDate !== endDate) {
    dateStr += ` ~ ${formatDate(endDate)}`;
  }
  if (s.startTime && s.endTime) {
    dateStr += ` ${s.startTime} ~ ${s.endTime}`;
  } else if (s.startTime) {
    dateStr += ` ${s.startTime}`;
  } else if (s.time) {
    dateStr += ` ${s.time}`;
  }

  overlay.querySelector('[data-detail-date]').textContent = dateStr;
  overlay.querySelector('[data-detail-member]').textContent = member ? `${member.icon} ${member.nickname}` : '전체';
  overlay.querySelector('[data-detail-memo]').textContent = s.memo || '메모 없음';
  overlay.querySelector('[data-detail-edit]').onclick = () => { overlay.classList.remove('active'); openScheduleForm(s); };
  overlay.querySelector('[data-detail-delete]').onclick = async () => {
    if (confirm('일정을 삭제할까요?')) {
      await deleteSchedule(currentGroup.id, scheduleId, s.title, currentUser.uid, getMemberNickname());
      overlay.classList.remove('active');
    }
  };
  overlay.classList.add('active');
}

// ===== 일정 등록/수정 모달 =====
function openScheduleForm(existing = null) {
  const overlay = document.querySelector('[data-modal="schedule-form"]');
  const form = overlay.querySelector('[data-schedule-form]');
  overlay.querySelector('.modal__title').textContent = existing ? '일정 수정' : '일정 등록';
  const today = new Date().toISOString().split('T')[0];

  const startDate = existing?.startDate || existing?.date || today;
  form.querySelector('[data-field="startDate"]').value = startDate;
  form.querySelector('[data-field="startTime"]').value = existing?.startTime || existing?.time || '';
  form.querySelector('[data-field="endDate"]').value = existing?.endDate || '';
  form.querySelector('[data-field="endTime"]').value = existing?.endTime || '';
  form.querySelector('[data-field="title"]').value = existing?.title || '';
  form.querySelector('[data-field="memo"]').value = existing?.memo || '';

  // 멤버 선택
  const memberSelect = form.querySelector('[data-field="member"]');
  memberSelect.innerHTML = `<option value="">전체</option>` + currentMembers.map(m => `<option value="${m.id}" ${existing?.memberIds?.includes(m.id) ? 'selected' : ''}>${m.icon} ${m.nickname}</option>`).join('');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const title = form.querySelector('[data-field="title"]').value.trim();
    const startDate = form.querySelector('[data-field="startDate"]').value;
    const startTime = form.querySelector('[data-field="startTime"]').value;
    const endDate = form.querySelector('[data-field="endDate"]').value;
    const endTime = form.querySelector('[data-field="endTime"]').value;
    const memo = form.querySelector('[data-field="memo"]').value.trim();
    const memberId = form.querySelector('[data-field="member"]').value;
    if (!title || !startDate) return;
    const data = { title, startDate, startTime, endDate, endTime, memo, memberIds: memberId ? [memberId] : [], date: startDate, time: startTime };
    if (existing) {
      await updateSchedule(currentGroup.id, existing.id, data, currentUser.uid, getMemberNickname());
    } else {
      await addSchedule(currentGroup.id, data, currentUser.uid, getMemberNickname());
    }
    overlay.classList.remove('active');
  };
  overlay.classList.add('active');
}

// ===== 할일 상세 모달 =====
function openTodoDetail(todoId) {
  const t = allTodos.find(t => t.id === todoId);
  if (!t) return;
  const member = currentMembers.find(m => m.id === t.assigneeId);
  const overlay = document.querySelector('[data-modal="todo-detail"]');
  overlay.querySelector('.modal__title').textContent = t.title;

  let dateStr = '';
  if (t.startDate) {
    dateStr = new Date(t.startDate + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (t.dueDate && t.startDate !== t.dueDate) {
    dateStr += ` ~ ${new Date(t.dueDate + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  } else if (t.dueDate && !t.startDate) {
    dateStr = new Date(t.dueDate + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  if (t.startTime && t.endTime) {
    dateStr += ` ${t.startTime} ~ ${t.endTime}`;
  } else if (t.startTime) {
    dateStr += ` ${t.startTime}`;
  } else if (t.endTime) {
    dateStr += ` ~ ${t.endTime}`;
  }

  overlay.querySelector('[data-todo-detail-date]').textContent = dateStr || '날짜 없음';
  overlay.querySelector('[data-todo-detail-assignee]').textContent = member ? `${member.icon} ${member.nickname}` : '담당자 없음';
  overlay.querySelector('[data-todo-detail-edit]').onclick = () => { overlay.classList.remove('active'); openTodoForm(t); };
  overlay.querySelector('[data-todo-detail-delete]').onclick = async () => {
    if (confirm('할 일을 삭제할까요?')) {
      await deleteTodo(currentGroup.id, todoId, t.title, currentUser.uid, getMemberNickname());
      overlay.classList.remove('active');
    }
  };
  overlay.classList.add('active');
}

// ===== Todo 등록/수정 모달 =====
function openTodoForm(existing = null) {
  const overlay = document.querySelector('[data-modal="todo-form"]');
  const form = overlay.querySelector('[data-todo-form]');
  overlay.querySelector('.modal__title').textContent = existing ? '할 일 수정' : '할 일 추가';

  form.querySelector('[data-field="title"]').value = existing?.title || '';
  form.querySelector('[data-field="startDate"]').value = existing?.startDate || '';
  form.querySelector('[data-field="startTime"]').value = existing?.startTime || '';
  form.querySelector('[data-field="dueDate"]').value = existing?.dueDate || '';
  form.querySelector('[data-field="endTime"]').value = existing?.endTime || '';

  const memberSelect = form.querySelector('[data-field="assignee"]');
  memberSelect.innerHTML = `<option value="">담당자 없음</option>` + currentMembers.map(m => `<option value="${m.id}" ${existing?.assigneeId === m.id ? 'selected' : ''}>${m.icon} ${m.nickname}</option>`).join('');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const title = form.querySelector('[data-field="title"]').value.trim();
    const startDate = form.querySelector('[data-field="startDate"]').value;
    const startTime = form.querySelector('[data-field="startTime"]').value;
    const dueDate = form.querySelector('[data-field="dueDate"]').value;
    const endTime = form.querySelector('[data-field="endTime"]').value;
    const assigneeId = form.querySelector('[data-field="assignee"]').value;
    if (!title) return;
    const data = { title, startDate, startTime, dueDate, endTime, assigneeId };
    if (existing) {
      await updateTodo(currentGroup.id, existing.id, data, currentUser.uid, getMemberNickname());
    } else {
      await addTodo(currentGroup.id, data, currentUser.uid, getMemberNickname());
    }
    overlay.classList.remove('active');
  };
  overlay.classList.add('active');
}

// ===== 그룹 로드 =====
async function loadGroup(groupId, groupName, groupType) {
  try {
    const groupData = await getGroupData(groupId);
    currentGroup = { id: groupId, name: groupName, type: groupType, inviteCode: groupData.activeInviteCode?.code || 'N/A' };
  } catch (err) {
    currentGroup = { id: groupId, name: groupName, type: groupType, inviteCode: 'N/A' };
  }
  localStorage.setItem('lastGroupId', groupId);
  localStorage.setItem('lastGroupName', groupName);
  localStorage.setItem('lastGroupType', groupType);

  currentMembers = await getGroupMembers(groupId);

  document.querySelector('[data-group-name]').textContent = groupName;
  const avatar = document.querySelector('[data-user-avatar]');
  if (currentUser.photoURL) avatar.src = currentUser.photoURL;

  // 리스너 정리
  if (unsubSchedules) unsubSchedules();
  if (unsubTodos) unsubTodos();
  if (unsubActivities) unsubActivities();

  unsubSchedules = listenSchedules(groupId, (items) => { allSchedules = items; renderScheduleList(); });
  unsubTodos = listenTodos(groupId, (items) => { allTodos = items; renderTodoList(); });
  unsubActivities = listenActivities(groupId, (items) => { renderFeed(items); });

  showScreen('screen-home');
  renderMemberBar();
  renderScheduleList();
  renderTodoList();
  setTimeout(() => loadAISummary(), 500);
}

// ===== 탭 전환 =====
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.bottom-nav__item[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('[data-tab-content]').forEach(el => {
    el.style.display = el.dataset.tabContent === tab ? 'block' : 'none';
  });
  if (tab === 'home') renderMemberBar(), renderScheduleList(), renderTodoList();
}

// ===== 앱 초기화 =====
function initApp() {
  // 로그인 버튼
  document.querySelector('[data-google-login]')?.addEventListener('click', async () => {
    try { await signInWithGoogle(); } catch(e) { alert('로그인에 실패했어요. 다시 시도해주세요.'); }
  });

  // FAB
  document.querySelector('[data-fab]')?.addEventListener('click', () => {
    const overlay = document.querySelector('[data-modal="fab-menu"]');
    overlay?.classList.toggle('active');
  });
  document.querySelector('[data-fab-schedule]')?.addEventListener('click', () => {
    document.querySelector('[data-modal="fab-menu"]')?.classList.remove('active');
    openScheduleForm();
  });
  document.querySelector('[data-fab-todo]')?.addEventListener('click', () => {
    document.querySelector('[data-modal="fab-menu"]')?.classList.remove('active');
    openTodoForm();
  });

  // 탭 네비
  document.querySelectorAll('.bottom-nav__item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 모달 닫기
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('[data-modal]');
      if (modal && modal.dataset.modal === 'group-list') {
        modal.style.display = 'none';
      } else {
        btn.closest('.modal-overlay')?.classList.remove('active');
      }
    });
  });

  // 그룹 생성/참여/초대 탭
  const groupTabBtns = document.querySelectorAll('[data-group-tab]');
  groupTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      groupTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('[data-group-panel]').forEach(p => p.style.display = 'none');
      const panel = document.querySelector(`[data-group-panel="${btn.dataset.groupTab}"]`);
      if (panel) panel.style.display = 'block';
    });
  });

  // 초대 코드 복사
  document.querySelector('[data-copy-invite]')?.addEventListener('click', async () => {
    const codeEl = document.querySelector('[data-invite-code]');
    const code = codeEl?.textContent || '';
    if (code) {
      await navigator.clipboard.writeText(code);
      const btn = document.querySelector('[data-copy-invite]');
      const originalText = btn.textContent;
      btn.textContent = '✓ 복사됨!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });

  // 새 초대 코드 생성
  document.querySelector('[data-new-invite-code]')?.addEventListener('click', async () => {
    if (!currentGroup || !currentGroup.id) return;
    try {
      const newCode = await generateNewInviteCode(currentGroup.id);
      currentGroup.inviteCode = newCode;
      document.querySelector('[data-invite-code]').textContent = newCode;
      const btn = document.querySelector('[data-new-invite-code]');
      const originalText = btn.textContent;
      btn.textContent = '✓ 새 코드 생성됨!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    } catch (err) {
      alert('새 코드 생성에 실패했어요.');
    }
  });

  // 그룹 유형 선택
  document.querySelectorAll('[data-type-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-type-btn]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 프로필 아이콘 선택
  document.querySelectorAll('[data-icon-grid]').forEach(grid => {
    grid.innerHTML = ICONS.map((icon, i) => `<div class="icon-option ${i===0?'active':''}" data-icon="${icon}">${icon}</div>`).join('');
    grid.querySelectorAll('.icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
        grid.querySelectorAll('.icon-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  });

  // 그룹 만들기
  document.querySelector('[data-create-group]')?.addEventListener('click', async () => {
    const name = document.querySelector('[data-field="group-name"]').value.trim();
    const nickname = document.querySelector('[data-field="create-nickname"]').value.trim();
    const typeBtn = document.querySelector('[data-type-btn].active');
    const iconEl = document.querySelector('[data-icon-grid="create"] .icon-option.active');
    if (!name || !nickname) { alert('그룹명과 닉네임을 입력해주세요.'); return; }
    const type = typeBtn ? typeBtn.dataset.typeBtn : 'family';
    const icon = iconEl ? iconEl.dataset.icon : '😊';
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    try {
      const groupId = await createGroup(name, type, currentUser.uid, nickname, icon, color);
      await loadGroup(groupId, name, type);
    } catch(e) { alert('그룹 생성에 실패했어요.'); }
  });

  // 그룹 참여
  document.querySelector('[data-join-group]')?.addEventListener('click', async () => {
    const code = document.querySelector('[data-field="invite-code"]').value.trim();
    const nickname = document.querySelector('[data-field="join-nickname"]').value.trim();
    const iconEl = document.querySelector('[data-icon-grid="join"] .icon-option.active');
    if (!code || !nickname) { alert('초대 코드와 닉네임을 입력해주세요.'); return; }
    const icon = iconEl ? iconEl.dataset.icon : '😊';
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    try {
      const groupId = await joinGroupByCode(code, currentUser.uid, nickname, icon, color);
      const groups = await getUserGroups(currentUser.uid);
      const g = groups.find(g => g.id === groupId);
      await loadGroup(groupId, g?.name || '그룹', g?.type || 'team');
    } catch(e) { alert(e.message || '참여에 실패했어요.'); }
  });

  // AI 카드 클릭 새로고침
  document.querySelector('[data-ai-card]')?.addEventListener('click', loadAISummary);

  // 그룹 목록 표시
  const showGroupListModal = async () => {
    const groups = await getUserGroups(currentUser.uid);
    const listEl = document.querySelector('[data-group-list]');
    listEl.innerHTML = groups.map(g => `
      <div data-group-item="${g.id}" style="padding: 14px 16px; background: #f5f5f5; border-radius: 10px; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#e8e8e8'" onmouseout="this.style.background='#f5f5f5'">
        <div style="font-weight: 600; color: #000000e0;">${g.name}</div>
        <div style="font-size: 12px; color: #00000073; margin-top: 4px;">${g.type === 'family' ? '가족' : g.type === 'company' ? '회사' : g.type === 'project' ? '프로젝트' : g.type === 'study' ? '스터디' : g.type === 'couple' ? '커플' : '동호회'}</div>
        ${currentGroup && currentGroup.id === g.id ? '<div style="font-size: 11px; color: #1677ff; margin-top: 6px; font-weight: 600;">✓ 현재 그룹</div>' : ''}
      </div>
    `).join('');

    groups.forEach(g => {
      document.querySelector(`[data-group-item="${g.id}"]`)?.addEventListener('click', async () => {
        await loadGroup(g.id, g.name, g.type);
        document.querySelector('[data-modal="group-list"]').style.display = 'none';
      });
    });

    document.querySelector('[data-modal="group-list"]').style.display = 'flex';
  };

  // 그룹 변경/추가
  const showGroupScreen = () => {
    showScreen('screen-group');
    const backBtn = document.querySelector('[data-back-to-home]');
    // 현재 그룹이 있으면 초대 코드 표시 + 돌아가기 버튼 표시
    if (currentGroup && currentGroup.id) {
      document.querySelector('[data-invite-code]').textContent = currentGroup.inviteCode || 'N/A';
      backBtn.style.display = 'block';
    } else {
      backBtn.style.display = 'none';
    }
  };

  // 시작하기 화면 돌아가기 버튼
  document.querySelector('[data-back-to-home]')?.addEventListener('click', () => {
    showScreen('screen-home');
  });

  document.querySelector('[data-group-switch]')?.addEventListener('click', showGroupListModal);
  document.querySelector('[data-add-group]')?.addEventListener('click', showGroupScreen);
  document.querySelector('[data-group-add-new]')?.addEventListener('click', () => {
    document.querySelector('[data-modal="group-list"]').style.display = 'none';
    showGroupScreen();
  });

  // 로그아웃
  document.querySelector('[data-signout]')?.addEventListener('click', async () => {
    if (confirm('로그아웃 할까요?')) {
      localStorage.removeItem('lastGroupId');
      await signOutUser();
    }
  });

  // Auth 상태 감지
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const savedGroupId = localStorage.getItem('lastGroupId');
      const savedGroupName = localStorage.getItem('lastGroupName');
      const savedGroupType = localStorage.getItem('lastGroupType');
      if (savedGroupId) {
        await loadGroup(savedGroupId, savedGroupName || '그룹', savedGroupType || 'team');
      } else {
        const groups = await getUserGroups(user.uid);
        if (groups.length > 0) {
          const g = groups[0];
          await loadGroup(g.id, g.name, g.type);
        } else {
          showScreen('screen-group');
          document.querySelector('[data-icon-grid="create"]') && initApp._iconsDone !== true && (() => {
            initApp._iconsDone = true;
          })();
        }
      }
    } else {
      currentUser = null;
      currentGroup = null;
      showScreen('screen-login');
    }
    hideLoading();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
