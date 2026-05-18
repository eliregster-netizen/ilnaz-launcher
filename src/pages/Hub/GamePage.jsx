import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchGame, incrementPlay, incrementDownload, rateGame, fetchComments, postComment, deleteComment, toggleLike, deleteGame } from '../../utils/hubApi';
import { getActiveUser, isAdmin } from '../../utils/auth';
import './GamePage.css';

const GamePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');
  const [rateError, setRateError] = useState('');
  const viewCountedRef = useRef(false);

  const user = getActiveUser();
  const admin = isAdmin();
  const isOwner = user && game && game.developerId === user.id;

  useEffect(() => {
    loadGame();
  }, [slug]);

  useEffect(() => {
    if (game && !viewCountedRef.current) {
      viewCountedRef.current = true;
      incrementPlay(game.id).catch(() => {});
    }
  }, [game]);

  const loadGame = async () => {
    setLoading(true);
    const data = await fetchGame(slug);
    if (data.game) {
      setGame(data.game);
      setUserRating(data.game.userRating || 0);
      setIsLiked(data.game.isLiked || false);
      setLikeCount(data.game.likeCount || 0);
      loadComments(data.game.id);
    } else {
      setError('Игра не найдена');
    }
    setLoading(false);
  };

  const loadComments = async (gameId) => {
    const data = await fetchComments(gameId);
    if (Array.isArray(data)) setComments(data);
  };

  const handlePlay = async () => {
    if (game?.webUrl) {
      incrementPlay(game.id);
      window.open(game.webUrl, '_blank');
    }
  };

  const handleDownload = async () => {
    if (game?.downloadUrl) {
      incrementDownload(game.id);
      window.open(game.downloadUrl, '_blank');
    }
  };

  const handleRate = async (rating) => {
    if (!user) return;
    if (game.developerId === user.id) return;
    setRateError('');
    const data = await rateGame(game.id, rating);
    if (data.success) {
      setUserRating(rating);
      setGame(prev => ({ ...prev, avgRating: data.avgRating, ratingCount: data.ratingCount }));
    } else {
      setRateError(data.error || 'Ошибка при оценке');
    }
  };

  const handleLike = async () => {
    if (!user) return;
    const data = await toggleLike(game.id);
    if (data.success) {
      setIsLiked(data.liked);
      setLikeCount(data.likeCount);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    const data = await postComment(game.id, commentText.trim());
    if (data.success) {
      setComments(prev => [data.comment, ...prev]);
      setCommentText('');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Удалить комментарий?')) return;
    await deleteComment(game.id, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const handleDeleteGame = async () => {
    if (!confirm('Удалить эту игру? Это действие нельзя отменить.')) return;
    await deleteGame(game.id);
    navigate('/hub');
  };

  if (loading) {
    return <div className="game-page fade-in"><div className="spinner" /><p className="game-loading">Загрузка...</p></div>;
  }

  if (error || !game) {
    return (
      <div className="game-page fade-in">
        <div className="game-error glass">
          <p>{error || 'Игра не найдена'}</p>
          <Link to="/hub" className="hub-btn outline">← Назад в Hub</Link>
        </div>
      </div>
    );
  }

  const isPending = game.status === 'pending_review';

  return (
    <div className="game-page fade-in">
      <div className="game-back">
        <Link to="/hub" className="game-back-link">← Game Hub</Link>
      </div>

      <div className={`game-cover-section ${isPending ? 'pending' : ''}`}>
        {game.coverUrl ? (
          <img src={game.coverUrl} alt={game.title} className="game-cover" />
        ) : (
          <div className="game-cover-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        {isPending && <div className="game-status-badge pending">На проверке</div>}
        {game.status === 'rejected' && <div className="game-status-badge rejected">Отклонено</div>}
        {game.status === 'published' && <div className="game-status-badge published">Опубликовано</div>}
      </div>

      <div className="game-content glass">
        <div className="game-header">
          <div>
            <h1 className="game-title">{game.title}</h1>
            <div className="game-meta">
              <span className="game-developer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <Link to={`/profile/${game.developerId}`}>{game.developerName}</Link>
              </span>
              <span className="game-genre">{game.genre}</span>
              {game.tags?.map(t => <span key={t} className="game-tag">{t}</span>)}
            </div>
          </div>
          <div className="game-actions-top">
            {(isOwner || admin) && (
              <>
                <Link to={`/hub/submit?edit=${game.id}`} className="hub-btn outline small">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Редактировать
                </Link>
                <button className="hub-btn outline small" onClick={handleDeleteGame} style={{ color: 'var(--danger)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Удалить
                </button>
              </>
            )}
          </div>
        </div>

        {game.shortDescription && (
          <p className="game-short-desc">{game.shortDescription}</p>
        )}

        <div className="game-description">
          {game.description.split('\n').map((line, i) => <p key={i}>{line}</p>)}
        </div>

        {game.screenshots?.length > 0 && (
          <div className="game-screenshots">
            <h3>Скриншоты</h3>
            <div className="screenshot-grid">
              {game.screenshots.map((url, i) => (
                <img key={i} src={url} alt={`Screenshot ${i + 1}`} loading="lazy" />
              ))}
            </div>
          </div>
        )}

        <div className="game-actions">
          {game.webUrl && (
            <button className="game-btn play" onClick={handlePlay}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Играть онлайн
            </button>
          )}
          {game.downloadUrl && (
            <button className="game-btn download" onClick={handleDownload}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Скачать
            </button>
          )}
        </div>

        <div className="game-stats-row">
          <div className="stat-item" onClick={handleLike}>
            <button className={`like-btn ${isLiked ? 'liked' : ''}`}>
              <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <span>{likeCount}</span>
          </div>

          <div className="stat-item">
            <span className="stat-value">{game.playCount}</span>
            <span className="stat-label">Просмотров</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{game.downloadCount}</span>
            <span className="stat-label">Загрузок</span>
          </div>
          <div className="stat-item rating-stars">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                className={`star-btn ${(hoverRating || userRating) >= star ? 'active' : ''}`}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleRate(star)}
                title={user ? `Оценить на ${star}` : 'Войдите чтобы оценить'}
              >
                ★
              </button>
            ))}
            <span className="rating-value">
              {game.avgRating > 0 ? game.avgRating : '—'}
              <span className="rating-count">({game.ratingCount})</span>
            </span>
          </div>
          {rateError && <div className="rate-error">{rateError}</div>}
        </div>
      </div>

      <div className="game-comments glass">
        <h3>Комментарии ({comments.length})</h3>
        {user ? (
          <form className="comment-form" onSubmit={handleComment}>
            <textarea
              placeholder="Написать комментарий..." value={commentText}
              onChange={(e) => setCommentText(e.target.value)} rows={3}
            />
            <button type="submit" className="hub-btn primary" disabled={!commentText.trim()}>Отправить</button>
          </form>
        ) : (
          <p className="comment-login-hint"><Link to="/">Войдите</Link>, чтобы оставить комментарий</p>
        )}
        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="no-comments">Комментариев пока нет</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="comment-item">
                <div className="comment-header">
                  <Link to={`/profile/${c.userId}`} className="comment-author">
                    {c.avatar ? <img src={c.avatar} alt="" className="comment-avatar" /> : <div className="comment-avatar-placeholder">{c.nickname?.charAt(0)}</div>}
                    <span>{c.nickname}</span>
                  </Link>
                  <div className="comment-meta">
                    <span className="comment-date">{new Date(c.createdAt).toLocaleDateString()}</span>
                    {(user && (c.userId === user.id || isAdmin())) && (
                      <button className="comment-delete" onClick={() => handleDeleteComment(c.id)}>✕</button>
                    )}
                  </div>
                </div>
                <p className="comment-content">{c.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GamePage;
