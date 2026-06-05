// ===== Firebase 초기화 =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, orderBy, where, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCcwW16cgi6kt4ztdW6LMwpJdBNJTlaPxY",
  authDomain: "together-app-6cabd.firebaseapp.com",
  projectId: "together-app-6cabd",
  storageBucket: "together-app-6cabd.firebasestorage.app",
  messagingSenderId: "587547619757",
  appId: "1:587547619757:web:64899799389cb13c077124",
  measurementId: "G-354V84FLB7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ===== Auth =====
async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await setDoc(doc(db, 'users', user.uid), {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return user;
}

async function signOutUser() {
  await signOut(auth);
}

// ===== Group =====
async function createGroup(name, type, userId, userNickname, userIcon, userColor) {
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const groupRef = await addDoc(collection(db, 'groups'), {
    name, type, inviteCode, createdBy: userId, createdAt: serverTimestamp()
  });
  await setDoc(doc(db, 'groups', groupRef.id, 'members', userId), {
    nickname: userNickname, icon: userIcon, color: userColor, role: 'admin', joinedAt: serverTimestamp()
  });
  await setDoc(doc(db, 'users', userId, 'groups', groupRef.id), { name, type, joinedAt: serverTimestamp() });
  return groupRef.id;
}

async function joinGroupByCode(inviteCode, userId, userNickname, userIcon, userColor) {
  const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) throw new Error('초대 코드를 찾을 수 없어요.');
  const groupDoc = snapshot.docs[0];
  const groupId = groupDoc.id;
  const groupData = groupDoc.data();
  await setDoc(doc(db, 'groups', groupId, 'members', userId), {
    nickname: userNickname, icon: userIcon, color: userColor, role: 'member', joinedAt: serverTimestamp()
  });
  await setDoc(doc(db, 'users', userId, 'groups', groupId), { name: groupData.name, type: groupData.type, joinedAt: serverTimestamp() });
  return groupId;
}

async function getUserGroups(userId) {
  const snapshot = await getDocs(collection(db, 'users', userId, 'groups'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getGroupMembers(groupId) {
  const snapshot = await getDocs(collection(db, 'groups', groupId, 'members'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ===== Schedule =====
async function addSchedule(groupId, data, userId, userNickname) {
  const ref = await addDoc(collection(db, 'groups', groupId, 'schedules'), {
    ...data, createdBy: userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await addActivity(groupId, { type: 'schedule_add', userId, nickname: userNickname, targetTitle: data.title, message: `"${data.title}" 일정을 등록했어요.` });
  return ref.id;
}

async function updateSchedule(groupId, scheduleId, data, userId, userNickname) {
  await updateDoc(doc(db, 'groups', groupId, 'schedules', scheduleId), { ...data, updatedAt: serverTimestamp() });
  await addActivity(groupId, { type: 'schedule_update', userId, nickname: userNickname, targetTitle: data.title, message: `"${data.title}" 일정을 수정했어요.` });
}

async function deleteSchedule(groupId, scheduleId, title, userId, userNickname) {
  await deleteDoc(doc(db, 'groups', groupId, 'schedules', scheduleId));
  await addActivity(groupId, { type: 'schedule_delete', userId, nickname: userNickname, targetTitle: title, message: `"${title}" 일정을 삭제했어요.` });
}

function listenSchedules(groupId, callback) {
  const q = query(collection(db, 'groups', groupId, 'schedules'), orderBy('date', 'asc'));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

// ===== Todo =====
async function addTodo(groupId, data, userId, userNickname) {
  const ref = await addDoc(collection(db, 'groups', groupId, 'todos'), {
    ...data, status: 'todo', createdBy: userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await addActivity(groupId, { type: 'todo_add', userId, nickname: userNickname, targetTitle: data.title, message: `"${data.title}" 할 일을 추가했어요.` });
  return ref.id;
}

async function updateTodo(groupId, todoId, data, userId, userNickname) {
  await updateDoc(doc(db, 'groups', groupId, 'todos', todoId), { ...data, updatedAt: serverTimestamp() });
  await addActivity(groupId, { type: 'todo_update', userId, nickname: userNickname, targetTitle: data.title, message: `"${data.title}" 할 일을 수정했어요.` });
}

async function deleteTodo(groupId, todoId, title, userId, userNickname) {
  await deleteDoc(doc(db, 'groups', groupId, 'todos', todoId));
  await addActivity(groupId, { type: 'todo_delete', userId, nickname: userNickname, targetTitle: title, message: `"${title}" 할 일을 삭제했어요.` });
}

async function toggleTodo(groupId, todoId, currentStatus, title, userId, userNickname) {
  const newStatus = currentStatus === 'todo' ? 'done' : 'todo';
  await updateDoc(doc(db, 'groups', groupId, 'todos', todoId), { status: newStatus, updatedAt: serverTimestamp() });
  if (newStatus === 'done') {
    await addActivity(groupId, { type: 'todo_done', userId, nickname: userNickname, targetTitle: title, message: `"${title}" 완료!` });
  }
}

function listenTodos(groupId, callback) {
  const q = query(collection(db, 'groups', groupId, 'todos'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

// ===== Activity (알림장) =====
async function addActivity(groupId, data) {
  await addDoc(collection(db, 'groups', groupId, 'activities'), {
    ...data, createdAt: serverTimestamp()
  });
}

function listenActivities(groupId, callback) {
  const q = query(collection(db, 'groups', groupId, 'activities'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export {
  auth, db, onAuthStateChanged,
  signInWithGoogle, signOutUser,
  createGroup, joinGroupByCode, getUserGroups, getGroupMembers,
  addSchedule, updateSchedule, deleteSchedule, listenSchedules,
  addTodo, updateTodo, deleteTodo, toggleTodo, listenTodos,
  addActivity, listenActivities
};
