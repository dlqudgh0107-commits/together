// ===== Global State =====
let currentUser = null;
let currentGroup = null;
let currentGroupData = null;
let schedules = [];
let todos = [];
let members = [];
let activeTab = 'home';
let scheduleUnsubscribe = null;
let todoUnsubscribe = null;
let editingScheduleId = null;
let editingTodoId = null;

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

const initializeApp = async () => {
  currentUser = await getCurrentUser();

  if (currentUser) {
    // User logged in - show group selection or app
    await updateUserProfile(currentUser.uid, {
      name: currentUser.displayName,
      email: currentUser.email,
      photoURL: currentUser.photoURL,
      lastLogin: new Date()
    });

    const groups = await getUserGroups(currentUser.uid);
    if (groups.length > 0) {
      selectGroup(groups[0]);
    } else {
      showScreen('screen-group');
      await loadGroupList();
    }
  } else {
    showScreen('screen-login');
  }

  setupEventListeners();
};

// ===== Screen Management =====
const showScreen = (screenId) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen--active'));
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('screen--active');
  }
};

// ===== Event Listeners Setup =====
const setupEventListeners = () => {
  // Login
  document.getElementById('login-btn')?.addEventListener('click', handleLogin);

  // Group
  document.querySelector('[data-switch-group]')?.addEventListener('click', () => {
    showScreen('screen-group');
    loadGroupList();
  });
  document.getElementById('create-group-btn')?.addEventListener('click', openCreateGroupForm);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Tabs
  document.querySelectorAll('.app-tabs__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // Add Schedule/Todo buttons
  document.getElementById('add-schedule-btn')?.addEventListener('click', () => openScheduleForm());
  document.getElementById('schedule-add-btn')?.addEventListener('click', () => openScheduleForm());
  document.getElementById('add-todo-btn')?.addEventListener('click', () => openTodoForm());
  document.getElementById('todo-add-btn')?.addEventListener('click', () => openTodoForm());

  // Forms
  document.getElementById('schedule-form')?.addEventListener('submit', handleScheduleFormSubmit);
  document.getElementById('todo-form')?.addEventListener('submit', handleTodoFormSubmit);

  // Copy invite code
  document.getElementById('copy-invite-btn')?.addEventListener('click', copyInviteCode);

  // Modal close buttons
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      closeModal(modal);
    });
  });

  // Close modal on background click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // Detail modal buttons
  document.getElementById('schedule-edit-btn')?.addEventListener('click', () => {
    closeModal(document.getElementById('modal-schedule-detail'));
    openScheduleForm(editingScheduleId);
  });

  document.getElementById('schedule-delete-btn')?.addEventListener('click', () => {
    if (confirm('일정을 삭제하시겠습니까?')) {
      deleteSchedule(currentGroup, editingScheduleId);
      closeModal(document.getElementById('modal-schedule-detail'));
    }
  });

  document.getElementById('todo-edit-btn')?.addEventListener('click', () => {
    closeModal(document.getElementById('modal-todo-detail'));
    openTodoForm(editingTodoId);
  });

  document.getElementById('todo-delete-btn')?.addEventListener('click', () => {
    if (confirm('할일을 삭제하시겠습니까?')) {
      deleteTodo(currentGroup, editingTodoId);
      closeModal(document.getElementById('modal-todo-detail'));
    }
  });
};

// ===== Login / Auth =====
const handleLogin = async () => {
  try {
    const user = await signInWithGoogle();
    currentUser = user;
    await initializeApp();
  } catch (error) {
    alert('로그인 실패: ' + error.message);
  }
};

const handleLogout = async () => {
  try {
    await signOut();
    currentUser = null;
    currentGroup = null;
    if (scheduleUnsubscribe) scheduleUnsubscribe();
    if (todoUnsubscribe) todoUnsubscribe();
    showScreen('screen-login');
  } catch (error) {
    alert('로그아웃 실패: ' + error.message);
  }
};

