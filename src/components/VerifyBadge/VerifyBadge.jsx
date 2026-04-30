import './VerifyBadge.css';

const VerifyBadge = ({ role, size = 'sm' }) => {
  if (!role || (role !== 'owner' && role !== 'admin')) return null;

  return (
    <span className={`verify-badge ${role} size-${size}`} title={role === 'owner' ? 'Owner' : 'Admin'}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
      </svg>
    </span>
  );
};

export default VerifyBadge;
