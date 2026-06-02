export async function postContactFunction(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  let json = {};
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      'Сервер вернул неожиданный ответ. Попробуйте позже или напишите на order@azone-it.ru',
    );
  }

  const ok = res.ok && json.success === true;
  return { json, ok };
}

export function contactFetchErrorMessage(err) {
  if (!err || !err.message) {
    return 'Не удалось отправить заявку. Напишите на order@azone-it.ru';
  }
  if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
    return 'Не удалось связаться с сервером. Попробуйте позже или напишите на order@azone-it.ru';
  }
  return err.message;
}