// ===== Group Management =====
const loadGroupList = async () => {
  const groupList = document.getElementById('group-list');
  if (!groupList) return;

  const groups = await getUserGroups(currentUser.uid);
  if (groups.length === 0) {
    groupList.innerHTML = '<p class="empty-state">그룹이 없습니다. 새로 만들어보세요!</p>';
    return;
  }

  groupList.innerHTML = groups.map(group => `
    <div class="group-item" data-group-id="${group.id}">
      <span class="group-item__name">${group.name}</span>
      <span class="group-item__arrow">›</span>
    </div>
  `).join('');

  document.querySelectorAll('.group-item').forEach(item => {
    item.addEventListener('click', async () => {
      const groupId = item.dataset.groupId;
      const group = groups.find(g => g.id === groupId);
      selectGroup(group);
    });
  });
};

const selectGroup = async (group) => {
  currentGroup = group.id;
  currentGroupData = group;
  document.getElementById('current-group-name').textContent = group.name;

  const groups = await getUserGroups(currentUser.uid);
  const inviteCode = group.inviteCode;
  document.getElementById('invite-code').textContent = inviteCode;

  showScreen('screen-app');

  // Load members
  members = await getGroupMembers(currentGroup);

  // Load data
  if (scheduleUnsubscribe) scheduleUnsubscribe();
  if (todoUnsubscribe) todoUnsubscribe();

  scheduleUnsubscribe = listenSchedules(currentGroup, (data) => {
    schedules = data;
    renderScheduleList();
    renderSchedulePreview();
    loadAISummary();
  });

  todoUnsubscribe = listenTodos(currentGroup, (data) => {
    todos = data;
    renderTodoList();
    renderTodoPreview();
    loadAISummary();
  });

  renderMemberBar();
};

const openCreateGroupForm = () => {
  const groupName = prompt('그룹 이름을 입력하세요:');
  if (groupName) {
    createGroup(currentUser.uid, groupName).then(group => {
      selectGroup(group);
    }).catch(error => alert('그룹 생성 실패: ' + error.message));
  }
};

// ===== Tab Management =====
const switchTab = (tabName) => {
  activeTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.app-tabs__tab').forEach(tab => {
    tab.classList.toggle('app-tabs__tab--active', tab.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.app-tab-content').forEach(content => {
    content.classList.toggle('app-tab-content--active', content.dataset.tabContent === tabName);
  });

  // Render content for current tab
  if (tabName === 'schedule') {
    renderScheduleList();
  } else if (tabName === 'todo') {
    renderTodoList();
  } else if (tabName === 'home') {
    renderSchedulePreview();
    renderTodoPreview();
    loadAISummary();
  }
};

// ===== AI Summary =====
const loadAISummary = async () => {
  const summaryCard = document.getElementById('summary-card');
  if (!summaryCard) return;

  summaryCard.innerHTML = '<div class="spinner"></div><p>요약을 불러오는 중...</p>';

  try {
    const summary = await getAISummary(schedules, todos, members);
    summaryCard.innerHTML = `<p>${summary.replace(/\n/g, '<br>')}</p>`;
  } catch (error) {
    summaryCard.innerHTML = `<p class="text-secondary">${error.message}</p>`;
  }
};

// ===== Schedule Management =====
const openScheduleForm = (scheduleId = null) => {
  editingScheduleId = scheduleId;
  const modal = document.getElementById('modal-schedule-form');
  const form = document.getElementById('schedule-form');

  if (scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    document.getElementById('schedule-title').value = schedule.title;
    document.getElementById('schedule-start-date').value = schedule.startDate;
    document.getElementById('schedule-end-date').value = schedule.endDate;
    document.getElementById('schedule-start-time').value = schedule.startTime || '';
    document.getElementById('schedule-end-time').value = schedule.endTime || '';
    document.getElementById('schedule-description').value = schedule.description || '';
    modal.querySelector('.modal-title').textContent = '일정 수정';
  } else {
    form.reset();
    modal.querySelector('.modal-title').textContent = '일정 추가';
  }

  openModal(modal);
};

const handleScheduleFormSubmit = async (e) => {
  e.preventDefault();

  const title = document.getElementById('schedule-title').value;
  const startDate = document.getElementById('schedule-start-date').value;
  const endDate = document.getElementById('schedule-end-date').value;
  const startTime = document.getElementById('schedule-start-time').value;
  const endTime = document.getElementById('schedule-end-time').value;
  const description = document.getElementById('schedule-description').value;

  if (new Date(endDate) < new Date(startDate)) {
    alert('종료 날짜가 시작 날짜보다 이전일 수 없습니다.');
    return;
  }

  const scheduleData = {
    title,
    startDate,
    endDate,
    startTime: startTime || '00:00',
    endTime: endTime || '23:59',
    description,
    member: currentUser.displayName
  };

  try {
    if (editingScheduleId) {
      await updateSchedule(currentGroup, editingScheduleId, scheduleData);
    } else {
      await addSchedule(currentGroup, scheduleData);
    }
    closeModal(document.getElementById('modal-schedule-form'));
  } catch (error) {
    alert('일정 저장 실패: ' + error.message);
  }
};

