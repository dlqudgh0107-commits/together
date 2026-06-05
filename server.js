require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// GET /health - 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/ai-summary - AI 요약 생성
app.post('/api/ai-summary', async (req, res) => {
  try {
    const { schedules, todos, members } = req.body;

    // 향후 일정과 진행 중인 할일만 필터링
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingSchedules = schedules.filter(s => {
      const endDate = new Date(s.endDate);
      endDate.setHours(23, 59, 59, 999);
      return endDate >= today;
    });

    const pendingTodos = todos.filter(t => {
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(23, 59, 59, 999);
      return !t.completed && dueDate >= today;
    });

    // Claude 호출을 위한 프롬프트 구성
    const scheduleText = upcomingSchedules.length > 0
      ? upcomingSchedules
        .map(s => `- ${s.title} (${s.startDate} ~ ${s.endDate}, ${s.startTime} ~ ${s.endTime})`)
        .join('\n')
      : '예정된 일정이 없습니다.';

    const todoText = pendingTodos.length > 0
      ? pendingTodos
        .map(t => `- ${t.title} (마감: ${t.dueDate} ${t.endTime})`)
        .join('\n')
      : '진행 중인 할일이 없습니다.';

    const memberText = members.map(m => `- ${m.name}`).join('\n');

    const prompt = `우리 가족의 다가오는 일정과 할일을 요약해줘. 간단하고 명확하게.

가족 멤버:
${memberText}

다가오는 일정:
${scheduleText}

진행 중인 할일:
${todoText}

이 정보를 기반으로 가족의 주간 계획을 요약해주고, 중요한 점이나 주의사항이 있으면 언급해줘.`;

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
