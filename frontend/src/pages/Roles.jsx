import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    Plus, Edit2, Trash2, Search, Loader2, Eye, Save, Globe, Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import MobileRoleCard from '../components/MobileRoleCard';
import GlobalSlideOver from '../components/GlobalSlideOver';
import { TableElementStyle
} from '../styles/tableStyles';
import { formatDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

const Roles = () => {
    const { user: currentUserData } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRole, setCurrentRole] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        permissions: [],
        allowedPages: [],
        webAccess: true,
        mobileAccess: true
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
        { id: 'vision', label: 'Buddy Vision' },
        { id: 'knowledge', label: 'Knowledge Base' },
        { id: 'automations', label: 'Automations' },
        { id: 'reminders', label: 'My Reminders' },
        { id: 'memories', label: 'Buddy Memory' },
        { id: 'settings', label: 'Settings' },
        { id: 'users', label: 'Users Management' },
        { id: 'roles', label: 'Role Management' },
        { id: 'management', label: 'Admin Management' }
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

    // Unified fetch on mount and search
    useEffect(() => {
        const delay = searchTerm === '' ? 0 : 500;
        const timeoutId = setTimeout(() => {
            fetchRoles(1);
        }, delay);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    useEffect(() => {
        const handleGlobalSearch = (e) => {
            setSearchTerm(e.detail);
        };
        window.addEventListener('buddy-search', handleGlobalSearch);
        return () => window.removeEventListener('buddy-search', handleGlobalSearch);
    }, []);

    const handleOpenModal = (role = null, isView = false) => {
        setIsViewMode(isView);
        if (role) {
            setCurrentRole(role);
            setFormData({
                name: role.name || '',
                permissions: role.permissions || [],
                allowedPages: role.allowedPages || [],
                webAccess: role.webAccess !== undefined ? role.webAccess : true,
                mobileAccess: role.mobileAccess !== undefined ? role.mobileAccess : true
            });
        } else {
            setCurrentRole(null);
            setFormData({
                name: '',
                permissions: [],
                allowedPages: [],
                webAccess: true,
                mobileAccess: true
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
                // Refresh the current page from the backend
                if (roles.length === 1 && pagination.currentPage > 1) {
                    fetchRoles(pagination.currentPage - 1);
                } else {
                    fetchRoles(pagination.currentPage);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    // Search is now handled on the backend
    const filteredRoles = roles;

    return (
        <div style={{ color: 'var(--text-main)' }} className="roles-page">
            <div className="table-container">
                <div className="search-management-header">
                    <div className="buddy-search-box hide-on-mobile">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search roles..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                    <button
                        className="btn btn-primary mobile-fab"
                        onClick={() => handleOpenModal()}
                    >
                        <Plus size={20} />
                        <span className="hide-mobile-text">Add Role</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper desktop-table-view">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }} className="buddy-th hide-mobile-th">S.No</th>
                                <th style={{ textAlign: 'center', minWidth: '150px' }} className="buddy-th">Role Name</th>
                                <th style={{ minWidth: '200px' }} className="buddy-th">Access Permissions</th>
                                <th className="buddy-th hide-on-tablet">Created Date</th>
                                <th style={{ width: '100px' }} className="buddy-th">Actions</th>
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
                                        whileHover={{ backgroundColor: 'var(--row-hover)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ borderLeft: 'none', textAlign: 'center', padding: '18px 10px' }} className="buddy-td hide-mobile-td">{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ textAlign: 'center' }} data-label="Role" className="buddy-td">
                                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{role.name}</div>
                                            <div className="show-on-tablet" style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                                                {formatDate(role.createdAt, currentUserData?.dateFormat)}
                                            </div>
                                        </td>
                                        <td style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Access" className="buddy-td">
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                color: role.permissions?.length > 0 ? '#1E40AF' : 'var(--text-sub)',
                                                background: role.permissions?.length > 0 ? '#EFF6FF' : 'var(--bg-lite)',
                                                padding: '4px 12px',
                                                borderRadius: '4px',
                                                border: '1px solid',
                                                borderColor: role.permissions?.length > 0 ? '#DBEAFE' : 'var(--border-color)',
                                                display: 'inline-block',
                                                textTransform: 'uppercase'
                                            }}>
                                                {role.permissions?.length || 0} {role.permissions?.length === 1 ? 'Page' : 'Pages'}
                                            </span>
                                        </td>
                                        <td className="buddy-td hide-on-tablet" data-label="Created">
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                                {formatDate(role.createdAt, currentUserData?.dateFormat)}
                                            </div>
                                        </td>
                                        <td style={{ borderLeft: 'none' }} className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(role, true)}
                                                    title="View"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--success-color)', background: 'color-mix(in srgb, var(--success-color) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--success-color) 15%, transparent)' }}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(role)}
                                                    title="Edit"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--info-color)', background: 'color-mix(in srgb, var(--info-color) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--info-color) 15%, transparent)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {!role.isSystem && (
                                                    <button
                                                        onClick={() => handleDeleteClick(role._id)}
                                                        title="Delete"
                                                        className="btn btn-icon btn-sm"
                                                        style={{ color: 'var(--danger-color)', background: 'color-mix(in srgb, var(--danger-color) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--danger-color) 15%, transparent)' }}
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

                {/* Mobile Card View */}
                <div className="mobile-card-view">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                        </div>
                    ) : filteredRoles.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-sub)' }}>
                            No roles found.
                        </div>
                    ) : (
                        filteredRoles.map(role => (
                            <MobileRoleCard
                                key={role._id}
                                role={role}
                                onView={() => handleOpenModal(role, true)}
                                onEdit={() => handleOpenModal(role)}
                                onDelete={() => handleDeleteClick(role._id)}
                            />
                        ))
                    )}
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <GlobalSlideOver
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={isViewMode ? 'View Role' : (currentRole ? 'Edit Role' : 'New Role')}
                width="600px" // Wider for roles with permissions grid
                actionButton={!isViewMode ? {
                    label: 'Save Role',
                    icon: <Save size={18} />,
                    onClick: handleSubmit
                } : null}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>ROLE NAME</label>
                            <input
                                className="input"
                                required
                                disabled={isViewMode || currentRole?.isSystem}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-lite)',
                                    color: 'var(--text-main)',
                                    fontSize: '1rem'
                                }}
                            />
                            {currentRole?.isSystem && !isViewMode && <span className="form-hint" style={{ color: '#eab308', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>System role name cannot be changed</span>}
                        </div>

                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>PLATFORM ACCESS CONTROL</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
                                {/* Web Access Toggle */}
                                <div
                                    onClick={() => {
                                        if (isViewMode) return;
                                        setFormData({ ...formData, webAccess: !formData.webAccess });
                                    }}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '16px',
                                        background: formData.webAccess ? 'color-mix(in srgb, var(--success-color) 10%, transparent)' : 'var(--bg-lite)',
                                        border: `1px solid ${formData.webAccess ? 'var(--success-color)' : 'var(--border-color)'}`,
                                        cursor: isViewMode ? 'default' : 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{
                                            padding: '8px',
                                            borderRadius: '10px',
                                            background: formData.webAccess ? 'var(--success-color)' : 'var(--text-sub)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Globe size={18} />
                                        </div>
                                        <div style={{
                                            width: '36px',
                                            height: '20px',
                                            borderRadius: '20px',
                                            background: formData.webAccess ? 'var(--success-color)' : 'var(--text-sub)',
                                            position: 'relative',
                                            opacity: isViewMode ? 0.6 : 1,
                                            transition: 'all 0.3s'
                                        }}>
                                            <div style={{
                                                width: '14px',
                                                height: '14px',
                                                borderRadius: '50%',
                                                background: 'white',
                                                position: 'absolute',
                                                top: '3px',
                                                left: formData.webAccess ? '19px' : '3px',
                                                transition: 'all 0.3s'
                                            }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: formData.webAccess ? 'var(--success-color)' : 'var(--text-main)' }}>Website App</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>{formData.webAccess ? 'Access Enabled' : 'Access Restricted'}</div>
                                    </div>
                                </div>

                                {/* Mobile Access Toggle */}
                                <div
                                    onClick={() => {
                                        if (isViewMode) return;
                                        setFormData({ ...formData, mobileAccess: !formData.mobileAccess });
                                    }}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '16px',
                                        background: formData.mobileAccess ? 'color-mix(in srgb, var(--info-color) 10%, transparent)' : 'var(--bg-lite)',
                                        border: `1px solid ${formData.mobileAccess ? 'var(--info-color)' : 'var(--border-color)'}`,
                                        cursor: isViewMode ? 'default' : 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{
                                            padding: '8px',
                                            borderRadius: '10px',
                                            background: formData.mobileAccess ? 'var(--info-color)' : 'var(--text-sub)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Smartphone size={18} />
                                        </div>
                                        <div style={{
                                            width: '36px',
                                            height: '20px',
                                            borderRadius: '20px',
                                            background: formData.mobileAccess ? 'var(--info-color)' : 'var(--text-sub)',
                                            position: 'relative',
                                            opacity: isViewMode ? 0.6 : 1,
                                            transition: 'all 0.3s'
                                        }}>
                                            <div style={{
                                                width: '14px',
                                                height: '14px',
                                                borderRadius: '50%',
                                                background: 'white',
                                                position: 'absolute',
                                                top: '3px',
                                                left: formData.mobileAccess ? '19px' : '3px',
                                                transition: 'all 0.3s'
                                            }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: formData.mobileAccess ? 'var(--info-color)' : 'var(--text-main)' }}>Mobile App</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>{formData.mobileAccess ? 'Access Enabled' : 'Access Restricted'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>PAGE ACCESS CONTROL</label>
                            <div className="permissions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
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
                                            style={{
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                background: isChecked ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'var(--bg-lite)',
                                                border: `1px solid ${isChecked ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                cursor: isViewMode ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                transition: 'all 0.2s',
                                                opacity: isViewMode && !isChecked ? 0.6 : 1
                                            }}
                                        >
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '6px',
                                                border: `2px solid ${isChecked ? 'var(--primary-color)' : 'var(--text-sub)'}`,
                                                background: isChecked ? 'var(--primary-color)' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}>
                                                {isChecked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                            </div>
                                            <span style={{ fontSize: '0.95rem', fontWeight: isChecked ? '600' : '500', color: isChecked ? 'var(--primary-color)' : 'var(--text-main)' }}>
                                                {page.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {!isViewMode && (
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Save size={18} />
                                {currentRole ? 'Update Role' : 'Create Role'}
                            </button>
                        </div>
                    )}
                </form>
            </GlobalSlideOver>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Role"
                message="Are you sure you want to delete this role? This action cannot be undone and may affect users assigned to this role."
                confirmText="Delete Role"
            />

        </div>
    );
};

export default Roles;
