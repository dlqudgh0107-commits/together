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
let currentTodoFilter = 'all';
let notifications = [];

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

const initializeApp = async () => {
  currentUser = await getCurrentUser();

  if (currentUser) {
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
      loadGroupList();
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

  // Group Management
  document.getElementById('create-group-btn')?.addEventListener('click', openCreateGroupForm);
  document.getElementById('join-group-btn')?.addEventListener('click', openJoinGroupForm);

  // Header Menus
  document.getElementById('menu-left-btn')?.addEventListener('click', toggleSidebar);
  document.getElementById('menu-right-btn')?.addEventListener('click', toggleDropdownMenu);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Sidebar Items
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);

  // Dropdown Menu Items
  document.getElementById('group-settings-btn')?.addEventListener('click', openGroupSettings);
  document.getElementById('invite-btn')?.addEventListener('click', openInviteModal);
  document.getElementById('leave-group-btn')?.addEventListener('click', leaveGroup);

  // Tabs
  document.querySelectorAll('.app-tabs__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // FAB Button
  document.getElementById('fab-button')?.addEventListener('click', toggleFabMenu);
  document.getElementById('fab-schedule')?.addEventListener('click', () => {
    closeFabMenu();
    openScheduleForm();
  });
  document.getElementById('fab-todo')?.addEventListener('click', () => {
    closeFabMenu();
    openTodoForm();
  });

  // Notification Bell
  document.getElementById('notification-btn')?.addEventListener('click', openNotifications);

  // Forms
  document.getElementById('schedule-form')?.addEventListener('submit', handleScheduleFormSubmit);
  document.getElementById('todo-form')?.addEventListener('submit', handleTodoFormSubmit);

  // Todo Filter
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
      tab.classList.add('filter-tab--active');
      currentTodoFilter = tab.dataset.filter;
      renderTodoList();
    });
  });

  // Modal Close
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      closeModal(modal);
    });
  });

  // Click outside modal
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
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
    closeSidebar();
  } catch (error) {
    alert('로그아웃 실패: ' + error.message);
  }
};

// ===== Sidebar Management =====
const toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar-left');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
};

const closeSidebar = () => {
  const sidebar = document.getElementById('sidebar-left');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('active');
  overlay.classList.remove('active');
};

// ===== Dropdown Menu =====
const toggleDropdownMenu = () => {
  const menu = document.getElementById('dropdown-menu-right');
  menu.classList.toggle('active');
};

const closeDropdownMenu = () => {
  const menu = document.getElementById('dropdown-menu-right');
  menu.classList.remove('active');
};

// ===== FAB Menu =====
const toggleFabMenu = () => {
  const menu = document.getElementById('fab-menu');
  menu.classList.toggle('active');
};

const closeFabMenu = () => {
  const menu = document.getElementById('fab-menu');
  menu.classList.remove('active');
};

// ===== Group Management =====
const loadGroupList = async () => {
  const groupList = document.getElementById('group-list');
  if (!groupList) return;

  const groups = await getUserGroups(currentUser.uid);
  if (groups.length === 0) {
    groupList.innerHTML = '<div class="empty-state">그룹이 없습니다. 새로 만들어보세요!</div>';
    return;
  }

  groupList.innerHTML = groups.map(group => `
    <div class="group-item">
      <div class="group-item__name">${group.name}</div>
      <div class="group-item__info">${group.members.length}명 • ${new Date(group.createdAt.seconds * 1000).toLocaleDateString()}</div>
      <button type="button" class="btn btn--sm btn--primary" style="margin-top: 8px;">진입</button>
    </div>
  `).join('');

  document.querySelectorAll('.group-item').forEach((item, idx) => {
    item.querySelector('button').addEventListener('click', () => {
      selectGroup(groups[idx]);
    });
  });
};

