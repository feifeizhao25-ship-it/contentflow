/** Turn API payloads into English tables. Missing values stay missing. Nothing here invents a metric. */

export interface Presented {
  headers: string[];
  rows: string[][];
  notes: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function when(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Not set';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : value.trim();
}

export function listFrom(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const body = record(payload);
  for (const key of keys) if (Array.isArray(body[key])) return body[key] as unknown[];
  const nested = record(body.data);
  for (const key of keys) if (Array.isArray(nested[key])) return nested[key] as unknown[];
  return [];
}

export function contentRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['contents']).map((item) => {
    const row = record(item);
    return [text(row.title, 'Untitled'), text(row.content_type, 'Unknown type'), text(row.status, 'Unknown status'), when(row.created_at)];
  });
  return {
    headers: ['Title', 'Type', 'Status', 'Saved at'],
    rows,
    notes: rows.length ? [] : ['No drafts are stored yet. This list is empty because this workspace has not saved any content.'],
  };
}

export function publishRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['tasks']).map((item) => {
    const row = record(item);
    const content = record(row.content);
    const adapted = record(row.platform_content);
    const account = record(row.platform_account);
    const platform = text(adapted.platform) || text(account.platform) || 'Not set';
    return [text(content.title, 'Untitled'), platform, text(row.status, 'Unknown status'), when(row.scheduled_at)];
  });
  return {
    headers: ['Draft', 'Platform id', 'Status', 'Scheduled at'],
    rows,
    notes: rows.length ? ['Platform ids are the values stored on the task.'] : ['No publish tasks are stored. Nothing here is a forecast.'],
  };
}

export function calendarRows(payload: unknown): Presented {
  const scheduled = listFrom(payload, ['tasks']).filter((item) => {
    const whenValue = record(item).scheduled_at;
    return typeof whenValue === 'string' && whenValue.trim().length > 0;
  });
  const presented = publishRows({ tasks: scheduled });
  if (!presented.rows.length) {
    return {
      ...presented,
      notes: ['No tasks have a scheduled time. Unscheduled tasks stay on the publishing page. This is not a suggested calendar.'],
    };
  }
  return presented;
}

function storedCount(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not returned';
}

export function analyticsRows(payload: unknown): Presented {
  const body = record(payload);
  const week = record(body.week);
  const publish = record(week.publish);
  const ai = record(week.ai);
  const engagement = record(body.engagement);
  const rows: string[][] = [
    ['Publish tasks stored this week', storedCount(publish.total)],
    ['Published', storedCount(publish.published)],
    ['Failed', storedCount(publish.failed)],
    ['In progress', storedCount(publish.inProgress)],
    ['AI generations stored this week', storedCount(ai.generations)],
    ['Saved into the library', storedCount(ai.savedAsContent)],
    ['Approved or published', storedCount(ai.approvedOrPublished)],
  ];
  const notes = [
    typeof engagement.detail === 'string' && engagement.detail.trim()
      ? engagement.detail.trim()
      : 'Views, likes, and follower changes are not shown. They are not estimated.',
  ];
  const counts = [publish.total, publish.published, publish.failed, ai.generations, ai.savedAsContent];
  if (counts.every((value) => value === 0)) {
    notes.unshift('Every zero above is a stored count. This workspace has no records in the current week.');
  }
  return { headers: ['Record', 'Stored count'], rows, notes };
}

export function accountRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['accounts']).map((item) => {
    const row = record(item);
    const followers = typeof row.follower_count === 'number' && Number.isFinite(row.follower_count) ? String(row.follower_count) : 'Not stored';
    return [text(row.platform, 'Unknown platform'), text(row.account_name, 'Unnamed account'), text(row.status, 'Unknown status'), followers];
  });
  return {
    headers: ['Platform id', 'Account', 'Status', 'Stored follower count'],
    rows,
    notes: rows.length
      ? ['Follower counts are the numbers saved on the account. They are not a reach estimate.']
      : ['No platform accounts are connected. This list is empty because none are stored.'],
  };
}

export function materialRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['materials']).map((item) => {
    const row = record(item);
    return [text(row.name, 'Untitled file'), text(row.material_type, 'Unknown type'), when(row.created_at)];
  });
  return {
    headers: ['Name', 'Type', 'Saved at'],
    rows,
    notes: rows.length ? [] : ['No files are stored. Upload is unavailable until object storage is connected, so this page does not pretend a file was saved.'],
  };
}

export function teamRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['members']).map((item) => {
    const row = record(item);
    return [text(row.name, 'Unnamed member'), text(row.email, 'No email'), text(row.role, 'member')];
  });
  return {
    headers: ['Name', 'Email', 'Role'],
    rows,
    notes: rows.length ? [] : ['No other members are stored for this workspace.'],
  };
}

export function profileRows(payload: unknown): Presented {
  const user = record(record(payload).user);
  const source = Object.keys(user).length ? user : record(payload);
  const rows = [
    ['Name', text(source.name, 'Not set')],
    ['Email', text(source.email, 'Not set')],
    ['Role', text(source.role, 'Not set')],
  ];
  return { headers: ['Field', 'Stored value'], rows, notes: ['These are the fields saved on your account.'] };
}

export function voiceRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['personas']).map((item) => {
    const row = record(item);
    return [text(row.name, 'Untitled voice'), text(row.description, 'No description'), row.is_system === true ? 'Shared template' : 'Workspace voice'];
  });
  return {
    headers: ['Name', 'Description', 'Scope'],
    rows,
    notes: rows.length ? ['Descriptions are stored text, shown as saved.'] : ['No brand voices are stored for this workspace.'],
  };
}

export function developerRows(payload: unknown): Presented {
  const rows = listFrom(payload, ['keys', 'apiKeys']).map((item) => {
    const row = record(item);
    return [text(row.name, 'Unnamed key'), text(row.key_prefix, 'Hidden'), when(row.created_at)];
  });
  return {
    headers: ['Name', 'Prefix', 'Created at'],
    rows,
    notes: rows.length
      ? ['Only the prefix is shown. The secret is not stored in this page.']
      : ['No API keys are stored. This page does not create one on its own.'],
  };
}
