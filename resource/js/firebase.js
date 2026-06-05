// Firebase initialization
const firebaseConfig = {
  apiKey: "AIzaSyCcwW16cgi6kt4ztdW6LMwpJdBNJTlaPxY",
  authDomain: "together-app-6cabd.firebaseapp.com",
  projectId: "together-app-6cabd",
  storageBucket: "together-app-6cabd.firebasestorage.app",
  messagingSenderId: "587547619757",
  appId: "1:587547619757:web:64899799389cb13c077124",
  measurementId: "G-354V84FLB7"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== Auth Functions =====
const getCurrentUser = async () => {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      resolve(user);
    });
  });
};

const signInWithGoogle = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

const signOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// ===== Group Functions =====
const getUserGroups = async (userId) => {
  try {
    const snapshot = await db.collection('groups')
      .where('members', 'array-contains', userId)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Get groups error:', error);
    return [];
  }
};

const createGroup = async (userId, groupName) => {
  try {
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const docRef = await db.collection('groups').add({
      name: groupName,
      ownerId: userId,
      members: [userId],
      inviteCode: inviteCode,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { id: docRef.id, name: groupName, inviteCode };
  } catch (error) {
    console.error('Create group error:', error);
    throw error;
  }
};

const getGroupInfo = async (groupId) => {
  try {
    const doc = await db.collection('groups').doc(groupId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (error) {
    console.error('Get group info error:', error);
    return null;
  }
};

const joinGroup = async (userId, inviteCode) => {
  try {
    const snapshot = await db.collection('groups')
      .where('inviteCode', '==', inviteCode)
      .get();
    if (snapshot.empty) {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }
    const groupDoc = snapshot.docs[0];
    await groupDoc.ref.update({
      members: firebase.firestore.FieldValue.arrayUnion(userId),
      updatedAt: new Date()
    });
    return { id: groupDoc.id, ...groupDoc.data() };
  } catch (error) {
    console.error('Join group error:', error);
    throw error;
  }
};

// ===== Member Functions =====
const getGroupMembers = async (groupId) => {
  try {
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) return [];
    const memberIds = groupDoc.data().members || [];
    const members = [];
    for (const memberId of memberIds) {
      const userDoc = await db.collection('users').doc(memberId).get();
      if (userDoc.exists) {
        members.push({ id: memberId, ...userDoc.data() });
      }
    }
    return members;
  } catch (error) {
    console.error('Get members error:', error);
    return [];
  }
};

const updateUserProfile = async (userId, data) => {
  try {
    await db.collection('users').doc(userId).set(data, { merge: true });
  } catch (error) {
    console.error('Update user profile error:', error);
    throw error;
  }
};

// ===== Schedule Functions =====
const addSchedule = async (groupId, scheduleData) => {
  try {
    const docRef = await db.collection('groups').doc(groupId)
      .collection('schedules').add({
        ...scheduleData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    return docRef.id;
  } catch (error) {
    console.error('Add schedule error:', error);
    throw error;
  }
};

const updateSchedule = async (groupId, scheduleId, data) => {
  try {
    await db.collection('groups').doc(groupId)
      .collection('schedules').doc(scheduleId).update({
        ...data,
        updatedAt: new Date()
      });
    await addActivity(groupId, {
      type: 'schedule_updated',
      scheduleId: scheduleId,
      message: `일정이 수정되었습니다: ${data.title}`
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    throw error;
  }
};

const deleteSchedule = async (groupId, scheduleId) => {
  try {
    await db.collection('groups').doc(groupId)
      .collection('schedules').doc(scheduleId).delete();
    await addActivity(groupId, {
      type: 'schedule_deleted',
      scheduleId: scheduleId,
      message: '일정이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    throw error;
  }
};

const listenSchedules = (groupId, callback) => {
  return db.collection('groups').doc(groupId)
    .collection('schedules')
    .orderBy('startDate', 'asc')
    .onSnapshot(snapshot => {
      const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(schedules);
    }, error => console.error('Schedule listener error:', error));
};

// ===== Todo Functions =====
const addTodo = async (groupId, todoData) => {
  try {
    const docRef = await db.collection('groups').doc(groupId)
      .collection('todos').add({
        ...todoData,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    return docRef.id;
  } catch (error) {
    console.error('Add todo error:', error);
    throw error;
  }
};

const updateTodo = async (groupId, todoId, data) => {
  try {
    await db.collection('groups').doc(groupId)
      .collection('todos').doc(todoId).update({
        ...data,
        updatedAt: new Date()
      });
    await addActivity(groupId, {
      type: 'todo_updated',
      todoId: todoId,
      message: `할일이 수정되었습니다: ${data.title}`
    });
  } catch (error) {
    console.error('Update todo error:', error);
    throw error;
  }
};

const deleteTodo = async (groupId, todoId) => {
  try {
    await db.collection('groups').doc(groupId)
      .collection('todos').doc(todoId).delete();
    await addActivity(groupId, {
      type: 'todo_deleted',
      todoId: todoId,
      message: '할일이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Delete todo error:', error);
    throw error;
  }
};

const completeTodo = async (groupId, todoId) => {
  try {
    await db.collection('groups').doc(groupId)
      .collection('todos').doc(todoId).update({
        completed: true,
        completedAt: new Date(),
        updatedAt: new Date()
      });
    await addActivity(groupId, {
      type: 'todo_completed',
      todoId: todoId,
      message: '할일이 완료되었습니다.'
    });
  } catch (error) {
    console.error('Complete todo error:', error);
    throw error;
  }
};

const listenTodos = (groupId, callback) => {
  return db.collection('groups').doc(groupId)
    .collection('todos')
    .orderBy('dueDate', 'asc')
    .onSnapshot(snapshot => {
      const todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(todos);
    }, error => console.error('Todo listener error:', error));
};

// ===== Activity Log =====
const addActivity = async (groupId, activityData) => {
  try {
    const user = await getCurrentUser();
    await db.collection('groups').doc(groupId)
      .collection('activities').add({
        ...activityData,
        userId: user?.uid,
        userName: user?.displayName,
        createdAt: new Date()
      });
  } catch (error) {
    console.error('Add activity error:', error);
  }
};

// ===== Export =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentUser,
    signInWithGoogle,
    signOut,
    getUserGroups,
    createGroup,
    getGroupInfo,
    joinGroup,
    getGroupMembers,
    updateUserProfile,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    listenSchedules,
    addTodo,
    updateTodo,
    deleteTodo,
    completeTodo,
    listenTodos,
    addActivity
  };
}