const selectGroup = async (group) => {
  currentGroup = group.id;
  currentGroupData = group;
  document.getElementById('header-group-name').textContent = group.name;

  // Update sidebar group list
  updateSidebarGroupList();

  showScreen('screen-app');

  members = await getGroupMembers(currentGroup);

  if (scheduleUnsubscribe) scheduleUnsubscribe();
  if (todoUnsubscribe) todoUnsubscribe();

  scheduleUnsubscribe = listenSchedules(currentGroup, (data) => {
    schedules = data;
    renderScheduleList();
    renderTodaySection();
  });

  todoUnsubscribe = listenTodos(currentGroup, (data) => {
    todos = data;
    renderTodoList();
    renderTodaySection();
    loadAISummary();
  });

  renderMemberBar();
  loadAISummary();
  closeSidebar();
};

const updateSidebarGroupList = async () => {
  const groups = await getUserGroups(currentUser.uid);
  const groupSelectList = document.getElementById('group-select-list');

  groupSelectList.innerHTML = groups.map(group => `
    <div class="group-select-item ${group.id === currentGroup ? 'active' : ''}" data-group-id="${group.id}">
      ${group.name}
    </div>
  `).join('');

  document.querySelectorAll('.group-select-item').forEach(item => {
    item.addEventListener('click', async () => {
      const groupId = item.dataset.groupId;
      const selectedGroup = groups.find(g => g.id === groupId);
      await selectGroup(selectedGroup);
    });
  });
};

const openCreateGroupForm = () => {
  const groupName = prompt('그룹 이름을 입력하세요:');
  if (groupName) {
    createGroup(currentUser.uid, groupName).then(group => {
      selectGroup(group);
    }).catch(error => alert('그룹 생성 실패: ' + error.message));
  }
};

const openJoinGroupForm = () => {
  const inviteCode = prompt('초대 코드를 입력하세요:');
  if (inviteCode) {
    joinGroup(currentUser.uid, inviteCode).then(group => {
      selectGroup(group);
    }).catch(error => alert('그룹 참여 실패: ' + error.message));
  }
};

const openGroupSettings = () => {
  alert('그룹 설정 기능은 준비 중입니다');
  closeDropdownMenu();
};

const openInviteModal = () => {
  const inviteCode = currentGroupData?.inviteCode || 'CODE123';
  alert(`초대 코드: ${inviteCode}\n\n이 코드를 복사해서 공유하세요!`);
  closeDropdownMenu();
};

const leaveGroup = () => {
  if (confirm('정말 이 그룹에서 나가시겠어요?')) {
    alert('그룹 나가기 기능은 준비 중입니다');
    closeDropdownMenu();
  }
};

