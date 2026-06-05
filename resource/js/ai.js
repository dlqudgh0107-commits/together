// ===== AI 요약 (Claude API) =====

async function getAISummary(schedules, todos, members) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingSchedules = schedules
    .filter(s => new Date(s.date) >= today)
    .slice(0, 10)
    .map(s => {
      const member = members.find(m => (s.memberIds || []).includes(m.id));
      return `- ${s.date} ${s.time || ''} : ${s.title} (${member ? member.nickname : '전체'})`;
    }).join('\n');

  const pendingTodos = todos
    .filter(t => t.status === 'todo')
    .slice(0, 10)
    .map(t => {
      const member = members.find(m => m.id === t.assigneeId);
      const due = t.dueDate ? ` [마감: ${t.dueDate}]` : '';
      return `- ${t.title}${due} (담당: ${member ? member.nickname : '미정'})`;
    }).join('\n');

  const prompt = `당신은 팀 일정 관리 AI 비서입니다. 아래 정보를 보고 2~3문장으로 친근하게 요약해주세요.

오늘 날짜: ${today.toLocaleDateString('ko-KR')}

[예정된 일정]
${upcomingSchedules || '없음'}

[미완료 할 일]
${pendingTodos || '없음'}

간결하고 유용한 요약을 한국어로 작성해주세요. 마감이 임박한 것이 있으면 먼저 언급해주세요.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || '요약을 불러올 수 없어요.';
}

export { getAISummary };
