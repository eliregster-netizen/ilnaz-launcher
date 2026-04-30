import { useState } from 'react';
import { login, register } from '../../utils/auth';
import logo from '../../assets/logo.png';
import './Auth.css';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(username, password);
        if (result.success) {
          onLogin(result.user);
        } else {
          setError(result.error);
        }
      } else {
        if (password.length < 3) {
          setError('Пароль минимум 3 символа');
          return;
        }
        const result = await register(username, password, nickname || username);
        if (result.success) {
          onLogin(result.user);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-effects">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>
      <div className="auth-card glass fade-in">
        <div className="auth-logo">
          <img src={logo} className="logo-icon-large" alt="Logo" />
          <h1 className="auth-title">ILNAZ</h1>
        </div>
        <h2 className="auth-subtitle">GAMING LAUNCHER</h2>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Вход
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Регистрация
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              className="auth-input"
              type="text"
              placeholder="Никнейм (отображаемое имя)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          )}
          <input
            className="auth-input"
            type="text"
            placeholder="Имя пользователя (логин)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button className="auth-switch" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