const renderScheduleList = () => {
  const tabContent = document.querySelector('[data-tab-content="schedule"]');
  if (!tabContent) return;

  const listContainer = tabContent.querySelector('#schedule-list');
  if (!listContainer) return;

  if (schedules.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📅</div><p class="empty-state__text">일정이 없습니다</p></div>';
    return;
  }

  listContainer.innerHTML = schedules.map(schedule => `
    <div class="schedule-item" data-schedule-id="${schedule.id}">
      <div class="schedule-item__content">
        <div class="schedule-item__title">${schedule.title}</div>
        <div class="schedule-item__date">${schedule.startDate} ~ ${schedule.endDate}</div>
        <div class="schedule-item__member">${schedule.member}</div>
      </div>
    </div>
  `).join('');

  listContainer.querySelectorAll('.schedule-item').forEach(item => {
    item.addEventListener('click', () => {
      const scheduleId = item.dataset.scheduleId;
      showScheduleDetail(scheduleId);
    });
  });
};

const renderSchedulePreview = () => {
  const homeTab = document.querySelector('[data-tab-content="home"]');
  if (!homeTab) return;

  const previewContainer = homeTab.querySelector('#schedule-preview');
  if (!previewContainer) return;

  const upcoming = schedules.slice(0, 3);
  if (upcoming.length === 0) {
    previewContainer.innerHTML = '<div class="empty-state"><p class="empty-state__text">다가오는 일정이 없습니다</p></div>';
    return;
  }

  previewContainer.innerHTML = upcoming.map(schedule => `
    <div class="schedule-item">
      <div class="schedule-item__content">
        <div class="schedule-item__title">${schedule.title}</div>
        <div class="schedule-item__date">${schedule.startDate} ~ ${schedule.endDate}</div>
      </div>
    </div>
  `).join('');
};

