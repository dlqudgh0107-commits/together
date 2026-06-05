require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

console.log('서버 시작...');
console.log('ANTHROPIC_API_KEY 로드:', process.env.ANTHROPIC_API_KEY ? '✓ 있음' : '✗ 없음');

let client;
try {
  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('✓ Anthropic SDK 초기화 성공');
} catch(e) {
  console.error('✗ Anthropic SDK 초기화 실패:', e.message);
}

// GET /health - 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/ai-summary - AI 요약 생성
app.post('/api/ai-summary', async (req, res) => {
  try {
    const { schedules, todos, members } = req.body;

    // 향후 일정과 미완료 할일만 필터링
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingSchedules = (schedules || []).filter(s => {
      const startDate = s.startDate || s.date;
      const checkDate = new Date(startDate + 'T00:00:00');
      return checkDate >= today;
    }).slice(0, 10);

    const pendingTodos = (todos || []).filter(t => {
      return t.status === 'todo';
    }).slice(0, 10);

    // Claude 호출을 위한 프롬프트 구성
    const scheduleText = upcomingSchedules.length > 0
      ? upcomingSchedules
        .map(s => {
          const startDate = s.startDate || s.date;
          const endDate = s.endDate || startDate;
          const timeRange = s.startTime && s.endTime ? ` ${s.startTime}~${s.endTime}` : s.startTime ? ` ${s.startTime}` : '';
          const dateRange = startDate === endDate ? startDate : `${startDate}~${endDate}`;
          return `- ${s.title} (${dateRange}${timeRange})`;
        })
        .join('\n')
      : '예정된 일정이 없습니다.';

    const todoText = pendingTodos.length > 0
      ? pendingTodos
        .map(t => {
          const due = t.dueDate ? `마감: ${t.dueDate}` : '';
          const time = t.startTime && t.endTime ? `${t.startTime}~${t.endTime}` : t.startTime ? t.startTime : '';
          const info = [due, time].filter(x => x).join(' ');
          return `- ${t.title}${info ? ` (${info})` : ''}`;
        })
        .join('\n')
      : '진행 중인 할일이 없습니다.';

    const memberText = (members || []).map(m => `- ${m.nickname || m.name}`).join('\n');

    const prompt = `당신은 팀 일정 관리 AI 비서입니다. 아래 정보를 보고 2~3문장으로 친근하게 요약해주세요.

오늘 날짜: ${today.toLocaleDateString('ko-KR')}

팀 멤버:
${memberText || '멤버 정보 없음'}

다가오는 일정:
${scheduleText}

미완료 할 일:
${todoText}

간결하고 유용한 요약을 한국어로 작성해주세요. 마감이 임박한 것이 있으면 먼저 언급해주세요.`;

    const message = await client.messages.create({
      model: 'claude-opus-4-7-20250219',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';

    res.json({ summary });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: '요약을 생성하지 못했습니다.',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
