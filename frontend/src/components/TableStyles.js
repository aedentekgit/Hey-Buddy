/**
 * Global Table Styles - Vision UI Pro Aesthetic
 * These styles are used across Users, Roles, and other management pages.
 */

export const ThStyle = {
    padding: '18px 24px',
    color: 'var(--th-text)', // Dynamic Text Color
    fontSize: '0.7rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    textAlign: 'center',
    background: 'var(--th-bg)', // Dynamic based on light/dark mode
    whiteSpace: 'nowrap',
    borderBottom: 'var(--th-border)', // Dynamic border (none for capsule style, solid for grid)
    transition: 'all 0.3s ease'
};

export const TdStyle = {
    padding: '18px 24px',
    color: 'var(--text-main)',
    textAlign: 'center',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
    transition: 'all 0.2s ease',
};

// New shared row style for components to use
export const TableRowStyle = (isActive = false) => ({
    background: isActive ? 'color-mix(in srgb, var(--primary-color) 5%, transparent)' : 'transparent',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default'
});

export const ActionButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-lite)',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: 'var(--text-sub)',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
};

export const TableContainerStyle = {
    background: 'var(--card-bg)',
    borderRadius: '30px',
    border: '1px solid var(--border-color)',
    padding: '32px',
    boxShadow: 'var(--card-shadow)',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    backdropFilter: 'blur(20px) saturate(180%)',
    position: 'relative'
};

export const TableElementStyle = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0'
};

export const SearchBoxStyle = {
    position: 'relative',
    maxWidth: '400px',
    marginBottom: '32px',
    transition: 'all 0.3s ease'
};

export const SearchInputStyle = {
    width: '100%',
    padding: '12px 18px 12px 42px',
    background: 'color-mix(in srgb, var(--primary-color) 4%, var(--bg-lite))',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-main)',
    outline: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(20px)',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
};

// Pagination Styles
export const PaginationContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    background: 'var(--th-bg)',
    borderTop: '1px solid var(--border-color)',
    marginTop: '0'
};

export const PaginationInfoStyle = {
    color: 'var(--text-sub)',
    fontSize: '0.85rem',
    fontWeight: '500'
};

export const PaginationGroupStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
};

export const PaginationButtonStyle = (isActive = false, isDisabled = false) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    border: isActive ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
    background: isActive ? 'var(--primary-color)' : 'var(--bg-lite)',
    color: isActive ? 'white' : 'var(--text-main)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isActive ? '0 4px 12px rgba(var(--primary-rgb), 0.3)' : 'none'
});

