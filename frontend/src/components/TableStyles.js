/**
 * Global Table Styles - Vision UI Pro Aesthetic
 * These styles are used across Users, Roles, and other management pages.
 */

export const ThStyle = {
    padding: '12px 24px',
    color: 'var(--th-text)',
    fontSize: '0.7rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'center',
    background: 'var(--th-bg)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-color)',
    transition: 'all 0.1s ease'
};

export const TdStyle = {
    padding: '14px 24px',
    color: 'var(--text-main)',
    textAlign: 'center',
    fontSize: '0.875rem',
    fontWeight: '500',
    borderBottom: '1px solid var(--border-color)',
    transition: 'all 0.1s ease',
};

export const TableRowStyle = (isActive = false) => ({
    background: isActive ? 'var(--row-hover)' : 'transparent',
    transition: 'all 0.1s ease',
    cursor: 'default'
});

export const ActionButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-lite)',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    color: 'var(--text-sub)',
};

export const TableContainerStyle = {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)',
    padding: '24px',
    boxShadow: 'var(--card-shadow)',
    transition: 'all 0.2s ease',
    overflow: 'hidden'
};

export const TableElementStyle = {
    width: '100%',
    borderCollapse: 'collapse',
};

export const SearchBoxStyle = {
    position: 'relative',
    maxWidth: '400px',
    marginBottom: '20px',
};

export const SearchInputStyle = {
    width: '100%',
    padding: '10px 16px 10px 40px',
    background: 'var(--bg-lite)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-main)',
    outline: 'none',
    transition: 'border-color 0.1s ease',
};

export const PaginationContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: 'var(--bg-lite)',
    borderTop: '1px solid var(--border-color)',
};

export const PaginationInfoStyle = {
    color: 'var(--text-sub)',
    fontSize: '0.8rem',
    fontWeight: '600'
};

export const PaginationGroupStyle = {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
};

export const PaginationButtonStyle = (isActive = false, isDisabled = false) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    height: '32px',
    padding: '0 10px',
    borderRadius: 'var(--radius-sm)',
    border: isActive ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
    background: isActive ? 'var(--primary-color)' : 'var(--bg-lite)',
    color: isActive ? 'white' : 'var(--text-main)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.1s ease',
});

