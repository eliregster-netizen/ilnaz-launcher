import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config';
import { getActiveUser } from '../../utils/auth';
import './NewsSection.css';

const NewsSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const user = getActiveUser();
  const isOwner = user?.role === 'owner';

  const load = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/news`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load news:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getToken = () => localStorage.getItem('ilnaz-token');

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `${getApiUrl()}/news/${editing.id}` : `${getApiUrl()}/news`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    if (data.success) {
      setTitle('');
      setContent('');
      setShowForm(false);
      setEditing(null);
      load();
    }
  };

  const del = async (id) => {
    if (!confirm('Удалить новость?')) return;
    const res = await fetch(`${getApiUrl()}/news/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (data.success) load();
  };

  const edit = (item) => {
    setTitle(item.title);
    setContent(item.content);
    setEditing(item);
    setShowForm(true);
  };

  const uploadFile = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${getApiUrl()}/news/${id}/attach`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json();
    if (data.success) load();
    setUploading(false);
    e.target.value = '';
  };

  const getAuthorName = (item) => item.authorName || 'Owner';

  return (
    <div className="news-section fade-in fade-in-delay-1">
      <div className="news-header">
        <h2 className="section-title">Новости</h2>
        {isOwner && !showForm && (
          <button className="news-add-btn" onClick={() => { setEditing(null); setTitle(''); setContent(''); setShowForm(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Новая новость
          </button>
        )}
      </div>

      {showForm && isOwner && (
        <div className="news-form glass">
          <input className="news-form-input" placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="news-form-textarea" placeholder="Текст новости..." rows={4} value={content} onChange={e => setContent(e.target.value)} />
          <div className="news-form-actions">
            <button className="news-btn news-btn-primary" onClick={submit}>{editing ? 'Сохранить' : 'Опубликовать'}</button>
            <button className="news-btn" onClick={() => { setShowForm(false); setEditing(null); }}>Отмена</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="news-loading">Загрузка новостей...</div>
      ) : items.length === 0 ? (
        <div className="news-empty">Новостей пока нет</div>
      ) : (
        <div className="news-list">
          {items.map(item => (
            <div key={item.id} className="news-card glass">
              <div className="news-card-header">
                <h3 className="news-card-title">{item.title}</h3>
                <div className="news-card-meta">
                  <span className="news-card-author">{getAuthorName(item)}</span>
                  <span className="news-card-date">{new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="news-card-content">{item.content}</div>
              {item.attachments?.length > 0 && (
                <div className="news-card-attachments">
                  {item.attachments.map((att, i) => (
                    att.mimetype?.startsWith('image/') ? (
                      <img key={i} src={att.url} alt={att.filename} className="news-attach-img" loading="lazy" />
                    ) : (
                      <a key={i} href={att.url} target="_blank" rel="noopener" className="news-attach-file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {att.filename}
                      </a>
                    )
                  ))}
                </div>
              )}
              {isOwner && (
                <div className="news-card-actions">
                  <button className="news-btn news-btn-sm" onClick={() => edit(item)}>✏️</button>
                  <button className="news-btn news-btn-sm news-btn-danger" onClick={() => del(item.id)}>🗑️</button>
                  <label className="news-btn news-btn-sm news-btn-attach">
                    📎
                    <input type="file" style={{ display: 'none' }} onChange={e => uploadFile(e, item.id)} disabled={uploading} />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsSection;
