# Together - 배포 및 설정 가이드

모든 프로젝트 파일이 GitHub에 업로드되었습니다. 이제 다음 단계를 진행해야 합니다.

## 📋 필수 설정 항목

### 1️⃣ Firebase 설정 (필수)

Firebase Console에서 프로젝트를 생성하고 다음 정보를 `resource/js/firebase.js`에 입력해야 합니다:

#### 단계:
1. [Firebase Console](https://console.firebase.google.com)에 접속
2. **새 프로젝트 만들기** → "together-app" (또는 원하는 이름)
3. **프로젝트 설정** → **앱** → **웹 앱 추가**
4. 제공되는 `firebaseConfig` 코드 복사

#### firebase.js에 업데이트할 항목:
```javascript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: '1:YOUR_NUMBER:web:YOUR_APP_ID'
};
```

#### Firebase 서비스 활성화:
1. **Authentication** → **Sign-in method** → **Google** 활성화
2. **OAuth redirect URI 등록**:
   - Authorized redirect URIs:
     - `http://localhost:8000/` (로컬 테스트용)
     - `http://localhost:3000/` (로컬 서버용)
     - `https://your-firebase-app.web.app/` (배포 후)

3. **Firestore Database** → **Create Database**
   - Location: asia-southeast1 (또는 가까운 지역)
   - Security Rules (테스트 모드):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

### 2️⃣ 백엔드 배포 (Render.com)

#### 단계:
1. [Render.com](https://render.com)에 가입
2. **Dashboard** → **New +** → **Web Service**
3. GitHub 저장소 연결
4. 설정:
   - **Name**: together-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Region**: Singapore (또는 가까운 지역)
5. **Environment Variables** 추가:
   - `ANTHROPIC_API_KEY`: 본인의 API 키

배포 후 제공되는 URL 기록 (예: `https://together-backend-xxxx.onrender.com`)

### 3️⃣ 프론트엔드 코드 업데이트

#### ai.js 수정:
```javascript
// localhost:3000을 배포된 백엔드 URL로 변경
const apiUrl = 'https://together-backend-xxxx.onrender.com/api/ai-summary';
```

#### firebase.js 수정:
- 위에서 얻은 Firebase 설정으로 `firebaseConfig` 업데이트

### 4️⃣ Firebase Hosting 배포

#### 사전 준비:
1. [Firebase CLI 설치](https://firebase.google.com/docs/cli):
   ```powershell
   npm install -g firebase-tools
   ```

2. Firebase에 로그인:
   ```powershell
   firebase login
   ```

#### 배포:
1. 프로젝트 디렉토리에서:
   ```powershell
   firebase init hosting
   ```
   
2. 프롬프트에서:
   - **Existing project 선택** → 위에서 만든 프로젝트
   - **Public directory**: `.` (루트 디렉토리)
   - **Single-page app 설정**: `No`

3. 배포:
   ```powershell
   firebase deploy
   ```

배포 후 제공되는 URL이 공개 접근 링크입니다.

## 🧪 로컬에서 테스트하기

### 백엔드 로컬 실행:
```powershell
cd "c:\Users\bhl\OneDrive - YBM, Inc\MY-WORKSPACE\together-session1"
node server.js
```

### 프론트엔드 로컬 테스트:
```powershell
# Python이 설치되어 있으면:
python -m http.server 8000

# 또는 PowerShell:
$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://localhost:8000/")
$http.Start()
Write-Host "Server running on http://localhost:8000"
```

## 🚀 배포 순서 요약

1. **Firebase 설정** (firebase.js 업데이트)
2. **백엔드 배포** (Render.com)
3. **ai.js 업데이트** (배포된 URL 입력)
4. **로컬 테스트**
5. **프론트엔드 배포** (Firebase Hosting)

## 📝 환경 변수 관리

- **로컬**: `.env` 파일 (Git에 포함되지 않음)
- **Render**: Environment Variables 섹션에서 설정
- **Firebase**: 소스 코드에 포함 (안전함 - API Key는 클라이언트용)

## ✅ 배포 완료 체크리스트

- [ ] Firebase 프로젝트 생성 및 설정
- [ ] Firebase Authentication (Google) 활성화
- [ ] Firestore Database 생성
- [ ] firebase.js에 Firebase 설정 입력
- [ ] Render.com에 백엔드 배포
- [ ] ai.js에 배포된 백엔드 URL 입력
- [ ] 로컬 테스트 완료
- [ ] Firebase Hosting 배포
- [ ] 모바일/다른 기기에서 접속 테스트

## 🎯 배포 후 사용 방법

1. Firebase Hosting URL을 가족에게 공유
2. 각 가족 구성원이 Google 계정으로 로그인
3. 그룹 생성 또는 초대 코드로 참가
4. 일정과 할일을 함께 관리
