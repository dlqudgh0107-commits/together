// ===== AI 요약 (백엔드 API) =====

async function getAISummary(schedules, todos, members) {
  try {
    const res = await fetch('https://together-api-yarf.onrender.com/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedules: schedules || [],
        todos: todos || [],
        members: members || []
      })
    });

    const data = await res.json();
    if (data.error) {
      console.error('AI 요약 오류:', data.error);
      return '요약을 불러올 수 없어요.';
    }
    return data.summary || '요약을 불러올 수 없어요.';
  } catch(e) {
    console.error('AI 요약 요청 실패:', e);
    return '요약을 불러올 수 없어요.';
  }
}

export { getAISummary };