const showScheduleDetail = (scheduleId) => {
  const schedule = schedules.find(s => s.id === scheduleId);
  if (!schedule) return;

  editingScheduleId = scheduleId;
  const modal = document.getElementById('modal-schedule-detail');
  const detailContent = modal.querySelector('#schedule-detail-content');

  detailContent.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">제목</span>
      <span class="detail-value">${schedule.title}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">날짜</span>
      <span class="detail-value">${schedule.startDate} ~ ${schedule.endDate}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">시간</span>
      <span class="detail-value">${schedule.startTime} ~ ${schedule.endTime}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">담당자</span>
      <span class="detail-value">${schedule.member}</span>
    </div>
    ${schedule.description ? `
    <div class="detail-row">
      <span class="detail-label">설명</span>
      <span class="detail-value">${schedule.description}</span>
    </div>
    ` : ''}
  `;

  openModal(modal);
};

// ===== Todo Management =====
const openTodoForm = (todoId = null) => {
  editingTodoId = todoId;
  const modal = document.getElementById('modal-todo-form');
  const form = document.getElementById('todo-form');

  if (todoId) {
    const todo = todos.find(t => t.id === todoId);
    document.getElementById('todo-title').value = todo.title;
    document.getElementById('todo-start-date').value = todo.startDate || '';
    document.getElementById('todo-due-date').value = todo.dueDate;
    document.getElementById('todo-start-time').value = todo.startTime || '';
    document.getElementById('todo-end-time').value = todo.endTime || '';
    modal.querySelector('.modal-title').textContent = '할일 수정';
  } else {
    form.reset();
    modal.querySelector('.modal-title').textContent = '할일 추가';
  }

  openModal(modal);
};

const handleTodoFormSubmit = async (e) => {
  e.preventDefault();

  const title = document.getElementById('todo-title').value;
  const startDate = document.getElementById('todo-start-date').value;
  const dueDate = document.getElementById('todo-due-date').value;
  const startTime = document.getElementById('todo-start-time').value;
  const endTime = document.getElementById('todo-end-time').value;

  const todoData = {
    title,
    startDate: startDate || dueDate,
    dueDate,
    startTime: startTime || '00:00',
    endTime: endTime || '23:59',
    member: currentUser.displayName
  };

  try {
    if (editingTodoId) {
      await updateTodo(currentGroup, editingTodoId, todoData);
    } else {
      await addTodo(currentGroup, todoData);
    }
    closeModal(document.getElementById('modal-todo-form'));
  } catch (error) {
    alert('할일 저장 실패: ' + error.message);
  }
};

const renderTodoList = () => {
  const tabContent = document.querySelector('[data-tab-content="todo"]');
  if (!tabContent) return;

  const listContainer = tabContent.querySelector('#todo-list');
  if (!listContainer) return;

  if (todos.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><div class="empty-state__icon">✓</div><p class="empty-state__text">할일이 없습니다</p></div>';
    return;
  }

  listContainer.innerHTML = todos.map(todo => `
    <div class="todo-item" data-todo-id="${todo.id}">
      <div class="todo-item__content">
        <div class="todo-item__title">${todo.title}</div>
        <div class="todo-item__date">마감: ${todo.dueDate}</div>
        <div class="todo-item__member">${todo.member}</div>
      </div>
    </div>
  `).join('');

  listContainer.querySelectorAll('.todo-item').forEach(item => {
    item.addEventListener('click', () => {
      const todoId = item.dataset.todoId;
      showTodoDetail(todoId);
    });
  });
};

const renderTodoPreview = () => {
  const homeTab = document.querySelector('[data-tab-content="home"]');
  if (!homeTab) return;

  const previewContainer = homeTab.querySelector('#todo-preview');
  if (!previewContainer) return;

  const pending = todos.filter(t => !t.completed).slice(0, 3);
  if (pending.length === 0) {
    previewContainer.innerHTML = '<div class="empty-state"><p class="empty-state__text">진행 중인 할일이 없습니다</p></div>';
    return;
  }

  previewContainer.innerHTML = pending.map(todo => `
    <div class="todo-item">
      <div class="todo-item__content">
        <div class="todo-item__title">${todo.title}</div>
        <div class="todo-item__date">마감: ${todo.dueDate}</div>
      </div>
    </div>
  `).join('');
};

const showTodoDetail = (todoId) => {
  const todo = todos.find(t => t.id === todoId);
  if (!todo) return;

  editingTodoId = todoId;
  const modal = document.getElementById('modal-todo-detail');
  const detailContent = modal.querySelector('#todo-detail-content');

  detailContent.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">할일</span>
      <span class="detail-value">${todo.title}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">마감</span>
      <span class="detail-value">${todo.dueDate}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">시간</span>
      <span class="detail-value">${todo.startTime} ~ ${todo.endTime}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">담당자</span>
      <span class="detail-value">${todo.member}</span>
    </div>
  `;

  openModal(modal);
};

// ===== Member Bar =====
const renderMemberBar = () => {
  const homeTab = document.querySelector('[data-tab-content="home"]');
  if (!homeTab) return;

  const memberBar = homeTab.querySelector('#member-bar');
  if (!memberBar) return;

  memberBar.innerHTML = members.map((member, index) => {
    const initials = member.name.substring(0, 2).toUpperCase();
    return `<div class="member-item" title="${member.name}">${initials}</div>`;
  }).join('');
};

// ===== Invite =====
const copyInviteCode = () => {
  const inviteCode = document.getElementById('invite-code').textContent;
  navigator.clipboard.writeText(inviteCode).then(() => {
    showToast('초대 코드가 복사되었습니다');
  }).catch(() => {
    alert('복사 실패. 수동으로 복사해주세요: ' + inviteCode);
  });
};

// ===== Modal Management =====
const openModal = (modal) => {
  modal.classList.add('modal--active');
  document.body.style.overflow = 'hidden';
};

const closeModal = (modal) => {
  modal.classList.remove('modal--active');
  document.body.style.overflow = '';
};

// ===== Toast =====
const showToast = (message) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
};

// ===== Utility =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeApp,
    showScreen,
    switchTab,
    loadAISummary,
    openScheduleForm,
    openTodoForm,
    renderScheduleList,
    renderTodoList,
    renderMemberBar
  };
}