// ===== Tab Management =====
const switchTab = (tabName) => {
  activeTab = tabName;

  document.querySelectorAll('.app-tabs__tab').forEach(tab => {
    tab.classList.toggle('app-tabs__tab--active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.app-tab-content').forEach(content => {
    content.classList.toggle('app-tab-content--active', content.dataset.tabContent === tabName);
  });

  if (tabName === 'schedule') {
    renderScheduleList();
  } else if (tabName === 'todo') {
    renderTodoList();
  } else if (tabName === 'home') {
    renderTodaySection();
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
    summaryCard.innerHTML = `<p>${error.message}</p>`;
  }
};

// ===== Home Screen Sections =====
const renderTodaySection = () => {
  const todaySection = document.getElementById('today-section');
  if (!todaySection) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySchedules = schedules.filter(s => {
    const startDate = new Date(s.startDate);
    const endDate = new Date(s.endDate);
    return startDate <= today && endDate >= today;
  });

  const todayTodos = todos.filter(t => {
    const dueDate = new Date(t.dueDate);
    return !t.completed && dueDate.toDateString() === today.toDateString();
  });

  if (todaySchedules.length === 0 && todayTodos.length === 0) {
    todaySection.innerHTML = '<div class="empty-state">오늘의 일정과 할일이 없습니다</div>';
    return;
  }

  let html = '';

  todaySchedules.forEach(s => {
    html += `
      <div class="today-card">
        <div class="today-card-title">📅 ${s.title}</div>
        <div class="today-card-time">${s.startTime} ~ ${s.endTime}</div>
        <div class="today-card-time">담당: ${s.member}</div>
      </div>
    `;
  });

  todayTodos.forEach(t => {
    html += `
      <div class="today-card">
        <div class="today-card-title">✓ ${t.title}</div>
        <div class="today-card-time">마감: ${t.endTime}</div>
        <div class="today-card-time">담당: ${t.member}</div>
      </div>
    `;
  });

  todaySection.innerHTML = html;
};

const renderActivityFeed = () => {
  const activityFeed = document.getElementById('activity-feed');
  if (!activityFeed) return;

  if (schedules.length === 0 && todos.length === 0) {
    activityFeed.innerHTML = '<div class="empty-state">아직 활동이 없습니다</div>';
    return;
  }

  const recentItems = [
    ...schedules.map(s => ({ type: 'schedule', ...s, createdAt: s.createdAt })),
    ...todos.map(t => ({ type: 'todo', ...t, createdAt: t.createdAt }))
  ].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);

  activityFeed.innerHTML = recentItems.map(item => {
    const date = new Date((item.createdAt?.seconds || 0) * 1000);
    const timeAgo = getTimeAgo(date);

    if (item.type === 'schedule') {
      return `
        <div class="activity-card">
          <div class="activity-title">🆕 [${item.member}]이 일정을 추가했습니다</div>
          <div class="activity-time">${item.title} • ${timeAgo}</div>
          <button type="button" class="activity-action">확인하기</button>
        </div>
      `;
    } else {
      return `
        <div class="activity-card">
          <div class="activity-title">🆕 [${item.member}]이 할일을 추가했습니다</div>
          <div class="activity-time">${item.title} • ${timeAgo}</div>
          <button type="button" class="activity-action">확인하기</button>
        </div>
      `;
    }
  }).join('');
};

const getTimeAgo = (date) => {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
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
  const listContainer = document.querySelector('.schedule-list');
  if (!listContainer) return;

  if (schedules.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">📅 일정이 없습니다</div>';
    return;
  }

  listContainer.innerHTML = schedules.map(schedule => `
    <div class="schedule-item" data-schedule-id="${schedule.id}">
      <div class="schedule-item__title">${schedule.title}</div>
      <div class="schedule-item__date">${schedule.startDate} ~ ${schedule.endDate}</div>
      <div class="schedule-item__member">담당: ${schedule.member}</div>
    </div>
  `).join('');
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
  const listContainer = document.querySelector('.todo-list');
  if (!listContainer) return;

  let filteredTodos = todos;

  if (currentTodoFilter === 'pending') {
    filteredTodos = todos.filter(t => !t.completed);
  } else if (currentTodoFilter === 'completed') {
    filteredTodos = todos.filter(t => t.completed);
  }

  if (filteredTodos.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">✓ 할일이 없습니다</div>';
    return;
  }

  listContainer.innerHTML = filteredTodos.map(todo => {
    const dueDate = new Date(todo.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isUrgent = dueDate <= today && !todo.completed;

    return `
      <div class="todo-item ${isUrgent ? 'todo-item--urgent' : ''}">
        <div class="todo-item__header">
          <input type="checkbox" class="todo-item__checkbox" ${todo.completed ? 'checked' : ''}>
          <div class="todo-item__title">${todo.title}</div>
          ${isUrgent ? '<span class="todo-item__priority">긴급</span>' : ''}
        </div>
        <div class="todo-item__meta">마감: ${todo.dueDate} ${todo.endTime}</div>
        <div class="todo-item__member">담당: ${todo.member}</div>
      </div>
    `;
  }).join('');
};

// ===== Member Bar =====
const renderMemberBar = () => {
  const memberBar = document.getElementById('member-bar');
  if (!memberBar) return;

  const colors = ['orange', 'yellow', 'green', 'blue'];
  memberBar.innerHTML = members.map((member, index) => {
    const initials = member.name.substring(0, 2).toUpperCase();
    const colorClass = colors[index % colors.length];
    return `<div class="member-item member-item--${colorClass}" title="${member.name}">${initials}</div>`;
  }).join('');
};

// ===== Notifications =====
const openNotifications = () => {
  const modal = document.getElementById('modal-notifications');
  openModal(modal);
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

// ===== Other Functions =====
const openSettings = () => {
  alert('설정 기능은 준비 중입니다');
  closeSidebar();
};

// Export for testing
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
