import { useState, useEffect } from 'react';
import api from '../services/api';
import CustomSelect from '../components/CustomSelect';
import { toast, Toaster } from 'react-hot-toast';
import {
    UserPlus, Edit2, Trash2, Search, X, Loader2, User as UserIcon, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle, TableRowStyle
} from '../components/TableStyles';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'user'
    });

    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [isViewMode, setIsViewMode] = useState(false);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        total: 0,
        limit: 10
    });

    const validatePassword = (pass) => {
        if (!pass) return null;
        if (pass.length < 8) return 'Password must be at least 8 characters';
        if (!/\d/.test(pass)) return 'Password must contain at least one number';
        return null;
    };

    const fetchUsers = async (page = 1) => {
        try {
            setLoading(true);
            const res = await api.get(`/users?page=${page}&limit=${pagination.limit}&search=${searchTerm}&role=user`);
            if (res.data.success) {
                setUsers(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Fetch users failed:', error);
            const message = error.response?.data?.message || 'Failed to load users';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        fetchUsers(newPage);
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            if (res.data.success) {
                setRoles(res.data.data);
            }
        } catch (error) {
            console.error('Fetch roles failed:', error);
        }
    };

    useEffect(() => {
        fetchUsers(1);
        fetchRoles();
    }, []);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const handleOpenModal = (user = null, isView = false) => {
        setIsViewMode(isView);
        if (user) {
            setCurrentUser(user);
            setFormData({
                name: user.name || '',
                email: user.email || '',
                password: '',
                phone: user.phone || '',
                role: user.role || 'admin'
            });
        } else {
            setCurrentUser(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                role: 'user'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentUser(null);
        setIsViewMode(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Password Validation
        if (!currentUser && !formData.password) {
            toast.error("Password is required");
            return;
        }
        if (formData.password) {
            const error = validatePassword(formData.password);
            if (error) {
                toast.error(error);
                return;
            }
        }

        const toastId = toast.loading(currentUser ? 'Updating...' : 'Creating...');
        try {
            if (currentUser) {
                const res = await api.put(`/users/${currentUser._id}`, formData);
                if (res.data.success) {
                    toast.success('User updated', { id: toastId });
                    fetchUsers();
                    handleCloseModal();
                }
            } else {
                const res = await api.post('/users', formData);
                if (res.data.success) {
                    toast.success('User created', { id: toastId });
                    fetchUsers();
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
            const res = await api.delete(`/users/${id}`);
            if (res.data.success) {
                toast.success('User deleted');
                fetchUsers();
            }
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    // Search is now handled on the backend
    const filteredUsers = users;

    return (
        <div style={{ color: 'var(--text-main)' }} className="users-page">
            <Toaster position="top-right" />

            <div className="table-container">
                <div className="search-management-header">
                    <div className="buddy-search-box">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleOpenModal()}
                    >
                        <UserPlus size={20} />
                        <span className="hide-mobile-text">Add User</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '64px', textAlign: 'center' }} className="buddy-th hide-mobile-th">S.NO</th>
                                <th style={{ textAlign: 'center', minWidth: '220px' }} className="buddy-th">Admin Identity</th>
                                <th style={{ textAlign: 'center' }} className="buddy-th hide-on-tablet">Contact & Communications</th>
                                <th style={{ minWidth: '130px', textAlign: 'center' }} className="buddy-th">Access Level</th>
                                <th style={{ textAlign: 'center' }} className="buddy-th hide-on-mobile">Provisioned On</th>
                                <th style={{ width: '140px', textAlign: 'center' }} className="buddy-th">Management</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, index) => (
                                    <motion.tr
                                        key={user._id}
                                        whileHover={{ backgroundColor: 'var(--row-hover)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', fontWeight: '800', padding: '16px 10px' }} className="buddy-td hide-mobile-td">
                                            {(pagination.currentPage - 1) * pagination.limit + index + 1}
                                        </td>
                                        <td data-label="User" className="buddy-td">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                <div className="hide-on-mobile" style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    background: 'var(--bg-lite)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1px solid var(--border-color)',
                                                    flexShrink: 0
                                                }}>
                                                    <UserIcon size={14} color="var(--primary-color)" />
                                                </div>
                                                <div style={{ textAlign: 'center', minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem', lineHeight: '1.2' }}>
                                                        {user.name || (user.email === 'admin@example.com' ? 'System Administrator' : 'Pending Name')}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px', letterSpacing: '0.01em' }}>
                                                        ID: {user._id?.slice(-8).toUpperCase()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="buddy-td hide-on-tablet" data-label="Contact">
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>{user.email}</div>
                                            {user.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '1px' }}>{user.phone}</div>}
                                        </td>
                                        <td style={{ textAlign: 'center' }} data-label="Role" className="buddy-td">
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                background: user.role === 'admin' ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'var(--bg-lite)',
                                                color: user.role === 'admin' ? 'var(--primary-color)' : 'var(--text-sub)',
                                                border: `1px solid ${user.role === 'admin' ? 'color-mix(in srgb, var(--primary-color) 20%, transparent)' : 'var(--border-color)'}`,
                                                display: 'inline-block',
                                                minWidth: '64px'
                                            }}>{user.role}</span>
                                        </td>
                                        <td className="buddy-td hide-on-mobile" data-label="Joined">
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                                                {new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(user, true)}
                                                    title="Quick View"
                                                    className="btn btn-icon btn-sm"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--primary-color)',
                                                        background: 'transparent',
                                                        border: '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    title="Modify"
                                                    className="btn btn-icon btn-sm"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--secondary-color)',
                                                        background: 'transparent',
                                                        border: '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ isOpen: true, userId: user._id })}
                                                    title="Terminate"
                                                    className="btn btn-icon btn-sm"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--danger-color)',
                                                        background: 'transparent',
                                                        border: '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
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
                                    {isViewMode ? 'View User' : (currentUser ? 'Edit User' : 'New User')}
                                </h3>
                                <button onClick={handleCloseModal} className="modal-close">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">FULL NAME</label>
                                        <input className="input" required disabled={isViewMode} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">EMAIL</label>
                                        <input className="input" type="email" required disabled={isViewMode} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    {!isViewMode && (
                                        <div className="form-group">
                                            <label className="form-label">PASSWORD {currentUser && '(LEAVE BLANK TO UNCHANGED)'}</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="input"
                                                    type={showPassword ? "text" : "password"}
                                                    style={{ paddingRight: '40px' }}
                                                    placeholder="Enter password..."
                                                    required={!currentUser}
                                                    value={formData.password}
                                                    onChange={e => {
                                                        setFormData({ ...formData, password: e.target.value });
                                                        setPasswordError(validatePassword(e.target.value) || '');
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '10px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-sub)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: 0
                                                    }}
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            {passwordError && <span className="form-error">{passwordError}</span>}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="form-label">PHONE</label>
                                            <input className="input" disabled={isViewMode} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="form-label">ROLE</label>
                                            <CustomSelect
                                                disabled={isViewMode}
                                                value={formData.role}
                                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                                options={roles.length > 0 ? roles.map(role => ({
                                                    value: role.name,
                                                    label: role.name
                                                })) : [
                                                    { value: 'admin', label: 'Admin' },
                                                    { value: 'user', label: 'User' }
                                                ]}
                                            />
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
                                            Save User
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
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone and the user will lose all access immediately."
                confirmText="Delete User"
            />

        </div>
    );
};

export default Users;
