// AI Summary Function
const getAISummary = async (schedules, todos, members) => {
  try {
    // Render 배포 백엔드 URL
    const apiUrl = 'https://together-api-yarf.onrender.com/api/ai-summary';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: schedules.map(s => ({
          title: s.title,
          startDate: s.startDate,
          endDate: s.endDate,
          startTime: s.startTime || '00:00',
          endTime: s.endTime || '23:59',
          member: s.member
        })),
        todos: todos.filter(t => !t.completed).map(t => ({
          title: t.title,
          startDate: t.startDate,
          dueDate: t.dueDate,
          startTime: t.startTime || '00:00',
          endTime: t.endTime || '23:59',
          member: t.member
        })),
        members: members.map(m => ({ name: m.name }))
      })
    });

    if (!response.ok) {
      throw new Error('API 응답 오류');
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('AI Summary error:', error);
    throw new Error('요약을 불러올 수 없습니다.');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getAISummary };
}
