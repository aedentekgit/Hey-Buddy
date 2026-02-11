import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast, Toaster } from 'react-hot-toast';
import {
    Plus, Edit2, Trash2, Search, X, Loader2, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle, TableRowStyle
} from '../components/TableStyles';

const Roles = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRole, setCurrentRole] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        permissions: [],
        allowedPages: []
    });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [isViewMode, setIsViewMode] = useState(false);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        total: 0,
        limit: 10
    });

    const AVAILABLE_PAGES = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'buddy', label: 'Buddy AI' },
        { id: 'reminders', label: 'My Reminders' },
        { id: 'memories', label: 'Buddy Memory' },
        { id: 'settings', label: 'Settings' },
        { id: 'users', label: 'Users Management' },
        { id: 'roles', label: 'Role Management' }
    ];

    const fetchRoles = async (page = 1) => {
        try {
            setLoading(true);
            const res = await api.get(`/roles?page=${page}&limit=${pagination.limit}&search=${searchTerm}`);
            if (res.data.success) {
                setRoles(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Fetch roles failed:', error);
            const message = error.response?.data?.message || 'Failed to load roles';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        fetchRoles(newPage);
    };

    useEffect(() => {
        fetchRoles(1);
    }, []);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchRoles(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const handleOpenModal = (role = null, isView = false) => {
        setIsViewMode(isView);
        if (role) {
            setCurrentRole(role);
            setFormData({
                name: role.name || '',
                permissions: role.permissions || [],
                allowedPages: role.allowedPages || []
            });
        } else {
            setCurrentRole(null);
            setFormData({
                name: '',
                permissions: [],
                allowedPages: []
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentRole(null);
        setIsViewMode(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const toastId = toast.loading(currentRole ? 'Updating...' : 'Creating...');
        try {
            if (currentRole) {
                const res = await api.put(`/roles/${currentRole._id}`, formData);
                if (res.data.success) {
                    toast.success('Role updated', { id: toastId });
                    fetchRoles();
                    handleCloseModal();
                }
            } else {
                const res = await api.post('/roles', formData);
                if (res.data.success) {
                    toast.success('Role created', { id: toastId });
                    fetchRoles();
                    handleCloseModal();
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed', { id: toastId });
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const handleDelete = async () => {
        const id = deleteModal.id;
        if (!id) return;

        try {
            const res = await api.delete(`/roles/${id}`);
            if (res.data.success) {
                toast.success('Role deleted');
                fetchRoles();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    // Search is now handled on the backend
    const filteredRoles = roles;

    return (
        <div style={{ color: 'var(--text-main)' }} className="roles-page">
            <Toaster position="top-right" />

            <div className="table-container">
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ ...SearchBoxStyle, marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                        <input
                            type="text"
                            placeholder="Search roles..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={SearchInputStyle}
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleOpenModal()}
                    >
                        <Plus size={20} />
                        <span className="hide-mobile-text">Add Role</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '50px', borderRadius: '12px 0 0 12px' }} className="hide-mobile-th">S.No</th>
                                <th style={{ ...ThStyle, textAlign: 'left', minWidth: '150px' }}>Role Name</th>
                                <th style={{ ...ThStyle, minWidth: '200px' }}>Access Permissions</th>
                                <th style={ThStyle} className="hide-on-tablet">Created Date</th>
                                <th style={{ ...ThStyle, width: '100px', borderRadius: '0 12px 12px 0' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                                    </td>
                                </tr>
                            ) : filteredRoles.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>
                                        No roles found.
                                    </td>
                                </tr>
                            ) : (
                                filteredRoles.map((role, index) => (
                                    <motion.tr
                                        key={role._id}
                                        whileHover={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }}
                                        style={TableRowStyle()}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ ...TdStyle, borderLeft: 'none', textAlign: 'center', padding: '18px 10px' }} className="hide-mobile-td">{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ ...TdStyle, textAlign: 'left' }} data-label="Role">
                                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{role.name}</div>
                                            <div className="show-on-tablet" style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                                                {new Date(role.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Access">
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '800',
                                                color: role.permissions?.length > 0 ? 'var(--primary-glow)' : 'var(--text-sub)',
                                                background: role.permissions?.length > 0 ? 'color-mix(in srgb, var(--primary-color) 15%, transparent)' : 'var(--bg-lite)',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                border: '1px solid',
                                                borderColor: role.permissions?.length > 0 ? 'color-mix(in srgb, var(--primary-color) 30%, transparent)' : 'var(--border-color)',
                                                display: 'inline-block',
                                                textTransform: 'uppercase'
                                            }}>
                                                {role.permissions?.length || 0} {role.permissions?.length === 1 ? 'Page' : 'Pages'}
                                            </span>
                                        </td>
                                        <td style={TdStyle} className="hide-on-tablet" data-label="Created">
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                                {new Date(role.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none' }} className="mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(role, true)}
                                                    title="View"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(role)}
                                                    title="Edit"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--info-color)', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {!role.isSystem && (
                                                    <button
                                                        onClick={() => handleDeleteClick(role._id)}
                                                        title="Delete"
                                                        className="btn btn-icon btn-sm"
                                                        style={{ color: 'var(--danger-color)', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="modal-backdrop" onClick={handleCloseModal}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3 className="modal-title">
                                    {isViewMode ? 'View Role' : (currentRole ? 'Edit Role' : 'New Role')}
                                </h3>
                                <button onClick={handleCloseModal} className="modal-close">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">ROLE NAME</label>
                                        <input className="input" required disabled={isViewMode || currentRole?.isSystem} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        {currentRole?.isSystem && !isViewMode && <span className="form-hint" style={{ color: '#eab308' }}>System role name cannot be changed</span>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">PAGE ACCESS CONTROL</label>
                                        <div className="permissions-grid">
                                            {AVAILABLE_PAGES.map(page => {
                                                const isChecked = formData.allowedPages?.includes(page.id);
                                                return (
                                                    <div
                                                        key={page.id}
                                                        onClick={() => {
                                                            if (isViewMode) return;
                                                            const newPages = isChecked
                                                                ? formData.allowedPages.filter(p => p !== page.id)
                                                                : [...formData.allowedPages, page.id];
                                                            const newPerms = isChecked
                                                                ? formData.permissions.filter(p => p !== page.id)
                                                                : [...formData.permissions, page.id];
                                                            setFormData({ ...formData, allowedPages: newPages, permissions: newPerms });
                                                        }}
                                                        className={`permission-item ${isChecked ? 'active' : ''}`}
                                                        style={{
                                                            cursor: isViewMode ? 'default' : 'pointer',
                                                            opacity: isViewMode && !isChecked ? 0.6 : 1
                                                        }}
                                                    >
                                                        <div className={`checkbox ${isChecked ? 'active' : ''}`}>
                                                            {isChecked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                        </div>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: isChecked ? '600' : '500', color: isChecked ? 'var(--primary-500)' : 'var(--text-main)' }}>
                                                            {page.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="btn btn-secondary"
                                    >
                                        {isViewMode ? 'Close' : 'Cancel'}
                                    </button>
                                    {!isViewMode && (
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                        >
                                            Save Role
                                        </button>
                                    )}
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Role"
                message="Are you sure you want to delete this role? This action cannot be undone and may affect users assigned to this role."
                confirmText="Delete Role"
            />

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .permissions-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }

                .permission-item {
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-color);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                }

                .permission-item.active {
                    border-color: var(--primary-color);
                    background: color-mix(in srgb, var(--primary-color) 5%, transparent);
                }

                .checkbox {
                    width: 18px;
                    height: 18px;
                    border-radius: 4px;
                    border: 2px solid var(--text-sub);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .checkbox.active {
                    border-color: var(--primary-color);
                    background: var(--primary-color);
                }

                .show-mobile-text { display: none; }
                .show-on-tablet { display: none; }

                @media (max-width: 640px) {
                    .table-wrapper table, 
                    .table-wrapper thead, 
                    .table-wrapper tbody, 
                    .table-wrapper th, 
                    .table-wrapper td, 
                    .table-wrapper tr {
                        display: block;
                    }

                    .table-wrapper thead tr {
                        position: absolute;
                        top: -9999px;
                        left: -9999px;
                    }

                    .mobile-stacked-row {
                        background: linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
                        border: 1px solid rgba(255, 255, 255, 0.05) !important;
                        border-radius: 24px !important;
                        padding: 20px !important;
                        margin-bottom: 24px !important;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
                        backdrop-filter: blur(10px);
                        position: relative;
                        overflow: hidden;
                    }

                    /* Add a subtle highlight accent */
                    .mobile-stacked-row::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 4px;
                        height: 100%;
                        background: var(--primary-color);
                        opacity: 0.5;
                    }

                    .table-wrapper td {
                        border: none !important;
                        padding: 12px 0 !important;
                        position: relative;
                        text-align: left !important;
                        width: 100% !important;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 16px;
                        min-height: auto !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
                    }

                    .table-wrapper td:last-child {
                        border-bottom: none !important;
                    }

                    .table-wrapper td::before {
                        content: attr(data-label);
                        font-size: 0.75rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: var(--text-sub);
                        min-width: 100px;
                        opacity: 0.8;
                    }

                    /* Make the value text aligned to the right */
                    .table-wrapper td > * {
                        text-align: right;
                        flex: 1;
                        display: flex;
                        justify-content: flex-end;
                    }
                    
                    /* Specific adjustment for Role Name */
                    .table-wrapper td[data-label="Role"] > div {
                        width: 100%;
                    }

                    .hide-mobile-th, .hide-mobile-td {
                        display: none !important;
                    }

                    .mobile-actions-cell {
                        margin-top: 8px;
                        padding-top: 20px !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
                        justify-content: center !important;
                        gap: 16px !important;
                    }

                    .mobile-actions-cell::before {
                        display: none; /* Hide label for actions */
                    }
                    
                    /* Custom Button Styles for Mobile Actions */
                    .mobile-actions-cell .btn-icon {
                        width: 42px;
                        height: 42px;
                        border-radius: 12px;
                    }

                    .hide-on-tablet {
                        display: flex !important;
                    }

                    .table-container {
                        background: transparent !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 16px !important;
                    }
                    
                    .table-wrapper {
                        padding: 0 4px;
                        overflow-x: visible !important;
                    }

                    /* Ensure text breaks properly */
                    .table-wrapper td div {
                        word-break: break-word;
                    }
                }

                @media (max-width: 768px) {
                    .hide-on-mobile { display: none !important; }
                    .hide-on-tablet { display: none !important; }
                    .show-on-tablet { display: block; }
                    /* th, td { padding: 12px 10px !important; } Remove this as it conflicts with the mobile styles */
                    .hide-mobile-text { display: none; }
                    .show-mobile-text { display: inline-block; }
                    .permissions-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 480px) {
                    td, th {
                        padding: 12px 4px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Roles;
