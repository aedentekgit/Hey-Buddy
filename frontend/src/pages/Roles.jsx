import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast, Toaster } from 'react-hot-toast';
import {
    Plus, Edit2, Trash2, Search, X, Loader2, Shield, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';

import Pagination from '../components/Pagination';

import {
    ThStyle, TdStyle, ActionButtonStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle, TableRowStyle
} from '../components/TableStyles';

const ModalOverlay = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
};

const ModalBackground = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)'
};

const ModalContent = {
    position: 'relative',
    width: '100%',
    maxWidth: '500px',
    background: 'var(--card-bg)',
    borderRadius: '30px',
    boxShadow: 'var(--card-shadow)',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    backdropFilter: 'blur(20px)'
};

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

            <div style={TableContainerStyle} className="table-responsive-container">
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
                        className="btn-primary"
                        onClick={() => handleOpenModal()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '10px 20px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Plus size={20} />
                        <span className="hide-mobile-text">Add Role</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '50px', borderRadius: '12px 0 0 12px' }}>S.No</th>
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
                                    >
                                        <td style={{ ...TdStyle, borderLeft: 'none', textAlign: 'center', padding: '18px 10px' }}>{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ ...TdStyle, textAlign: 'left' }}>
                                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{role.name}</div>
                                            <div className="show-on-tablet" style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                                                {new Date(role.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }}>
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
                                        <td style={TdStyle} className="hide-on-tablet">
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                                {new Date(role.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(role, true)}
                                                    title="View"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <Eye size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(role)}
                                                    title="Edit"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: 'var(--primary-glow)', background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--primary-color) 20%, transparent)' }}
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                {!role.isSystem && (
                                                    <button
                                                        onClick={() => handleDeleteClick(role._id)}
                                                        title="Delete"
                                                        style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                    >
                                                        <Trash2 size={12} />
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
                    <div style={ModalOverlay}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseModal} style={ModalBackground} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="responsive-modal">
                            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-color)' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>
                                    {isViewMode ? 'View Role' : (currentRole ? 'Edit Role' : 'New Role')}
                                </h3>
                                <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)' }}><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label className="modal-label">ROLE NAME</label>
                                    <input className="modal-input" required disabled={isViewMode || currentRole?.isSystem} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    {currentRole?.isSystem && !isViewMode && <span style={{ fontSize: '0.7rem', color: '#eab308', marginTop: '4px' }}>System role name cannot be changed</span>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className="modal-label">PAGE ACCESS CONTROL</label>
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
                                                    <span style={{ fontSize: '0.9rem', fontWeight: isChecked ? '600' : '500', color: isChecked ? 'var(--primary-color)' : 'var(--text-main)' }}>
                                                        {page.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexDirection: window.innerWidth < 480 ? 'column' : 'row' }}>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            background: 'transparent',
                                            color: 'var(--text-sub)',
                                            fontWeight: '600'
                                        }}
                                        className="btn-outline"
                                    >
                                        {isViewMode ? 'Close' : 'Cancel'}
                                    </button>
                                    {!isViewMode && (
                                        <button
                                            type="submit"
                                            style={{ flex: 1 }}
                                            className="btn-primary"
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
                
                .table-wrapper {
                    overflow-x: auto;
                    width: 100%;
                }

                .modal-label {
                    font-size: 0.75rem; 
                    color: var(--text-sub); 
                    text-transform: uppercase; 
                    font-weight: 700; 
                    letter-spacing: 0.05em; 
                    display: block; 
                    margin-bottom: 4px;
                }

                .modal-input {
                    width: 100%; 
                    padding: 12px 16px; 
                    border-radius: 12px;
                    background: var(--bg-lite); 
                    border: 1px solid var(--border-color);
                    color: var(--text-main); 
                    font-size: 14px; 
                    outline: none;
                }

                .responsive-modal {
                    position: relative;
                    width: 100%;
                    max-width: 500px;
                    background: var(--card-bg);
                    border-radius: 24px;
                    box-shadow: var(--card-shadow);
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                    backdrop-filter: blur(20px);
                }

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

                @media (max-width: 768px) {
                    .table-responsive-container {
                        padding: 16px !important;
                    }
                    .hide-on-mobile { display: none !important; }
                    .hide-on-tablet { display: none !important; }
                    .show-on-tablet { display: block; }
                    th, td { padding: 12px 10px !important; }
                    .responsive-modal {
                        width: 95%;
                    }
                    .hide-mobile-text { display: none; }
                    .show-mobile-text { display: inline-block; }
                    .permissions-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 480px) {
                    .table-responsive-container {
                        border-radius: 16px !important;
                    }
                    td, th {
                        padding: 12px 8px !important;
                    }
                    .responsive-modal {
                        padding-bottom: 20px;
                    }
                }
            `}</style>
        </div >
    );
};

export default Roles;
